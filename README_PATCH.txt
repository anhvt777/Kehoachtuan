Kehoachtuan v6.4.8 - Fix Report Types dropdown

Fix:
- getLists() now includes reportTypes & reportStatuses (saved in KEY_LISTS).
- Danh mục modal now renders & saves reportTypes/reportStatuses (repTypeList/repStatusList).
- Report modal uses robust string-based select population for Loại báo cáo and Trạng thái.
- Node syntax check passed.

Replace in repo root:
- index.html
- styles.css
- app.js

Open:
https://anhvt777.github.io/Kehoachtuan/?v=6.4.8&ts=1

How to set report types:
Danh mục -> Danh mục khác -> Loại báo cáo -> + Thêm -> Lưu danh mục
Then open Báo cáo -> + Thêm báo cáo, dropdown should show items.
