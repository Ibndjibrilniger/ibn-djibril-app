---
name: Sync and startup constraints
description: User-stated constraints for Git reconciliation and mobile startup.
---

Before reconciling divergent branches, preserve both tips on safety branches and inspect conflicts individually. Never use a hard reset, a force push or a destructive automatic merge. Preserve useful changes and the history.

**Why:** The user explicitly requires non-destructive Git repair and preservation of project data.

**How to apply:** Inspect remote and local commits before merging, resolve each conflict, verify the result and treat pushing main as a Railway production release.

Show the app as soon as it is ready; do not hold a startup screen for an artificial several-second duration.

**Why:** The user's latest startup instructions replace the earlier fixed 3–5 second request with readiness-driven loading and an honest retry state.

**How to apply:** Keep slow/error handling and lightweight animation, but never add a minimum splash duration.
