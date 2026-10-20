(() => {
  'use strict';
  const status = document.getElementById('settings-status');
  const refresh = document.getElementById('refresh-settings');
  const preferences = window.IBNPreferences;
  const controls = {
    theme: document.getElementById('admin-pref-theme'),
    density: document.getElementById('admin-pref-density'),
    textSize: document.getElementById('admin-pref-text'),
    reducedMotion: document.getElementById('admin-pref-motion')
  };
  const storageNotice = document.getElementById('admin-pref-storage');
  function showPreferences(value) {
    for (const [key, input] of Object.entries(controls)) {
      if (input.type === 'checkbox') input.checked = value[key];
      else input.value = value[key];
    }
    storageNotice.hidden = value.storageAvailable !== false;
    storageNotice.textContent = storageNotice.hidden ? ''
      : 'Stockage local indisponible : vos réglages ne seront pas conservés après fermeture ou rechargement.';
  }
  if (preferences) {
    showPreferences(preferences.get());
    preferences.subscribe(() => showPreferences(preferences.get()));
    for (const [key, input] of Object.entries(controls)) {
      input.addEventListener('change', () => preferences.set({
        [key]: input.type === 'checkbox' ? input.checked : input.value
      }));
    }
  } else {
    storageNotice.hidden = false;
    storageNotice.textContent = 'Les réglages d’affichage sont indisponibles. Rechargez la page.';
    Object.values(controls).forEach(input => { input.disabled = true; });
  }
  function definitions(id, rows) {
    const root = document.getElementById(id);
    root.replaceChildren();
    for (const [label, value] of rows) {
      const term = document.createElement('dt');
      const definition = document.createElement('dd');
      term.textContent = label;
      definition.textContent = String(value);
      root.append(term, definition);
    }
  }
  async function load() {
    refresh.disabled = true;
    status.classList.remove('error');
    status.textContent = 'Vérification des informations privées…';
    try {
      const response = await fetch('/api/admin/settings', {
        credentials: 'same-origin', cache: 'no-store'
      });
      if (response.status === 401) {
        window.location.assign('/admin/login');
        return;
      }
      const data = await response.json();
      if ((!response.ok && response.status !== 503) || !data.security || !data.synchronization) {
        throw new Error('Réponse indisponible');
      }
      definitions('company-information', [
        ['Entreprise', data.business.name], ['Localisation', data.business.location],
        ['Site', data.business.website], ['WhatsApp', data.business.whatsapp],
        ['Téléphone', data.business.phone]
      ]);
      definitions('security-information', [
        ['Authentification', data.security.authentication],
        ['Durée maximale de la session', `${data.security.sessionMinutes} minutes`],
        ['Cookie HttpOnly', data.security.httpOnly ? 'Oui' : 'Non'],
        ['Protection SameSite', data.security.sameSite],
        ['Drapeau Secure du cookie', data.security.secureCookie ? 'Activé' : 'Non activé']
      ]);
      document.getElementById('secure-cookie-notice').hidden = data.security.secureCookie;
      document.getElementById('catalogue-policy').textContent = data.catalogue.policy;
      document.getElementById('application-version').textContent = data.version;
      document.getElementById('notifications-status').textContent = data.notifications.description;
      const sync = data.synchronization;
      const root = document.getElementById('sync-information');
      root.replaceChildren();
      const label = document.createElement('strong');
      label.dataset.syncStatus = sync.status;
      label.textContent = sync.status === 'available' ? 'Lecture PostgreSQL disponible'
        : sync.status === 'local' ? 'Mode fichiers locaux — PostgreSQL non configuré dans cet environnement'
        : 'Lecture des prix indisponible';
      root.append(label);
      const details = document.createElement('p');
      details.textContent = sync.status === 'unavailable' ? sync.error
        : `${sync.managedCount} prix gérés ; ${sync.publicCount} prix publics ; ${sync.preservedOutsideAdmin} prix conservés hors du périmètre Admin.`;
      root.append(details);
      const timestamp = document.createElement('p');
      timestamp.textContent = `Vérifié le ${new Date(sync.checkedAt).toLocaleString('fr-FR')}.`;
      root.append(timestamp);
      status.textContent = data.ok ? 'Informations actualisées. Aucune donnée modifiée.'
        : 'Informations chargées, mais la source des prix est indisponible.';
      status.classList.toggle('error', !data.ok);
    } catch (_) {
      status.textContent = 'Impossible de charger les paramètres. Vérifiez votre connexion et réessayez.';
      status.classList.add('error');
    } finally {
      refresh.disabled = false;
    }
  }
  refresh.addEventListener('click', load);
  load();
})();
