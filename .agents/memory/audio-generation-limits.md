---
name: Audio generation request limits
description: Avoid rejected bursts and duplicate paid speech generation.
---

Submit speech-generation requests in conservative batches rather than a large simultaneous burst. Reuse the shared narration between video versions.

**Why:** The integrated audio service rejected requests above ten per second for this workspace with HTTP 429. Most requests in the same burst had already succeeded.

**How to apply:** Collect every job's individual result before retrying anything. Retry only an explicitly rejected request with no output file, never an already-generated passage. Do not treat a mixed batch failure as failure of the whole batch or regenerate paid successes.
