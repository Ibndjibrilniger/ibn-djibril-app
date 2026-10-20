---
name: Build portability
description: Keep dependency lockfiles usable by Railway while retaining Replit package protections.
---

After dependency operations in Replit, check that committed npm tarball URLs remain publicly reachable rather than pointing to a Replit-internal registry.

**Why:** Replit dependency operations can write internal registry URLs into the lockfile. Installation then succeeds in the workspace but those URLs are unreachable from Railway's builder.

**How to apply:** Preserve dependency versions and integrity hashes when normalizing public package URLs to the public npm registry. Continue using Replit's package protection for workspace installs; do not bypass blocked-package protections. Validate a fresh production dependency installation before release.
