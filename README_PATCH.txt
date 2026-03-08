Kehoachtuan ReportsTab Fix v6.4.1

Replace in repo root:
- index.html
- styles.css
- app.js

Fix:
- Prevent site freeze if renderReports is missing (guards + noop fallback).
- Adds console info: "Kehoachtuan loaded v6.4.1"

Open:
https://anhvt777.github.io/Kehoachtuan/?v=6.4.1&ts=1
Then in Console check:
typeof renderReports
