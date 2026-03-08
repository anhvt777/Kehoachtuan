Kehoachtuan Task Permission Patch v6.1.8

Replace in repo root:
- index.html
- styles.css
- app.js

Open:
https://anhvt777.github.io/Kehoachtuan/?v=6.1.8

Rules implemented:
- Staff can EDIT tasks that are assigned to them (ownerId==me) OR tasks they created (assignedById==me).
- Staff can DELETE only tasks they created (assignedById==me).
- Tasks assigned by manager (Vo Tuan Anh) cannot be deleted by assignees; only updated.
- Managers can edit/delete all tasks.

Note:
This is UI-level control. For true enforcement, add Supabase RLS rules.
