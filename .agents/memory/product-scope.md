---
name: Product scope
description: Explicit payment-provider exclusion and constraints for work on the imported application.
---

Al Izza must remain excluded from finance/payment services.

**Why:** The user explicitly said not to re-add it, even when preserving existing country/payment information.

**How to apply:** Maintain the exclusion when changing financial service data, merging alternate interfaces, or importing older versions.

Financial services in the application are a presentation/contact catalogue, not transactions executed in the app. Do not describe listed brands as official partners without evidence.

**Why:** The user explicitly requires these factual boundaries in company communications.

**How to apply:** Preserve this distinction in product copy, marketing videos, financial-service screens and claims of affiliation.

Studying financial APIs does not authorize activating them in production or creating a fake functional transfer interface. Real transactions require explicit user agreement, a verified merchant account and validation of the legal obligations.

**Why:** The user explicitly separated the financial API study from improvements to the existing catalogue and settings.

**How to apply:** Keep research separate from transaction code. Obtain the required validation before any future production financial integration; do not request or expose confidential financial credentials.

Continue working on the existing imported application rather than rebuilding, replacing, restructuring, or migrating it. Preserve current business functionality and do not change Railway production configuration unless absolutely necessary.

**Why:** The user explicitly requires targeted changes in the existing architecture and continuity of the production application.

**How to apply:** Make the smallest safe changes, keep secrets and credentials untouched, and distinguish workspace verification from a production release.

Railway deploys the repository's `main` branch automatically.

**Why:** The user explicitly supplied this deployment behavior in their release instructions.

**How to apply:** Treat a push to `main` as a production release, not merely a remote backup. Preserve the existing Railway setup and obtain explicit release authorization before pushing.

The user wants one illustrated commercial homepage catalogue, not the old redundant text dashboards. Remove only their presentation after retaining every useful description, offer and the complete Téléphones & Accessoires list. Keep the exact “Tous les prix sont à discuter” notice.

**Why:** The user explicitly requires visual modernization without losing products, prices, cart contents, WhatsApp orders, financial services, private Admin analytics, contacts or PWA functionality.

**How to apply:** Reuse the imported application and real assets. Do not change PostgreSQL data for visual cleanup. Never replace negotiated prices with numbers or overwrite Admin-managed prices with conflicting old display prices. Keep distinct published offers reachable without duplicating product cards.
