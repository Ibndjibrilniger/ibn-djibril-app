---
name: Production verification boundaries
description: Distinguish GitHub and Railway release evidence from public behavior and private Admin proof.
---

Verify release delivery and functionality separately. For this GitHub-connected
Railway app, the public GitHub commit-status and deployment-status APIs expose
Railway's success signal and dashboard link without a Railway credential.

**Why:** Direct Railway access is not configured, but the public repository
publishes Railway statuses. Assuming status is unverifiable without OAuth misses
available evidence; treating success as functional proof repeats the user's
explicitly rejected completion criterion.

**How to apply:** Read the status attached to the exact commit being served,
check its Railway context/target, and independently compare the public release
SHA and changed assets. Attribute success to GitHub's Railway report; never
claim to have read internal Railway logs. Actual private Admin rendering still
requires an authorized session and must not be inferred from write receipts.

Native lazy images can still have an empty currentSrc after the page load event.
Do not make catalogue readiness depend on photographs merely to stabilize a test.

**Why:** A real production check confirmed the catalogue was usable while a
timing-dependent image assertion failed in the browser suite.

**How to apply:** Wait for image selection specifically in image assertions,
and use independent catalogue-readiness marks for startup measurements.
