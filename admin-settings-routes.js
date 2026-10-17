'use strict';

const path = require('node:path');

// Read-only diagnostics. Never expose environment values, credentials or prices.
module.exports = function registerSettings(app, requireAdmin, options) {
  const directory = path.join(__dirname, 'admin');
  for (const [route, file] of [
    ['/admin/settings', 'settings.html'],
    ['/admin/settings.js', 'settings.js'],
    ['/admin/settings.css', 'settings.css']
  ]) {
    app.get(route, requireAdmin, (_req, res) => {
      res.set('Cache-Control', 'no-store, private');
      res.set('X-Robots-Tag', 'noindex, nofollow');
      res.sendFile(path.join(directory, file));
    });
  }

  app.get('/api/admin/settings', requireAdmin, async (_req, res) => {
    const database = options.hasDatabase();
    const result = {
      ok: true,
      version: options.getVersion(),
      business: {
        name: 'Ibn_Djibril Niger Tech',
        location: 'Tara, Niger',
        website: 'https://ibndjibrilnigertech.com',
        whatsapp: '+227 96 78 48 70',
        phone: '+227 91 44 51 87'
      },
      catalogue: {
        publicEndpoint: '/api/prices',
        managedEndpoint: '/api/admin/prices',
        negotiableNotice: 'Tous les prix sont à discuter',
        policy: 'Les prix gérés dans Admin sont prioritaires. Les autres prix publics sont conservés.'
      },
      security: {
        authentication: 'Session administrateur existante',
        sessionMinutes: options.sessionCookie.maxAge / 60000,
        httpOnly: options.sessionCookie.httpOnly,
        sameSite: options.sessionCookie.sameSite,
        secureCookie: options.sessionCookie.secure,
        passwordPage: '/admin#current-password'
      },
      notifications: {
        available: false,
        description: 'Aucun service de notifications administrateur n’est configuré dans cette application.'
      }
    };
    try {
      const managed = await options.readManagedPrices();
      const local = options.readLocalPrices();
      const managedIds = new Set(Object.keys(managed));
      const publicIds = new Set([...Object.keys(local), ...managedIds]);
      result.synchronization = {
        status: database ? 'available' : 'local',
        source: database ? 'PostgreSQL' : 'Fichiers locaux',
        mode: 'Lecture automatique à chaque requête publique',
        checkedAt: new Date().toISOString(),
        managedCount: managedIds.size,
        publicCount: publicIds.size,
        preservedOutsideAdmin: [...publicIds].filter(id => !managedIds.has(id)).length
      };
      res.json(result);
    } catch (_) {
      // Explicit unavailability rather than a stale-success or invented sync time.
      result.ok = false;
      result.synchronization = {
        status: 'unavailable',
        source: database ? 'PostgreSQL' : 'Fichiers locaux',
        checkedAt: new Date().toISOString(),
        error: 'La lecture des prix est indisponible. Aucune donnée ni configuration n’a été modifiée.'
      };
      res.status(503).json(result);
    }
  });
};
