Kehoachtuan Mobile UX Patch v6.1.6

Replace in repo root:
- index.html
- styles.css
- app.js

Open:
https://anhvt777.github.io/Kehoachtuan/?v=6.1.6

Fixes:
1) Sticky bar no longer covers Add Task / Danh muc:
   - When any modal opens, body gets class 'modal-open' and CSS hides .topbar.
2) Auto-compact sticky bar while scrolling:
   - On mobile (<=720px), when scrollY > 60, .topbar becomes 'compact' and hides title + selectors + sync row.
   - Keeps only action buttons + tabs to maximize content area.
