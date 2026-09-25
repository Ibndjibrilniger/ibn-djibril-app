'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const multer = require('multer');

const PRODUCTS_FILE =
  path.join(__dirname, 'data', 'products.json');

const PUBLIC_PRODUCTS_FILE =
  path.join(__dirname, 'public', 'catalogue-data.js');

const PRICES_FILE =
  path.join(__dirname, 'data', 'prices.json');

const PUBLIC_PRICES_FILE =
  path.join(__dirname, 'public', 'prix-produits.js');

const UPLOAD_DIR =
  path.join(__dirname, 'public', 'uploads');

fs.mkdirSync(UPLOAD_DIR, { recursive: true });

function loadJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function slugify(text) {
  return String(text || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 70);
}

function formatPrice(value) {
  return String(value)
    .replace(/\B(?=(\d{3})+(?!\d))/g, ' ') +
    ' FCFA';
}

function saveProducts(products) {
  const dataTmp = PRODUCTS_FILE + '.tmp';
  const publicTmp = PUBLIC_PRODUCTS_FILE + '.tmp';

  fs.writeFileSync(
    dataTmp,
    JSON.stringify(products, null, 2)
  );

  fs.writeFileSync(
    publicTmp,
    'window.IBN_CATALOGUE = ' +
    JSON.stringify(products, null, 2) +
    ';\n'
  );

  fs.renameSync(dataTmp, PRODUCTS_FILE);
  fs.renameSync(publicTmp, PUBLIC_PRODUCTS_FILE);
}

