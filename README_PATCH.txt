Kehoachtuan Styles Fix Patch v6.1.4

Problem:
- styles.css in v6.1.3 was missing the BIDV base theme (:root variables, layout, modal/table styles),
  so the page looked like raw HTML even though styles.css loaded 200 OK.

Fix:
- Replace BOTH files in repo root:
  1) index.html
  2) styles.css

Then open:
https://anhvt777.github.io/Kehoachtuan/?v=6.1.4
(or Ctrl+F5 / Incognito)

Notes:
- app.js/config.js can stay as-is.
