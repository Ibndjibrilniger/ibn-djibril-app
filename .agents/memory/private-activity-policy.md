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

Price synchronization must target only prices already managed by Admin.
Preserve prices/products outside that managed set rather than replacing the
whole public catalogue with an Admin-only list.

**Why:** The user explicitly said not to modify other products that are not
currently managed in Admin, while retaining existing business features.

**How to apply:** Treat the Admin-managed subset as authoritative for those
prices without removing other existing public prices or creating new products.
