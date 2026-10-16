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
