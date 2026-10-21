---
name: Admin session security
description: User-required persistence, confidentiality and availability rules for existing Admin sessions.
---

Production Admin sessions must persist in the existing PostgreSQL database, use
secure cookies and expire. Never silently fall back to an in-memory store when
PostgreSQL is unavailable. Preserve the existing account and login mechanism.

**Why:** The user explicitly requested correction of Railway's MemoryStore warning
without deleting an administrator, replacing authentication or losing business data.

**How to apply:** Test login, logout, expiration and session sharing across server
instances against an isolated real database. A first migration from volatile
sessions requires signing in again; tell the owner before publishing. Never
declare the private production UI verified without an authorized signed-in visit.
