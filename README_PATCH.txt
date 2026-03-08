Kehoachtuan Global Handler Fix v6.3.5

Replace in repo root:
- index.html
- app.js
- styles.css

Fix:
- Define window.__fcOpen and window.__fcBadge immediately after 'use strict' (top of app.js),
  so inline onclick always finds a function (prevents 'window.__fcOpen is not a function').

Open:
https://anhvt777.github.io/Kehoachtuan/?v=6.3.5&ts=1

After load, in Console you should see:
typeof window.__fcOpen === 'function'
