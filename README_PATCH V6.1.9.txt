Kehoachtuan Fix Reset Dropdown v6.1.9

Replace in repo root:
- index.html
- app.js

(You may keep styles.css unchanged.)

Why it fixes:
- When using Supabase, auto-sync re-renders every N seconds and refreshDropdowns() rebuilt modal selects,
  resetting dropdown fields while you type.
- This patch:
  1) pauses auto-sync while any modal is open
  2) prevents refreshDropdowns() from running while modal is open
  3) fills task modal options only when opening the modal (fillTaskModalOptions)

Open:
https://anhvt777.github.io/Kehoachtuan/?v=6.1.9
