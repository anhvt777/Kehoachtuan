Kehoachtuan v6.4.4 - Fix renderReports not defined freeze

Replace in repo root:
- index.html
- styles.css
- app.js

Fix:
- Guard renderReports() calls so site won't freeze if user caches/mixes versions.
- Expose window.renderReports for debugging.
- Cache bust URLs.

Open:
https://anhvt777.github.io/Kehoachtuan/?v=6.4.4&ts=1
