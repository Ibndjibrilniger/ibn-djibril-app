'use strict';

require('dotenv').config();

const express = require('express');
const session = require('express-session');
const bcrypt = require('bcryptjs');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = Number(process.env.PORT || 3000);

const ADMIN_CREDENTIALS_FILE = '/app/storage/admin-credentials.json';

function getEffectiveAdminHash() {
  try {
    if (fs.existsSync(ADMIN_CREDENTIALS_FILE)) {
      const data = JSON.parse(
        fs.readFileSync(ADMIN_CREDENTIALS_FILE, 'utf8')
      );

      if (
        data &&
        typeof data.passwordHash === 'string' &&
        data.passwordHash.length > 0
      ) {
        return data.passwordHash;
      }
    }
  } catch (err) {
    console.error('ADMIN_CREDENTIALS_READ_ERROR');
  }

  return process.env.ADMIN_PASSWORD_HASH;
}

const HOST =
  process.env.HOST ||
  (process.env.NODE_ENV === 'production'
    ? '0.0.0.0'
    : '127.0.0.1');


const PRICES_FILE = path.join(__dirname, 'data', 'prices.json');
const PUBLIC_PRICES_FILE = path.join(__dirname, 'public', 'prix-produits.js');

if (
  !process.env.ADMIN_USER ||
  !getEffectiveAdminHash() ||
  !process.env.SESSION_SECRET
) {
  console.error('ERREUR : configuration administrateur incomplète.');
  process.exit(1);
}

app.disable('x-powered-by');

app.use(express.urlencoded({
  extended: false,
  limit: '20kb'
}));

app.use(express.json({
  limit: '100kb'
}));

app.use(session({
  name: 'ibn_admin_session',
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    sameSite: 'lax',
    secure: false,
    maxAge: 2 * 60 * 60 * 1000
  }
}));

function requireAdmin(req, res, next) {
  if (req.session && req.session.isAdmin === true) {
    return next();
  }

  if (req.path.startsWith('/api/')) {
    return res.status(401).json({
      ok: false,
      error: 'Session administrateur expirée.'
    });
  }

  return res.redirect('/admin/login');
}

function loadPrices() {
  return JSON.parse(
    fs.readFileSync(PRICES_FILE, 'utf8')
  );
}

function formatPrice(value) {
  return String(value)
    .replace(/\B(?=(\d{3})+(?!\d))/g, ' ') + ' FCFA';
}

function savePrices(prices) {
  const jsonTmp = PRICES_FILE + '.tmp';
  const jsTmp = PUBLIC_PRICES_FILE + '.tmp';

  fs.writeFileSync(
    jsonTmp,
    JSON.stringify(prices, null, 2)
  );

  const publicCode = `(function () {
  const PRIX = ${JSON.stringify(prices, null, 2)};

  window.IBN_PRIX_PRODUITS = PRIX;

  if (Array.isArray(window.IBN_CATALOGUE)) {
    window.IBN_CATALOGUE.forEach(function (produit) {
      const tarif = PRIX[produit.id];
      if (!tarif) return;

      produit.price = tarif.label;
      produit.priceValue = tarif.value;
      produit.currency = "XOF";
      produit.priceNegotiable = tarif.value === null;
    });
  }
})();
`;

  fs.writeFileSync(jsTmp, publicCode);

  fs.renameSync(jsonTmp, PRICES_FILE);
  fs.renameSync(jsTmp, PUBLIC_PRICES_FILE);
}

/* ---------- CONNEXION ADMIN ---------- */

app.get('/admin/login', (req, res) => {
  if (req.session && req.session.isAdmin === true) {
    return res.redirect('/admin');
  }

  res.sendFile(
    path.join(__dirname, 'admin', 'login.html')
  );
});

app.post('/admin/login', async (req, res) => {
  try {
    const usernameRaw = String(req.body.username || '');
    const passwordRaw = String(req.body.password || '');

    const username = usernameRaw.trim();
    const configuredUser =
      String(process.env.ADMIN_USER || '').trim();

    const validUser =
      username.toLowerCase() === configuredUser.toLowerCase();

    let validPassword = false;

    if (validUser) {
      validPassword = await bcrypt.compare(
        passwordRaw,
        getEffectiveAdminHash()
      );

      if (!validPassword && passwordRaw !== passwordRaw.trim()) {
        validPassword = await bcrypt.compare(
          passwordRaw.trim(),
          getEffectiveAdminHash()
        );
      }
    }

    if (!validUser || !validPassword) {
      console.warn('ADMIN_LOGIN_FAILED', {
        userMatch: validUser,
        usernameLength: usernameRaw.length,
        passwordLength: passwordRaw.length,
        trimmedPasswordLength: passwordRaw.trim().length
      });
    }

    if (!validUser || !validPassword) {
      return res.status(401).send(`
        <meta name="viewport" content="width=device-width,initial-scale=1">
        <div style="font-family:Arial;padding:30px">
          <h2>Identifiants incorrects</h2>
          <a href="/admin/login">Réessayer</a>
        </div>
      `);
    }

    req.session.regenerate(err => {
      if (err) {
        return res.status(500).send('Erreur de session');
      }

      req.session.isAdmin = true;

      req.session.save(err => {
        if (err) {
          return res.status(500).send('Erreur de session');
        }

        res.redirect('/admin');
      });
    });

  } catch (err) {
    console.error(err);
    res.status(500).send('Erreur serveur');
  }
});


