---
name: Private activity policy
description: User constraints for private analytics and the scope of price synchronization.
---

The user wants activity data consulted only through the existing private Admin
authentication and stored in the existing PostgreSQL database. Do not collect
unnecessary personal data, financial credentials, tokens, secrets or form contents.

**Why:** The user explicitly requested a private activity dashboard, reuse of
existing authentication/storage, and strict limits on visitor data collection.

**How to apply:** Keep collection minimal and first-party; never add analytics
data to public API responses or introduce a second Admin authentication system.
Country information may be unavailable; do not invent a visitor country.

New visitor analytics require explicit opt-in before creating statistical
identifiers or sending events. Refusal/revocation must not limit the catalogue,
cart or contact features; browser DNT/GPC takes precedence over acceptance.

**Why:** The user requested consent/opposition mechanisms, pseudonymous analysis
without accounts, and no intrusive identification or browser-protection bypass.

**How to apply:** Keep only coarse source categories, declared device information
and trusted-proxy approximate geography. Do not request high-entropy device hints,
GPS or external IP lookups to fill unavailable values. A browser identifier is
not a person; distinguish declared device family from an exact hardware model.

Do not declare visitor-analytics verification complete just because a new commit
is served publicly. Require a newly consented test visit to be visible in the
production private Admin, including its detail view. If production authentication
is unavailable, report this remaining check explicitly; never bypass Admin auth.

**Why:** The user corrected the earlier completion: they require an operational
PostgreSQL-to-Admin chain, not just a working-looking interface or a public release.

**How to apply:** Separate local rollback-fixture proof, production write receipts,
and production private-screen proof. Never present one as proof of the others.

Prefer local IP-country estimation over an external per-visitor IP lookup service.
Keep only the country estimate, not the IP; no guess from language, capital or
hosting-server location. Geography must be labelled approximate.

**Why:** The user now explicitly requests reliable IP-based country estimates when
authorized, while preserving privacy and avoiding unnecessary service fees.

**How to apply:** Use only the platform's documented real-client address boundary,
reject reserved/private addresses, respect consent, and keep the dataset current.

Price synchronization must target only prices already managed by Admin.
Preserve prices/products outside that managed set rather than replacing the
whole public catalogue with an Admin-only list.

**Why:** The user explicitly said not to modify other products that are not
currently managed in Admin, while retaining existing business features.

**How to apply:** Treat the Admin-managed subset as authoritative for those
prices without removing other existing public prices or creating new products.
