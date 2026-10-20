---
name: Browser test resources
description: Avoid false browser-test timeouts caused by concurrent verification in this workspace.
---

Run browser-heavy regression suites sequentially, and do not capture preview screenshots while those suites are running.

**Why:** Multiple browser suites plus screenshot captures share limited workspace resources. The finance comparison exceeded its timeout under that combined load but passed quickly in isolation.

**How to apply:** Keep visual captures separate from the browser test run. Investigate a timeout in isolation before treating it as an application failure or increasing timeouts.

Deleting old PWA caches does not prove that a replacement worker controls the
page. Upgrade tests must await the actual replacement navigation before testing
offline fetch behavior.

**Why:** Cache cleanup happens before the new worker claims clients; testing in
that interval can still exercise the legacy worker and produce a false failure.

**How to apply:** Register the navigation wait before requesting the update,
then verify the reloaded interface and offline behavior. In a simulated upgrade,
finish initial registration/update jobs before switching the served worker
version; concurrent update requests can be coalesced into the old response.

Playwright video recording needs its own versioned FFmpeg download even when
the system FFmpeg command and Chromium screenshots already work.

**Why:** Recording failed at browser page creation because Playwright's expected
media executable was absent; the system FFmpeg installation did not satisfy it.

**How to apply:** If the error explicitly names Playwright's missing FFmpeg,
install only its media binary with the existing Playwright CLI. Do not replace
the app's dependencies or install a second browser merely to enable recording.
