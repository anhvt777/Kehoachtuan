/* Kehoachtuan v5.0.0 - GitHub Pages (LocalStorage/Supabase) - Mobile-friendly */
(() => {
  "use strict";

  const CFG = window.CONFIG || {};
  const VERSION = "5.0.0";

  // ---------- Helpers ----------
  const $ = (s) => document.querySelector(s);
  const $$ = (s) => Array.from(document.querySelectorAll(s));
  const pad2 = (n) => String(n).padStart(2, "0");

  function toISODate(d) {
    return `${d.getFullYear()}-${pad2(d.getMonth()+1)}-${pad2(d.getDate())}`;
  }
  function parseISODate(s) {
    if (!s) return null;
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(s).trim());
    if (!m) return null;
    const y = Number(m[1]), mo = Number(m[2]), da = Number(m[3]);
    if (!y || !mo || !da) return null;
    return new Date(y, mo-1, da);
  }
  function formatDDMMYYYY(iso) {
    const d = parseISODate(iso);
    if (!d) return "";
    return `${pad2(d.getDate())}/${pad2(d.getMonth()+1)}/${d.getFullYear()}`;
  }
  function mondayOf(d) {
    const x = new Date(d.getFullYear(), d.getMonth(), d.getDate());
    const day = x.getDay(); // 0 Sun
    const diff = (day === 0 ? -6 : 1) - day;
    x.setDate(x.getDate() + diff);
    x.setHours(0,0,0,0);
    return x;
  }
  function today0() {
    const t = new Date(); t.setHours(0,0,0,0); return t;
  }
  function escapeHtml(s) {
    return String(s ?? "").replace(/[&<>"']/g, (c) => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
  }
  function pickWeekStartISO(iso) {
    const d = parseISODate(iso);
    if (!d) return toISODate(mondayOf(new Date()));
    return toISODate(mondayOf(d));
  }

  // ---------- Local keys ----------
  const KEY_LISTS = "kehoachtuan.lists.v5";
  const KEY_SETTINGS = "kehoachtuan.settings.v5";
  const KEY_TASKS_LOCAL = "kehoachtuan.tasks.v5";

  // ---------- Settings ----------
  function loadSettings() {
    const raw = localStorage.getItem(KEY_SETTINGS);
    if (!raw) return null;
    try { return JSON.parse(raw); } catch { return null; }
  }
  function saveSettings(s) {
    localStorage.setItem(KEY_SETTINGS, JSON.stringify(s));
  }
  function getSettings() {
    const s = loadSettings() || {};
    return {
      storageMode: s.storageMode || "local",
      supabaseUrl: s.supabaseUrl || "",
      supabaseAnonKey: s.supabaseAnonKey || "",
      syncSeconds: Number(s.syncSeconds || 5),
    };
  }

  // ---------- Lists (dropdown) ----------
  function loadLists() {
    const raw = localStorage.getItem(KEY_LISTS);
    if (!raw) return null;
    try { return JSON.parse(raw); } catch { return null; }
  }
  function saveLists(lists) {
    localStorage.setItem(KEY_LISTS, JSON.stringify(lists));
  }
  function getLists() {
    const saved = loadLists() || {};
    return {
      staff: saved.staff || CFG.staff || [],
      groups: saved.groups || CFG.groups || [],
      statuses: saved.statuses || CFG.statuses || ["Not started","Doing","Done","Blocked"],
      priorities: saved.priorities || CFG.priorities || ["A","B","C"],
      kpis: saved.kpis || CFG.kpis || [],
      outputMetrics: saved.outputMetrics || CFG.outputMetrics || [],
    };
  }

  function staffById(lists, id) {
    return (lists.staff || []).find((x) => String(x.id) === String(id)) || null;
  }

  // ---------- State ----------
  const state = {
    weekStartISO: pickWeekStartISO(toISODate(new Date())),
    meId: "",
    filterAssignee: "",
    filterStatus: "",
    filterGroup: "",
    onlyOverdue: false,
    tasks: [],
    lastSyncAt: null,
    syncing: false,
  };

  // ---------- DOM refs ----------
  const elWeek = $("#weekPicker");
  const elMe = $("#mePicker");
  const elBtnAdd = $("#btnAdd");
  const elBtnExport = $("#btnExport");
  const elBtnLists = $("#btnLists");

  const elTblBody = $("#tasksTbody");
  const elSumTotal = $("#sumTotal");
  const elSumDone = $("#sumDone");
  const elSumOverdue = $("#sumOverdue");
  const elSumPct = $("#sumPct");

  const elFilterAssignee = $("#filterAssignee");
  const elFilterStatus = $("#filterStatus");
  const elFilterGroup = $("#filterGroup");
  const elFilterOverdue = $("#filterOverdue");
  const elBtnClearFilter = $("#btnClearFilter");

  const syncDot = $("#syncDot");
  const syncText = $("#syncText");

  // Task modal
  const taskBackdrop = $("#taskBackdrop");
  const taskClose = $("#taskClose");
  const taskTitle = $("#taskTitle");
  const taskForm = $("#taskForm");
  const btnCancel = $("#btnCancel");
  const fmId = $("#fmId");
  const fmGroup = $("#fmGroup");
  const fmOwner = $("#fmOwner");
  const fmTitle = $("#fmTitle");
  const fmDeadline = $("#fmDeadline");
  const fmStatus = $("#fmStatus");
  const fmPriority = $("#fmPriority");
  const fmCarry = $("#fmCarry");
  const fmKpi = $("#fmKpi");
  const fmMetric = $("#fmMetric");
  const fmCommit = $("#fmCommit");
  const fmActual = $("#fmActual");
  const fmNote = $("#fmNote");

  // Lists modal
  const listsBackdrop = $("#listsBackdrop");
  const listsClose = $("#listsClose");
  const btnListsCancel = $("#btnListsCancel");
  const btnListsSave = $("#btnListsSave");

  const staffList = $("#staffList");
  const statusList = $("#statusList");
  const groupList = $("#groupList");
  const priorityList = $("#priorityList");
  const kpiList = $("#kpiList");
  const metricList = $("#metricList");

  const btnAddStaff = $("#btnAddStaff");
  const btnAddStatus = $("#btnAddStatus");
  const btnAddGroup = $("#btnAddGroup");
  const btnAddPriority = $("#btnAddPriority");
  const btnAddKpi = $("#btnAddKpi");
  const btnAddMetric = $("#btnAddMetric");

  const stMode = $("#stMode");
  const stInterval = $("#stInterval");
  const stUrl = $("#stUrl");
  const stKey = $("#stKey");

  // ---------- Modal management (avoid 2 modals stacked) ----------
  function closeAllModals() {
    taskBackdrop.classList.remove("open");
    listsBackdrop.classList.remove("open");
    document.body.style.overflow = "";
  }
  function openBackdrop(which) {
    closeAllModals();
    which.classList.add("open");
    document.body.style.overflow = "hidden";
  }
  function isDone(status) {
    return String(status || "").toLowerCase() === "done";
  }
  function isOverdue(task) {
    if (!task.deadline) return false;
    if (isDone(task.status)) return false;
    const dl = parseISODate(task.deadline);
    if (!dl) return false;
    const t0 = today0();
    dl.setHours(0,0,0,0);
    return dl < t0;
  }

  // ---------- Dropdown fills ----------
  function fillSelect(el, items, {
    valueKey = null,
    labelFn = null,
    emptyLabel = null,
  } = {}) {
    el.innerHTML = "";
    if (emptyLabel !== null) {
      const opt = document.createElement("option");
      opt.value = "";
      opt.textContent = emptyLabel;
      el.appendChild(opt);
    }
    for (const it of items) {
      const opt = document.createElement("option");
      opt.value = valueKey ? String(it[valueKey] ?? "") : String(it ?? "");
      opt.textContent = labelFn ? labelFn(it) : String(it?.name ?? it);
      el.appendChild(opt);
    }
  }

  function refreshDropdowns() {
    const lists = getLists();

    fillSelect(elMe, lists.staff, {
      valueKey: "id",
      labelFn: (s) => `${s.id} - ${s.name}`,
      emptyLabel: "-- Chọn --"
    });
    fillSelect(fmOwner, lists.staff, {
      valueKey: "id",
      labelFn: (s) => `${s.id} - ${s.name}`,
      emptyLabel: "-- Chọn --"
    });
    fillSelect(elFilterAssignee, lists.staff, {
      valueKey: "id",
      labelFn: (s) => s.name,
      emptyLabel: "-- Lọc theo CB đầu mối --"
    });

    fillSelect(fmGroup, lists.groups, { emptyLabel: "-- Chọn --" });
    fillSelect(elFilterGroup, lists.groups, { emptyLabel: "-- Lọc theo nhóm việc --" });

    fillSelect(fmStatus, lists.statuses, { emptyLabel: "-- Chọn --" });
    fillSelect(elFilterStatus, lists.statuses, { emptyLabel: "-- Lọc theo trạng thái --" });

    fillSelect(fmPriority, lists.priorities, { emptyLabel: "-- Chọn --" });
    fillSelect(fmCarry, ["Y","N"], { emptyLabel: "-- Chọn --" });

    fillSelect(fmKpi, lists.kpis, { emptyLabel: "-- (tuỳ chọn) --" });
    fillSelect(fmMetric, lists.outputMetrics, { emptyLabel: "-- (tuỳ chọn) --" });

    // preserve selections
    if (state.meId) elMe.value = state.meId;
    if (state.filterAssignee) elFilterAssignee.value = state.filterAssignee;
    if (state.filterStatus) elFilterStatus.value = state.filterStatus;
    if (state.filterGroup) elFilterGroup.value = state.filterGroup;
  }

  // ---------- Local tasks ----------
  function loadTasksLocal() {
    const raw = localStorage.getItem(KEY_TASKS_LOCAL);
    if (!raw) return [];
    try {
      const arr = JSON.parse(raw);
      return Array.isArray(arr) ? arr : [];
    } catch {
      return [];
    }
  }
  function saveTasksLocal(tasks) {
    localStorage.setItem(KEY_TASKS_LOCAL, JSON.stringify(tasks));
  }

  // ---------- Supabase REST ----------
  function sbHeaders() {
    const s = getSettings();
    const key = s.supabaseAnonKey.trim();
    return {
      "apikey": key,
      "Authorization": `Bearer ${key}`,
      "Content-Type": "application/json",
      "Prefer": "return=representation"
    };
  }
  function sbUrl(path) {
    const s = getSettings();
    const base = s.supabaseUrl.trim().replace(/\/+$/,"");
    return `${base}/rest/v1/${path}`;
  }
  async function sbFetchTasks() {
    // For small team: fetch all tasks, client filters by week
    const url = sbUrl("tasks?select=*&order=updated_at.desc&limit=5000");
    const res = await fetch(url, { headers: sbHeaders() });
    if (!res.ok) throw new Error(`Supabase read failed: ${res.status}`);
    const data = await res.json();
    return (Array.isArray(data) ? data : []).map(normalizeFromDB);
  }
  async function sbInsertTask(task) {
    const url = sbUrl("tasks");
    const payload = [denormalizeToDB(task)];
    const res = await fetch(url, {
      method: "POST",
      headers: sbHeaders(),
      body: JSON.stringify(payload),
    });
    if (!res.ok) throw new Error(`Supabase insert failed: ${res.status}`);
    const rows = await res.json();
    return normalizeFromDB(rows[0]);
  }
  async function sbUpdateTask(task) {
    const url = sbUrl(`tasks?id=eq.${encodeURIComponent(task.id)}`);
    const payload = denormalizeToDB(task);
    const res = await fetch(url, {
      method: "PATCH",
      headers: sbHeaders(),
      body: JSON.stringify(payload),
    });
    if (!res.ok) throw new Error(`Supabase update failed: ${res.status}`);
    const rows = await res.json();
    return normalizeFromDB(rows[0]);
  }
  async function sbDeleteTask(id) {
    const url = sbUrl(`tasks?id=eq.${encodeURIComponent(id)}`);
    const res = await fetch(url, {
      method: "DELETE",
      headers: sbHeaders(),
    });
    if (!res.ok) throw new Error(`Supabase delete failed: ${res.status}`);
  }

  function normalizeFromDB(row) {
    // DB -> app task
    return {
      id: row.id,
      seq: row.seq ?? null,
      weekStart: row.week_start ? String(row.week_start) : "",
      group: row.group_name || "",
      title: row.title || "",
      deadline: row.deadline ? String(row.deadline) : "",
      status: row.status || "Not started",
      priority: row.priority || "B",
      kpi: row.kpi || "",
      metric: row.metric || "",
      commit: row.commit ?? "",
      actual: row.actual ?? "",
      carryOver: (row.carry_over || "Y").toUpperCase(),
      ownerId: row.owner_id || "",
      ownerName: row.owner_name || "",
      note: row.note || "",
      assignedById: row.assigned_by_id || "",
      assignedByName: row.assigned_by_name || "",
      createdAt: row.created_at || "",
      updatedAt: row.updated_at || "",
    };
  }
  function denormalizeToDB(t) {
    return {
      id: t.id,
      seq: t.seq ?? null,
      week_start: t.weekStart,
      group_name: t.group,
      title: t.title,
      deadline: t.deadline || null,
      status: t.status,
      priority: t.priority,
      kpi: t.kpi || null,
      metric: t.metric || null,
      commit: t.commit === "" ? null : t.commit,
      actual: t.actual === "" ? null : t.actual,
      carry_over: t.carryOver || "Y",
      owner_id: t.ownerId,
      owner_name: t.ownerName,
      note: t.note || null,
      assigned_by_id: t.assignedById || null,
      assigned_by_name: t.assignedByName || null,
    };
  }

  // ---------- Visible tasks logic ----------
  function getVisibleTasks() {
    const weekISO = state.weekStartISO;
    const lists = getLists();

    const base = state.tasks.filter((t) => {
      if (!weekISO) return false;
      if (t.weekStart === weekISO) return true;
      if (t.weekStart && t.weekStart < weekISO && String(t.carryOver || "Y").toUpperCase() === "Y" && !isDone(t.status)) return true;
      return false;
    });

    const filtered = base.filter((t) => {
      if (state.filterAssignee && String(t.ownerId) !== String(state.filterAssignee)) return false;
      if (state.filterStatus && String(t.status) !== String(state.filterStatus)) return false;
      if (state.filterGroup && String(t.group) !== String(state.filterGroup)) return false;
      if (state.onlyOverdue && !isOverdue(t)) return false;
      return true;
    });

    return filtered.map((t) => {
      const owner = staffById(lists, t.ownerId);
      return {
        ...t,
        ownerName: owner ? owner.name : (t.ownerName || t.ownerId),
      };
    }).sort((a,b) => {
      const ao = isOverdue(a) ? 0 : 1;
      const bo = isOverdue(b) ? 0 : 1;
      if (ao !== bo) return ao - bo;
      if ((a.deadline || "") !== (b.deadline || "")) return (a.deadline || "").localeCompare(b.deadline || "");
      const as = Number(a.seq ?? 0), bs = Number(b.seq ?? 0);
      if (as !== bs) return bs - as;
      return (a.updatedAt || "").localeCompare(b.updatedAt || "");
    });
  }

  // ---------- Render ----------
  function renderSummary(visible) {
    const total = visible.length;
    const done = visible.filter((t) => isDone(t.status)).length;
    const overdue = visible.filter((t) => isOverdue(t)).length;
    const pct = total ? Math.round((done / total) * 100) : 0;
    elSumTotal.textContent = String(total);
    elSumDone.textContent = String(done);
    elSumOverdue.textContent = String(overdue);
    elSumPct.textContent = `${pct}%`;
  }

  function renderTable() {
    const visible = getVisibleTasks();
    renderSummary(visible);

    if (!visible.length) {
      elTblBody.innerHTML = `<tr><td colspan="8" style="color:var(--muted);padding:18px">Chưa có công việc trong tuần này. Bấm “+ Thêm việc”.</td></tr>`;
      return;
    }

    const rows = visible.map((t) => {
      const overdue = isOverdue(t);
      const idLabel = t.seq ? `#${t.seq}` : (t.id ? t.id.slice(0,8) : "");
      const badge = overdue ? `<span class="badge overdue">Quá hạn</span>` : "";
      const note = t.note ? escapeHtml(t.note) : "";
      return `
      <tr>
        <td data-label="ID"><span class="badge">${escapeHtml(idLabel)}</span> ${badge}</td>
        <td data-label="Nhóm công việc">${escapeHtml(t.group || "")}</td>
        <td data-label="Công việc / Hoạt động">${escapeHtml(t.title || "")}
          <div class="smallHelp">
            ${t.kpi ? `KPI: <b>${escapeHtml(t.kpi)}</b> • ` : ""}
            ${t.metric ? `Metric: <b>${escapeHtml(t.metric)}</b> • ` : ""}
            ${t.commit !== "" && t.commit !== null ? `Commit: <b>${escapeHtml(t.commit)}</b> • ` : ""}
            ${t.actual !== "" && t.actual !== null ? `Actual: <b>${escapeHtml(t.actual)}</b> • ` : ""}
            Priority: <b>${escapeHtml(t.priority || "")}</b> • CarryOver: <b>${escapeHtml(t.carryOver || "Y")}</b>
            ${t.assignedByName ? ` • Giao bởi: <b>${escapeHtml(t.assignedByName)}</b>` : ""}
          </div>
        </td>
        <td data-label="Deadline">${escapeHtml(formatDDMMYYYY(t.deadline))}</td>
        <td data-label="CB đầu mối">${escapeHtml(t.ownerName || t.ownerId || "")}</td>
        <td data-label="Trạng thái">${escapeHtml(t.status || "")}</td>
        <td data-label="Kết quả / Ghi chú">${note}</td>
        <td data-label="Tác vụ">
          <div class="actions">
            <button class="btnSm" data-act="edit" data-id="${escapeHtml(t.id)}">Sửa</button>
            <button class="btnSm danger" data-act="del" data-id="${escapeHtml(t.id)}">Xoá</button>
          </div>
        </td>
      </tr>`;
    }).join("");

    elTblBody.innerHTML = rows;
  }

  // ---------- Sync indicator ----------
  function setSyncUI({ ok=true, text="" }={}) {
    syncDot.classList.toggle("warn", !ok);
    syncText.textContent = text;
  }
  function formatTime(d) {
    return `${pad2(d.getHours())}:${pad2(d.getMinutes())}:${pad2(d.getSeconds())}`;
  }

  // ---------- CRUD ----------
  function openTaskModal(mode, task=null) {
    openBackdrop(taskBackdrop);
    taskTitle.textContent = (mode === "edit") ? "Sửa công việc" : "Thêm công việc";
    taskForm.reset();

    // defaults
    fmCarry.value = "Y";
    fmPriority.value = "B";
    fmStatus.value = "Not started";
    fmOwner.value = state.meId || "";

    fmId.value = task ? String(task.id) : "";

    if (task) {
      fmGroup.value = task.group || "";
      fmOwner.value = task.ownerId || "";
      fmTitle.value = task.title || "";
      fmDeadline.value = task.deadline || "";
      fmStatus.value = task.status || "Not started";
      fmPriority.value = task.priority || "B";
      fmCarry.value = (task.carryOver || "Y").toUpperCase();
      fmKpi.value = task.kpi || "";
      fmMetric.value = task.metric || "";
      fmCommit.value = (task.commit ?? "") === null ? "" : String(task.commit ?? "");
      fmActual.value = (task.actual ?? "") === null ? "" : String(task.actual ?? "");
      fmNote.value = task.note || "";
    }
  }

  function validateTaskForm() {
    const errs = [];
    if (!state.weekStartISO) errs.push("Bạn chưa chọn Tuần.");
    if (!state.meId) errs.push("Bạn chưa chọn “Tôi là”.");
    if (!fmGroup.value) errs.push("Bạn chưa chọn Nhóm công việc.");
    if (!fmOwner.value) errs.push("Bạn chưa chọn CB đầu mối.");
    if (!fmTitle.value.trim()) errs.push("Bạn chưa nhập Công việc / Hoạt động.");
    if (!fmDeadline.value) errs.push("Bạn chưa chọn Deadline.");
    if (!fmStatus.value) errs.push("Bạn chưa chọn Trạng thái.");
    return errs;
  }

  function nextSeq(tasks) {
    let max = 0;
    for (const t of tasks) {
      const n = Number(t.seq || 0);
      if (!Number.isNaN(n)) max = Math.max(max, n);
    }
    return max + 1;
  }

  async function upsertTask() {
    const errs = validateTaskForm();
    if (errs.length) {
      alert(errs.join("\n"));
      return;
    }

    const lists = getLists();
    const owner = staffById(lists, fmOwner.value);
    const me = staffById(lists, state.meId);

    const isEdit = !!fmId.value;
    const nowIso = new Date().toISOString();

    const t = {
      id: isEdit ? String(fmId.value) : (crypto.randomUUID ? crypto.randomUUID() : String(Math.random()).slice(2)),
      seq: isEdit ? null : nextSeq(state.tasks),
      weekStart: state.weekStartISO,
      group: fmGroup.value,
      title: fmTitle.value.trim(),
      deadline: fmDeadline.value,
      status: fmStatus.value,
      priority: fmPriority.value || "B",
      kpi: fmKpi.value || "",
      metric: fmMetric.value || "",
      commit: fmCommit.value === "" ? "" : Number(fmCommit.value),
      actual: fmActual.value === "" ? "" : Number(fmActual.value),
      carryOver: (fmCarry.value || "Y").toUpperCase(),
      ownerId: String(fmOwner.value),
      ownerName: owner ? owner.name : "",
      note: fmNote.value.trim(),
      assignedById: state.meId || "",
      assignedByName: me ? me.name : "",
      updatedAt: nowIso,
    };

    const settings = getSettings();
    try {
      setSyncUI({ ok:true, text:`${settings.storageMode} • đang lưu...` });
      if (settings.storageMode === "supabase") {
        if (isEdit) {
          const saved = await sbUpdateTask(t);
          state.tasks = state.tasks.map(x => x.id === saved.id ? saved : x);
        } else {
          const saved = await sbInsertTask(t);
          state.tasks = [saved, ...state.tasks];
        }
      } else {
        if (isEdit) {
          state.tasks = state.tasks.map(x => x.id === t.id ? {...x, ...t} : x);
        } else {
          state.tasks = [t, ...state.tasks];
        }
        saveTasksLocal(state.tasks);
      }
      closeAllModals();
      renderTable();
      markSynced(true);
    } catch (e) {
      console.error(e);
      alert("Lưu không thành công. Kiểm tra Storage mode / Supabase URL / anon key.\n" + (e?.message || e));
      markSynced(false);
    }
  }

  async function deleteTask(id) {
    const settings = getSettings();
    if (!confirm("Xoá công việc này?")) return;

    try {
      setSyncUI({ ok:true, text:`${settings.storageMode} • đang xoá...` });
      if (settings.storageMode === "supabase") {
        await sbDeleteTask(id);
        state.tasks = state.tasks.filter(x => x.id !== id);
      } else {
        state.tasks = state.tasks.filter(x => x.id !== id);
        saveTasksLocal(state.tasks);
      }
      renderTable();
      markSynced(true);
    } catch (e) {
      console.error(e);
      alert("Xoá không thành công. " + (e?.message || e));
      markSynced(false);
    }
  }

  // ---------- Export report ----------
  function buildWeeklyReport() {
    const visible = getVisibleTasks();
    const week = state.weekStartISO || "";
    const lists = getLists();

    const sheetTasks = [
      ["WeekStart", week],
      [],
      ["Seq","Group","Title","Deadline(dd/mm/yyyy)","OwnerID","OwnerName","Status","KPI","Metric","Commit","Actual","Priority","CarryOver","AssignedByID","AssignedByName","Note"]
    ];
    for (const t of visible) {
      sheetTasks.push([
        t.seq ?? "",
        t.group || "",
        t.title || "",
        formatDDMMYYYY(t.deadline),
        t.ownerId || "",
        t.ownerName || "",
        t.status || "",
        t.kpi || "",
        t.metric || "",
        t.commit ?? "",
        t.actual ?? "",
        t.priority || "",
        t.carryOver || "",
        t.assignedById || "",
        t.assignedByName || "",
        t.note || "",
      ]);
    }

    const byStaff = {};
    for (const t of visible) {
      const sid = String(t.ownerId || "");
      if (!byStaff[sid]) byStaff[sid] = { total:0, done:0, overdue:0, commit:0, actual:0 };
      byStaff[sid].total += 1;
      if (isDone(t.status)) byStaff[sid].done += 1;
      if (isOverdue(t)) byStaff[sid].overdue += 1;
      const c = Number(t.commit);
      if (!Number.isNaN(c)) byStaff[sid].commit += c;
      const a = Number(t.actual);
      if (!Number.isNaN(a)) byStaff[sid].actual += a;
    }

    const sheetSummary = [
      ["WeekStart", week],
      [],
      ["OwnerID","OwnerName","TotalTasks","Done","Overdue","%Complete","SumCommit","SumActual"]
    ];
    for (const s of lists.staff) {
      const sid = String(s.id);
      const m = byStaff[sid] || { total:0, done:0, overdue:0, commit:0, actual:0 };
      const pct = m.total ? Math.round((m.done / m.total) * 100) : 0;
      sheetSummary.push([sid, s.name, m.total, m.done, m.overdue, `${pct}%`, m.commit, m.actual]);
    }

    return { sheetTasks, sheetSummary, week };
  }

  function downloadBlob(filename, blob) {
    const a = document.createElement("a");
    const url = URL.createObjectURL(blob);
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
      URL.revokeObjectURL(url);
      a.remove();
    }, 0);
  }

  function exportWeekly() {
    const { sheetTasks, sheetSummary, week } = buildWeeklyReport();
    const fname = `BaoCao_Tuan_${week || "NA"}.xlsx`;

    if (window.XLSX && window.XLSX.utils) {
      const wb = window.XLSX.utils.book_new();
      const ws1 = window.XLSX.utils.aoa_to_sheet(sheetTasks);
      const ws2 = window.XLSX.utils.aoa_to_sheet(sheetSummary);
      window.XLSX.utils.book_append_sheet(wb, ws1, "TASKS_WEEK");
      window.XLSX.utils.book_append_sheet(wb, ws2, "SUMMARY_BY_STAFF");
      window.XLSX.writeFile(wb, fname);
      return;
    }

    const toCSV = (aoa) => aoa.map((row) => row.map((cell) => {
      const s = String(cell ?? "");
      if (s.includes('"') || s.includes(",") || s.includes("\n")) return `"${s.replaceAll('"','""')}"`;
      return s;
    }).join(",")).join("\n");

    downloadBlob(`TASKS_WEEK_${week}.csv`, new Blob([toCSV(sheetTasks)], { type:"text/csv;charset=utf-8" }));
    downloadBlob(`SUMMARY_BY_STAFF_${week}.csv`, new Blob([toCSV(sheetSummary)], { type:"text/csv;charset=utf-8" }));
    alert("Không tải được thư viện XLSX (CDN bị chặn). Hệ thống đã xuất CSV thay thế.");
  }

  // ---------- Lists modal render ----------
  function makeRow2(a, b, onDel) {
    const row = document.createElement("div");
    row.className = "listRow";
    const in1 = document.createElement("input");
    const in2 = document.createElement("input");
    in1.value = a || "";
    in2.value = b || "";
    const del = document.createElement("button");
    del.type = "button";
    del.textContent = "Xoá";
    del.addEventListener("click", () => onDel());
    row.appendChild(in1);
    row.appendChild(in2);
    row.appendChild(del);
    return { row, in1, in2 };
  }
  function makeRow1(a, onDel) {
    const row = document.createElement("div");
    row.className = "listRow";
    row.style.gridTemplateColumns = "1fr auto";
    const in1 = document.createElement("input");
    in1.value = a || "";
    const del = document.createElement("button");
    del.type = "button";
    del.textContent = "Xoá";
    del.addEventListener("click", () => onDel());
    row.appendChild(in1);
    row.appendChild(del);
    return { row, in1 };
  }

  let draftLists = null;
  let draftSettings = null;

  function openListsModal() {
    // populate drafts
    draftLists = structuredClone ? structuredClone(getLists()) : JSON.parse(JSON.stringify(getLists()));
    draftSettings = structuredClone ? structuredClone(getSettings()) : JSON.parse(JSON.stringify(getSettings()));

    // settings -> UI
    stMode.value = draftSettings.storageMode;
    stInterval.value = String(draftSettings.syncSeconds || 5);
    stUrl.value = draftSettings.supabaseUrl || "";
    stKey.value = draftSettings.supabaseAnonKey || "";

    renderListsDraft();
    openBackdrop(listsBackdrop);
  }

  function renderListsDraft() {
    // staff
    staffList.innerHTML = "";
    draftLists.staff.forEach((s, idx) => {
      const r = makeRow2(String(s.id || ""), String(s.name || ""), () => {
        draftLists.staff.splice(idx, 1);
        renderListsDraft();
      });
      r.in1.placeholder = "StaffID";
      r.in2.placeholder = "Tên";
      staffList.appendChild(r.row);
      r.in1.addEventListener("input", () => draftLists.staff[idx].id = r.in1.value.trim());
      r.in2.addEventListener("input", () => draftLists.staff[idx].name = r.in2.value.trim());
    });

    // statuses
    statusList.innerHTML = "";
    draftLists.statuses.forEach((x, idx) => {
      const r = makeRow1(String(x || ""), () => {
        draftLists.statuses.splice(idx, 1);
        renderListsDraft();
      });
      statusList.appendChild(r.row);
      r.in1.addEventListener("input", () => draftLists.statuses[idx] = r.in1.value.trim());
    });

    // groups
    groupList.innerHTML = "";
    draftLists.groups.forEach((x, idx) => {
      const r = makeRow1(String(x || ""), () => {
        draftLists.groups.splice(idx, 1);
        renderListsDraft();
      });
      groupList.appendChild(r.row);
      r.in1.addEventListener("input", () => draftLists.groups[idx] = r.in1.value.trim());
    });

    // priorities
    priorityList.innerHTML = "";
    draftLists.priorities.forEach((x, idx) => {
      const r = makeRow1(String(x || ""), () => {
        draftLists.priorities.splice(idx, 1);
        renderListsDraft();
      });
      priorityList.appendChild(r.row);
      r.in1.addEventListener("input", () => draftLists.priorities[idx] = r.in1.value.trim());
    });

    // kpis
    kpiList.innerHTML = "";
    draftLists.kpis.forEach((x, idx) => {
      const r = makeRow1(String(x || ""), () => {
        draftLists.kpis.splice(idx, 1);
        renderListsDraft();
      });
      kpiList.appendChild(r.row);
      r.in1.addEventListener("input", () => draftLists.kpis[idx] = r.in1.value.trim());
    });

    // metrics
    metricList.innerHTML = "";
    draftLists.outputMetrics.forEach((x, idx) => {
      const r = makeRow1(String(x || ""), () => {
        draftLists.outputMetrics.splice(idx, 1);
        renderListsDraft();
      });
      metricList.appendChild(r.row);
      r.in1.addEventListener("input", () => draftLists.outputMetrics[idx] = r.in1.value.trim());
    });
  }

  function saveListsAndSettings() {
    // sanitize
    const cleanStaff = (draftLists.staff || []).map(s => ({
      id: String(s.id || "").trim(),
      name: String(s.name || "").trim(),
    })).filter(s => s.id && s.name);

    draftLists.staff = cleanStaff;
    draftLists.groups = (draftLists.groups || []).map(x => String(x||"").trim()).filter(Boolean);
    draftLists.statuses = (draftLists.statuses || []).map(x => String(x||"").trim()).filter(Boolean);
    draftLists.priorities = (draftLists.priorities || []).map(x => String(x||"").trim()).filter(Boolean);
    draftLists.kpis = (draftLists.kpis || []).map(x => String(x||"").trim()).filter(Boolean);
    draftLists.outputMetrics = (draftLists.outputMetrics || []).map(x => String(x||"").trim()).filter(Boolean);

    // settings from UI
    draftSettings.storageMode = stMode.value;
    draftSettings.syncSeconds = Math.max(2, Number(stInterval.value || 5));
    draftSettings.supabaseUrl = stUrl.value.trim();
    draftSettings.supabaseAnonKey = stKey.value.trim();

    saveLists(draftLists);
    saveSettings(draftSettings);

    refreshDropdowns();
    closeAllModals();
    setupSyncLoop(); // restart sync with new settings
    renderTable();
    markSynced(true);
  }

  // ---------- Sync loop (polling) ----------
  let syncTimer = null;

  function markSynced(ok) {
    const s = getSettings();
    const t = new Date();
    state.lastSyncAt = t;
    if (ok) {
      setSyncUI({ ok:true, text:`${s.storageMode} • synced ${formatTime(t)}` });
    } else {
      setSyncUI({ ok:false, text:`${s.storageMode} • lỗi sync` });
    }
  }

  async function syncOnce() {
    const s = getSettings();
    if (s.storageMode !== "supabase") return; // local doesn't need polling
    if (state.syncing) return;
    if (!s.supabaseUrl || !s.supabaseAnonKey) return;

    state.syncing = true;
    try {
      const tasks = await sbFetchTasks();
      // cheap compare by length + max updatedAt
      const maxNew = tasks.reduce((m, t) => (t.updatedAt && t.updatedAt > m ? t.updatedAt : m), "");
      const maxOld = state.tasks.reduce((m, t) => (t.updatedAt && t.updatedAt > m ? t.updatedAt : m), "");
      if (tasks.length !== state.tasks.length || maxNew !== maxOld) {
        state.tasks = tasks;
        renderTable();
      }
      markSynced(true);
    } catch (e) {
      console.error(e);
      markSynced(false);
    } finally {
      state.syncing = false;
    }
  }

  function setupSyncLoop() {
    if (syncTimer) {
      clearInterval(syncTimer);
      syncTimer = null;
    }

    const s = getSettings();
    // UI tag
    setSyncUI({ ok:true, text:`${s.storageMode} • ready` });

    if (s.storageMode !== "supabase") return;

    // run once immediately
    syncOnce();

    const sec = Math.max(2, Number(s.syncSeconds || 5));
    syncTimer = setInterval(() => {
      // pause when tab hidden (saves battery)
      if (document.hidden) return;
      syncOnce();
    }, sec * 1000);
  }

  // ---------- Table actions ----------
  function onTableClick(e) {
    const btn = e.target.closest("button[data-act]");
    if (!btn) return;
    const act = btn.getAttribute("data-act");
    const id = btn.getAttribute("data-id");
    const t = state.tasks.find(x => String(x.id) === String(id));
    if (!t) return;

    if (act === "edit") {
      openTaskModal("edit", t);
      return;
    }
    if (act === "del") {
      deleteTask(id);
      return;
    }
  }

  // ---------- Load initial tasks ----------
  async function loadInitialTasks() {
    const s = getSettings();
    if (s.storageMode === "supabase" && s.supabaseUrl && s.supabaseAnonKey) {
      try {
        state.tasks = await sbFetchTasks();
        markSynced(true);
      } catch (e) {
        console.error(e);
        // fallback to local so app still usable
        state.tasks = loadTasksLocal();
        markSynced(false);
        alert("Không tải được dữ liệu Supabase. Tạm dùng local. Kiểm tra URL/anon key hoặc RLS.");
      }
    } else {
      state.tasks = loadTasksLocal();
      markSynced(true);
    }
  }

  // ---------- Wire events ----------
  function wireEvents() {
    elWeek.addEventListener("change", () => {
      state.weekStartISO = pickWeekStartISO(elWeek.value);
      elWeek.value = state.weekStartISO;
      renderTable();
    });

    elMe.addEventListener("change", () => {
      state.meId = elMe.value || "";
    });

    elBtnAdd.addEventListener("click", () => {
      if (!state.meId) {
        alert("Bạn cần chọn “Tôi là” trước khi thêm việc.");
        return;
      }
      openTaskModal("add");
    });

    elBtnExport.addEventListener("click", exportWeekly);

    elBtnLists.addEventListener("click", () => {
      openListsModal();
    });

    elTblBody.addEventListener("click", onTableClick);

    // filters
    elFilterAssignee.addEventListener("change", () => {
      state.filterAssignee = elFilterAssignee.value || "";
      renderTable();
    });
    elFilterStatus.addEventListener("change", () => {
      state.filterStatus = elFilterStatus.value || "";
      renderTable();
    });
    elFilterGroup.addEventListener("change", () => {
      state.filterGroup = elFilterGroup.value || "";
      renderTable();
    });
    elFilterOverdue.addEventListener("change", () => {
      state.onlyOverdue = !!elFilterOverdue.checked;
      renderTable();
    });
    elBtnClearFilter.addEventListener("click", () => {
      state.filterAssignee = "";
      state.filterStatus = "";
      state.filterGroup = "";
      state.onlyOverdue = false;
      elFilterAssignee.value = "";
      elFilterStatus.value = "";
      elFilterGroup.value = "";
      elFilterOverdue.checked = false;
      renderTable();
    });

    // task modal close
    taskClose.addEventListener("click", closeAllModals);
    btnCancel.addEventListener("click", closeAllModals);
    taskBackdrop.addEventListener("click", (ev) => {
      if (ev.target === taskBackdrop) closeAllModals();
    });
    taskForm.addEventListener("submit", (ev) => {
      ev.preventDefault();
      upsertTask();
    });

    // lists modal close
    listsClose.addEventListener("click", closeAllModals);
    btnListsCancel.addEventListener("click", closeAllModals);
    listsBackdrop.addEventListener("click", (ev) => {
      if (ev.target === listsBackdrop) closeAllModals();
    });
    btnListsSave.addEventListener("click", saveListsAndSettings);

    // lists add buttons
    btnAddStaff.addEventListener("click", () => {
      draftLists.staff.push({ id:"", name:"" });
      renderListsDraft();
    });
    btnAddStatus.addEventListener("click", () => {
      draftLists.statuses.push("");
      renderListsDraft();
    });
    btnAddGroup.addEventListener("click", () => {
      draftLists.groups.push("");
      renderListsDraft();
    });
    btnAddPriority.addEventListener("click", () => {
      draftLists.priorities.push("");
      renderListsDraft();
    });
    btnAddKpi.addEventListener("click", () => {
      draftLists.kpis.push("");
      renderListsDraft();
    });
    btnAddMetric.addEventListener("click", () => {
      draftLists.outputMetrics.push("");
      renderListsDraft();
    });

    // tabs
    $$(".tabBtn").forEach((b) => {
      b.addEventListener("click", () => {
        $$(".tabBtn").forEach(x => x.classList.remove("active"));
        b.classList.add("active");
        const tab = b.getAttribute("data-tab");
        $("#staffTab").style.display = (tab === "staffTab") ? "" : "none";
        $("#listsTab").style.display = (tab === "listsTab") ? "" : "none";
        $("#storeTab").style.display = (tab === "storeTab") ? "" : "none";
      });
    });

    // keyboard
    document.addEventListener("keydown", (ev) => {
      if (ev.key === "Escape") closeAllModals();
    });

    // if settings changed in another tab
    window.addEventListener("storage", (ev) => {
      if (ev.key === KEY_SETTINGS || ev.key === KEY_LISTS) {
        refreshDropdowns();
        setupSyncLoop();
      }
    });
  }

  // ---------- Bootstrap ----------
  async function bootstrap() {
    console.log("Kehoachtuan", VERSION);

    // init week
    elWeek.value = state.weekStartISO;

    refreshDropdowns();

    // restore settings UI tag
    const s = getSettings();
    setSyncUI({ ok:true, text:`${s.storageMode} • ready` });

    await loadInitialTasks();
    renderTable();

    setupSyncLoop();
    wireEvents();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", bootstrap);
  } else {
    bootstrap();
  }
})();