function savePrices(prices) {
  const dataTmp = PRICES_FILE + '.tmp';
  const publicTmp = PUBLIC_PRICES_FILE + '.tmp';

  fs.writeFileSync(
    dataTmp,
    JSON.stringify(prices, null, 2)
  );

  const code = `(function () {
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

  fs.writeFileSync(publicTmp, code);

  fs.renameSync(dataTmp, PRICES_FILE);
  fs.renameSync(publicTmp, PUBLIC_PRICES_FILE);
}

const storage = multer.diskStorage({
  destination: function(req, file, cb) {
    cb(null, UPLOAD_DIR);
  },

  filename: function(req, file, cb) {
    const extensions = {
      'image/jpeg': '.jpg',
      'image/png': '.png',
      'image/webp': '.webp'
    };

    const ext = extensions[file.mimetype] || '';
    const id = crypto.randomBytes(12).toString('hex');

    cb(null, 'produit-' + id + ext);
  }
});

const upload = multer({
  storage,

  limits: {
    fileSize: 6 * 1024 * 1024
  },

  fileFilter: function(req, file, cb) {
    const ok = [
      'image/jpeg',
      'image/png',
      'image/webp'
    ].includes(file.mimetype);

    if (!ok) {
      return cb(
        new Error(
          'Format photo non accepté. Utilisez JPG, PNG ou WEBP.'
        )
      );
    }

    cb(null, true);
  }
});

module.exports = function(app, requireAdmin) {

  app.get(
    '/admin/products/new',
    requireAdmin,
    function(req, res) {
      res.sendFile(
        path.join(__dirname, 'admin', 'add-product.html')
      );
    }
  );


  app.get(
    '/api/admin/products',
    requireAdmin,
    function(req, res) {
      try {
        res.json({
          ok: true,
          products: loadJson(PRODUCTS_FILE)
        });
      } catch (err) {
        console.error(err);

        res.status(500).json({
          ok: false,
          error: 'Impossible de lire les produits.'
        });
      }
    }
  );

  app.post(
    '/api/admin/products',
    requireAdmin,
    upload.single('photo'),
    function(req, res) {

      try {
        const name =
          String(req.body.name || '').trim();

        const category =
          String(req.body.category || '').trim();

        const subtitle =
          String(req.body.subtitle || '').trim();

        if (name.length < 2 || name.length > 120) {
          return res.status(400).json({
            ok: false,
            error: 'Nom du produit incorrect.'
          });
        }

        if (
          category.length < 2 ||
          category.length > 80
        ) {
          return res.status(400).json({
            ok: false,
            error: 'Catégorie incorrecte.'
          });
        }

        if (subtitle.length > 200) {
          return res.status(400).json({
            ok: false,
            error: 'Description trop longue.'
          });
        }

        const products = loadJson(PRODUCTS_FILE);
        const prices = loadJson(PRICES_FILE);

        let id = slugify(name);

        if (!id) {
          id = 'produit';
        }

        const originalId = id;
        let number = 2;

        while (
          products.some(product => product.id === id)
        ) {
          id = originalId + '-' + number;
          number++;
        }

        const specs =
          String(req.body.specs || '')
            .split(/\r?\n/)
            .map(line => line.trim())
            .filter(Boolean)
            .slice(0, 30);

        let stock = null;

        if (
          req.body.stock !== undefined &&
          String(req.body.stock).trim() !== ''
        ) {
          stock = Number(req.body.stock);

          if (
            !Number.isInteger(stock) ||
            stock < 0 ||
            stock > 1000000
          ) {
            return res.status(400).json({
              ok: false,
              error: 'Stock incorrect.'
            });
          }
        }

        const product = {
          id,
          category,
          name,
          subtitle,
          images: req.file
            ? ['/uploads/' + req.file.filename]
            : [],
          specs,
          stock,
          outOfStock: stock === 0,
          active: true,
          createdAt: new Date().toISOString()
        };

        products.push(product);

        const negotiable =
          req.body.negotiable === 'true' ||
          req.body.negotiable === 'on';

        if (negotiable) {
          prices[id] = {
            value: null,
            label: 'Prix à discuter'
          };
        } else {
          const value = Number(req.body.price);

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

          prices[id] = {
            value,
            label: formatPrice(value)
          };
        }

        saveProducts(products);
        savePrices(prices);

        res.json({
          ok: true,
          product,
          price: prices[id]
        });

      } catch (err) {
        console.error(err);

        res.status(500).json({
          ok: false,
          error:
            'Impossible d’ajouter le produit.'
        });
      }
    }
  );

  app.patch(
    '/api/admin/products/:id/stock',
    requireAdmin,
    function(req, res) {
      try {
        const id = String(req.params.id || '');

        const products = loadJson(PRODUCTS_FILE);

        const product =
          products.find(p => p.id === id);

        if (!product) {
          return res.status(404).json({
            ok: false,
            error: 'Produit introuvable.'
          });
        }

        const raw = req.body.stock;

        if (
          raw === null ||
          raw === undefined ||
          raw === ''
        ) {
          product.stock = null;
          product.outOfStock = false;
        } else {
          const stock = Number(raw);

          if (
            !Number.isInteger(stock) ||
            stock < 0 ||
            stock > 1000000
          ) {
            return res.status(400).json({
              ok: false,
              error: 'Stock incorrect.'
            });
          }

          product.stock = stock;
          product.outOfStock = stock === 0;
        }

        saveProducts(products);

        res.json({
          ok: true,
          product: product
        });

      } catch (err) {
        console.error(err);

        res.status(500).json({
          ok: false,
          error: 'Impossible de modifier le stock.'
        });
      }
    }
  );


  /* ===== MODIFIER LES INFORMATIONS D'UN PRODUIT ===== */

  app.patch(
    '/api/admin/products/:id/details',
    requireAdmin,
    function(req, res) {
      try {
        const id = String(req.params.id || '');
        const products = loadJson(PRODUCTS_FILE);

        const product =
          products.find(p => p.id === id);

        if (!product) {
          return res.status(404).json({
            ok: false,
            error: 'Produit introuvable.'
          });
        }

        const name =
          String(req.body.name || '').trim();

        const category =
          String(req.body.category || '').trim();

        const subtitle =
          String(req.body.subtitle || '').trim();

        let specs = req.body.specs;

        if (typeof specs === 'string') {
          specs = specs
            .split(/\r?\n/)
            .map(x => x.trim())
            .filter(Boolean);
        }

        if (!Array.isArray(specs)) {
          specs = [];
        }

        specs = specs
          .map(x => String(x).trim())
          .filter(Boolean)
          .slice(0, 30);

        if (name.length < 2 || name.length > 120) {
          return res.status(400).json({
            ok: false,
            error: 'Nom du produit incorrect.'
          });
        }

        if (
          category.length < 2 ||
          category.length > 80
        ) {
          return res.status(400).json({
            ok: false,
            error: 'Catégorie incorrecte.'
          });
        }

        if (subtitle.length > 200) {
          return res.status(400).json({
            ok: false,
            error: 'Description trop longue.'
          });
        }

        product.name = name;
        product.category = category;
        product.subtitle = subtitle;
        product.specs = specs;
        product.updatedAt =
          new Date().toISOString();

        saveProducts(products);

        res.json({
          ok: true,
          product
        });

      } catch (err) {
        console.error(err);

        res.status(500).json({
          ok: false,
          error:
            'Impossible de modifier le produit.'
        });
      }
    }
  );


  /* ===== CHANGER LA PHOTO PRINCIPALE ===== */

  app.post(
    '/api/admin/products/:id/photo',
    requireAdmin,
    upload.single('photo'),
    function(req, res) {
      try {
        const id = String(req.params.id || '');
        const products = loadJson(PRODUCTS_FILE);

        const product =
          products.find(p => p.id === id);

        if (!product) {
          return res.status(404).json({
            ok: false,
            error: 'Produit introuvable.'
          });
        }

        if (!req.file) {
          return res.status(400).json({
            ok: false,
            error: 'Veuillez choisir une photo.'
          });
        }

        const photo =
          '/uploads/' + req.file.filename;

        const oldImages =
          Array.isArray(product.images)
            ? product.images
            : [];

        product.images = [
          photo,
          ...oldImages.slice(1)
        ];

        product.updatedAt =
          new Date().toISOString();

        saveProducts(products);

        res.json({
          ok: true,
          product
        });

      } catch (err) {
        console.error(err);

        res.status(500).json({
          ok: false,
          error:
            'Impossible de changer la photo.'
        });
      }
    }
  );


  /* ===== ACTIVER / DÉSACTIVER ===== */

  app.patch(
    '/api/admin/products/:id/active',
    requireAdmin,
    function(req, res) {
      try {
        const id = String(req.params.id || '');
        const products = loadJson(PRODUCTS_FILE);

        const product =
          products.find(p => p.id === id);

        if (!product) {
          return res.status(404).json({
            ok: false,
            error: 'Produit introuvable.'
          });
        }

        if (typeof req.body.active !== 'boolean') {
          return res.status(400).json({
            ok: false,
            error: 'État incorrect.'
          });
        }

        product.active = req.body.active;
        product.updatedAt =
          new Date().toISOString();

        saveProducts(products);

        res.json({
          ok: true,
          product
        });

      } catch (err) {
        console.error(err);

        res.status(500).json({
          ok: false,
          error:
            'Impossible de changer l’état.'
        });
      }
    }
  );

};
