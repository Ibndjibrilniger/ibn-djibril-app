---
name: Browser test resources
description: Avoid false browser-test timeouts caused by concurrent verification in this workspace.
---

Run browser-heavy regression suites sequentially, and do not capture preview screenshots while those suites are running.

**Why:** Multiple browser suites plus screenshot captures share limited workspace resources. The finance comparison exceeded its timeout under that combined load but passed quickly in isolation.

**How to apply:** Keep visual captures separate from the browser test run. Investigate a timeout in isolation before treating it as an application failure or increasing timeouts.
