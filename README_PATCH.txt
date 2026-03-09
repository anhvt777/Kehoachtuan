Kehoachtuan v6.4.9 - Reports Supabase Sync Fix

Fixes:
1) When storageMode=Supabase, syncAll() now loads reports from Supabase (loadReportsFromSupabase).
2) Reports filters UI now reflects stored filter state after dropdown refill.
3) If 'Chỉ việc của tôi' is on but 'Tôi là' is not selected, it auto turns off to avoid empty list.

Replace in repo root:
- index.html
- styles.css
- app.js

Open:
https://anhvt777.github.io/Kehoachtuan/?v=6.4.9&ts=1
