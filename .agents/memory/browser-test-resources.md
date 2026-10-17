---
name: Browser test resources
description: Avoid false browser-test timeouts caused by concurrent verification in this workspace.
---

Run browser-heavy regression suites sequentially, and do not capture preview screenshots while those suites are running.

**Why:** Multiple browser suites plus screenshot captures share limited workspace resources. The finance comparison exceeded its timeout under that combined load but passed quickly in isolation.

**How to apply:** Keep visual captures separate from the browser test run. Investigate a timeout in isolation before treating it as an application failure or increasing timeouts.

Playwright video recording needs its own versioned FFmpeg download even when
the system FFmpeg command and Chromium screenshots already work.

**Why:** Recording failed at browser page creation because Playwright's expected
media executable was absent; the system FFmpeg installation did not satisfy it.

**How to apply:** If the error explicitly names Playwright's missing FFmpeg,
install only its media binary with the existing Playwright CLI. Do not replace
the app's dependencies or install a second browser merely to enable recording.
