---
name: Guarded Git writes
description: Tool-level Git write guard in this workspace.
---

When the user has authorized a commit or push, a rejected Git write may need the per-command environment prefix `DANGEROUSLY_ALLOW_GIT=1`.

**Why:** This workspace's shell guard otherwise rejects writes to the Git index before the command can run.

**How to apply:** Use the prefix only for the already-authorized, non-destructive Git operation. Do not modify Git internals, force-push, discard changes or infer release permission from this guard exception. Pushing main triggers the existing Railway production deployment.
