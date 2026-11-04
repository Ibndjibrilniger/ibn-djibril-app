---
name: PostgreSQL test isolation
description: Expected database errors can abort a shared test transaction and appear as unrelated authentication failures.
---

The rollback-isolated Admin fixture shares one PostgreSQL transaction with
application queries, including session storage. Expected invalid actions must
not leave that transaction aborted.

**Why:** A deliberately rejected duplicate write aborted the fixture transaction.
Subsequent session queries failed and obscured the original cause with
authentication and response-header errors, although the credentials were valid.

**How to apply:** Prefer conflict-safe SQL for normal validation outcomes. When a
test intentionally exercises a PostgreSQL exception, use a savepoint and roll
back to it before the next application request. Do not change production
credentials or session behavior to resolve fixture-induced failures.
