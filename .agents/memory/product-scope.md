---
name: Product scope
description: Explicit payment-provider exclusion and constraints for work on the imported application.
---

Al Izza must remain excluded from finance/payment services.

**Why:** The user explicitly said not to re-add it, even when preserving existing country/payment information.

**How to apply:** Maintain the exclusion when changing financial service data, merging alternate interfaces, or importing older versions.

Continue working on the existing imported application rather than rebuilding, replacing, restructuring, or migrating it. Preserve current business functionality and do not change Railway production configuration unless absolutely necessary.

**Why:** The user explicitly requires targeted changes in the existing architecture and continuity of the production application.

**How to apply:** Make the smallest safe changes, keep secrets and credentials untouched, and distinguish workspace verification from a production release.
