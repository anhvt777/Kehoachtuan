Kehoachtuan Forecast Module Tap Fix v6.3.3

Replace in repo root:
- index.html
- styles.css
- app.js

Fix:
- KPI rows are now <button> elements with inline onclick calling window.__fcOpen(staffId, metricKey)
  -> eliminates issues where delegated click/touch handlers don't fire.
- Badge Xem/Giao is also a <button> with inline onclick.

Open:
https://anhvt777.github.io/Kehoachtuan/?v=6.3.3
