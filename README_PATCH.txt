Kehoachtuan Forecast Module Ultimate Fix v6.3.4

Replace in repo root:
- index.html
- app.js
- styles.css (unchanged but included)

Fix strategy:
1) Define window.__fcOpen / window.__fcBadge next to openForecastModal (not dependent on init string matching).
2) Add fallback capture listeners (pointerdown + touchstart) to open the modal even if inline onclick doesn't fire.
3) Add clear alerts if fcBackdrop modal is missing or other runtime errors occur.

Open:
https://anhvt777.github.io/Kehoachtuan/?v=6.3.4&ts=1
