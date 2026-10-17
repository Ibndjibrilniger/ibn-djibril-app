# Ibn_Djibril Niger Tech

Existing Node.js/Express application with static storefront assets and private Admin.
Keep the current structure and PostgreSQL storage; visual changes must not migrate data.

## Preview

The **Aperçu catalogue** workflow runs `node tests/support/catalogue-preview.cjs`
on `0.0.0.0:5000`. This isolated preview uses random, temporary Admin credentials
and disables PostgreSQL only in its own process. The Admin remains protected.
Visitor-statistics API requests return unavailable in this database-free preview.
It does not change the production environment or its secrets.

## Production startup

`npm ci --omit=dev` installs the locked runtime dependencies; `npm start` runs
`server.js`. There is no frontend compilation step. Keep public npm tarball URLs
in the committed lockfile so external builders can download the same versions.
The existing environment supplies `ADMIN_USER`, `ADMIN_PASSWORD_HASH`,
`SESSION_SECRET` and PostgreSQL configuration. Do not commit credentials.

## Verification

`npm ci` installs dependencies, then `npm test` runs the available tests.
Browser tests use `/repl/tools/bin/chromium` or `CHROMIUM_PATH`.
Admin integration tests use an existing **development/test** PostgreSQL connection
and create their fixture schema inside a rolled-back transaction. Never point
these tests at a production database.

## Display preferences and private settings

The existing public catalogue links to `/parametres.html`. Preferences are local
to the browser: system/light/dark theme, display density, text size and reduced
motion. French is the only implemented interface language. Storage failures are
reported explicitly; these controls never update products or server settings.

`/admin/settings` and its assets use the existing Admin session guard.
`GET /api/admin/settings` is read-only and private. Its synchronization status
describes a current read of the existing price source, not an invented historical
sync time. It must preserve the price subset managed by Admin and all other
public prices. Do not expose credentials, connection strings or raw errors.

Financial API research is in `docs/etude-api-financieres-niger.md`. No payment API
is activated by these interface changes. A production connector requires
separate explicit approval, merchant verification and legal validation.
