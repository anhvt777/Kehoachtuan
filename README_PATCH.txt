Kehoachtuan Forecast Modal Save/Close Fix v6.3.6

Replace in repo root:
- index.html
- app.js
- styles.css

Fixes:
- Prevent page reload on forecast modal Save (bind fcForm submit -> preventDefault -> saveForecastModal()).
- Enable closing forecast modal (X / Đóng / click backdrop).
- Remove overly aggressive global capture listeners that caused unexpected modal opens.
- Replace corrupted forecast event wiring with a clean, stable block.

Open:
https://anhvt777.github.io/Kehoachtuan/?v=6.3.6&ts=1
