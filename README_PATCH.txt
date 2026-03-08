Kehoachtuan Forecast Tap Module Fix v6.3.2

Replace in repo root:
- index.html
- app.js
(styles.css unchanged)

Fix:
- Tap on KPI rows (div with data-fc-staff) now opens the input module modal reliably on iPhone.
- Adds touchend handler and prevents double-open with a debounce.
- closeModals now also closes forecast modal (fcBackdrop), so the X works.

Open:
https://anhvt777.github.io/Kehoachtuan/?v=6.3.2