app.get('/admin/entry', (req, res) => {
  const goLogin = () => {
    res.clearCookie('ibn_admin_session');
    res.redirect('/admin/login');
  };

  if (req.session) {
    return req.session.destroy(() => {
      goLogin();
    });
  }

  goLogin();
});

app.get('/admin', requireAdmin, (req, res) => {
  res.sendFile(
    path.join(__dirname, 'admin', 'dashboard.html')
  );
});

app.post('/admin/logout', requireAdmin, (req, res) => {
  req.session.destroy(() => {
    res.clearCookie('ibn_admin_session');
    res.redirect('/');
  });
});

/* ---------- CHANGER MOT DE PASSE ADMIN ---------- */

app.post('/api/admin/change-password', requireAdmin, async (req, res) => {
  try {
    const currentPassword = String(req.body.currentPassword || '');
    const newPassword = String(req.body.newPassword || '');
    const confirmPassword = String(req.body.confirmPassword || '');

    if (!currentPassword || !newPassword || !confirmPassword) {
      return res.status(400).json({
        ok: false,
        error: 'Tous les champs sont obligatoires.'
      });
    }

    if (newPassword.length < 8) {
      return res.status(400).json({
        ok: false,
        error: 'Le nouveau mot de passe doit contenir au moins 8 caractères.'
      });
    }

    if (newPassword !== confirmPassword) {
      return res.status(400).json({
        ok: false,
        error: 'Les deux nouveaux mots de passe ne correspondent pas.'
      });
    }

    const currentHash = getEffectiveAdminHash();

    const currentValid = await bcrypt.compare(
      currentPassword,
      currentHash
    );

    if (!currentValid) {
      return res.status(400).json({
        ok: false,
        error: 'Le mot de passe actuel est incorrect.'
      });
    }

    const samePassword = await bcrypt.compare(
      newPassword,
      currentHash
    );

    if (samePassword) {
      return res.status(400).json({
        ok: false,
        error: 'Choisissez un nouveau mot de passe différent.'
      });
    }

    const newHash = await bcrypt.hash(newPassword, 12);

    const storageDir = '/app/storage';
    fs.mkdirSync(storageDir, { recursive: true });

    const tempFile = ADMIN_CREDENTIALS_FILE + '.tmp';

    fs.writeFileSync(
      tempFile,
      JSON.stringify({
        passwordHash: newHash,
        updatedAt: new Date().toISOString()
      }, null, 2)
    );

    try {
      fs.chmodSync(tempFile, 0o600);
    } catch (_) {}

    fs.renameSync(
      tempFile,
      ADMIN_CREDENTIALS_FILE
    );

    return res.json({
      ok: true
    });

  } catch (err) {
    console.error('CHANGE_PASSWORD_ERROR');

    return res.status(500).json({
      ok: false,
      error: 'Impossible de modifier le mot de passe.'
    });
  }
});

/* ---------- API PRIVÉE DES PRIX ---------- */

app.get('/api/admin/prices', requireAdmin, (req, res) => {
  try {
    res.json({
      ok: true,
      prices: loadPrices()
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({
      ok: false,
      error: 'Impossible de lire les prix.'
    });
  }
});

app.post('/api/admin/prices/:id', requireAdmin, (req, res) => {
  try {
    const id = String(req.params.id || '');

    if (!/^[a-z0-9-]+$/i.test(id)) {
      return res.status(400).json({
        ok: false,
        error: 'Identifiant produit invalide.'
      });
    }

    const prices = loadPrices();

    if (!Object.prototype.hasOwnProperty.call(prices, id)) {
      return res.status(404).json({
        ok: false,
        error: 'Produit introuvable.'
      });
    }

    const negotiable =
      req.body.negotiable === true ||
      req.body.negotiable === 'true';

    if (negotiable) {
      prices[id] = {
        value: null,
        label: 'Prix à discuter'
      };
    } else {
      const value = Number(req.body.value);

      if (
        !Number.isInteger(value) ||
        value < 0 ||
        value > 1000000000
      ) {
        return res.status(400).json({
          ok: false,
          error: 'Prix incorrect.'
        });
      }

      let label = String(req.body.label || '').trim();

      if (!label) {
        label = formatPrice(value);
      }

      if (label.length > 80) {
        return res.status(400).json({
          ok: false,
          error: 'Libellé trop long.'
        });
      }

      prices[id] = {
        value,
        label
      };
    }

    savePrices(prices);

    res.json({
      ok: true,
      id,
      price: prices[id]
    });

  } catch (err) {
    console.error(err);

    res.status(500).json({
      ok: false,
      error: 'Impossible d’enregistrer le prix.'
    });
  }
});

require('./product-admin-routes')(app, requireAdmin);

app.get('/api/app-version', (req, res) => {
  res.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.json({
    version:
      process.env.RAILWAY_GIT_COMMIT_SHA ||
      process.env.APP_VERSION ||
      '1.0.2'
  });
});

/* ---------- APPLICATION PUBLIQUE ---------- */

app.use(
  express.static(
    path.join(__dirname, 'public')
  )
);

app.listen(PORT, HOST, () => {
  console.log('');
  console.log('✅ Ibn_Djibril Niger Tech démarré');
  console.log(`🌍 Application : http://127.0.0.1:${PORT}`);
  console.log(`🔐 Admin       : http://127.0.0.1:${PORT}/admin`);
  console.log('');
});
