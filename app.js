/* Kehoachtuan - Task Tracker (GitHub Pages, LocalStorage)
   - No build step
   - Mobile-friendly
   - Export weekly report (XLSX if SheetJS available, else CSV)
*/
(() => {
  "use strict";

  const CFG = window.CONFIG || {};
  const $ = (sel) => document.querySelector(sel);

  // ---------- Dates ----------
  const pad2 = (n) => String(n).padStart(2, "0");
  const toISODate = (d) => {
    // d: Date
    return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
  };
  const parseISODate = (s) => {
    // s: yyyy-mm-dd
    if (!s) return null;
    const [y, m, d] = s.split("-").map((x) => parseInt(x, 10));
    if (!y || !m || !d) return null;
    return new Date(y, m - 1, d);
  };
  const formatDDMMYYYY = (iso) => {
    if (!iso) return "";
    const d = parseISODate(iso);
    if (!d) return "";
    return `${pad2(d.getDate())}/${pad2(d.getMonth() + 1)}/${d.getFullYear()}`;
  };
  const mondayOf = (d) => {
    const x = new Date(d.getFullYear(), d.getMonth(), d.getDate());
    const day = x.getDay(); // 0 Sun ... 6 Sat
    const diff = (day === 0 ? -6 : 1) - day;
    x.setDate(x.getDate() + diff);
    x.setHours(0, 0, 0, 0);
    return x;
  };

  // ---------- Storage ----------
  const KEY_TASKS = CFG.storageKey || "kehoachtuan.tasks.v1";
  const KEY_LISTS = "kehoachtuan.lists.v1";

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
      kpis: saved.kpis || CFG.kpis || [],
      statuses: saved.statuses || CFG.statuses || ["Not started", "Doing", "Done", "Blocked"],
      priorities: saved.priorities || CFG.priorities || ["A", "B", "C"],
      groups: saved.groups || CFG.groups || [],
      outputMetrics: saved.outputMetrics || CFG.outputMetrics || []
    };
  }

  function loadTasks() {
    const raw = localStorage.getItem(KEY_TASKS);
    if (!raw) return [];
    try {
      const arr = JSON.parse(raw);
      return Array.isArray(arr) ? arr : [];
    } catch {
      return [];
    }
  }
  function saveTasks(tasks) {
    localStorage.setItem(KEY_TASKS, JSON.stringify(tasks));
  }

  // ---------- State ----------
  const state = {
    weekStartISO: null,
    meId: "",
    filterAssignee: "",
    filterStatus: "",
    filterGroup: "",
    onlyOverdue: false,
    tasks: []
  };

  // ---------- DOM refs ----------
  const elWeek = $("#weekPicker");
  const elMe = $("#mePicker");
  const elBtnAdd = $("#btnAdd");
  const elBtnExport = $("#btnExport");
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

  // Modal
  const modal = $("#taskModal");
  const fm = $("#taskForm");
  const fmId = $("#fmId");
  const fmGroup = $("#fmGroup");
  const fmAssignee = $("#fmAssignee");
  const fmTask = $("#fmTask");
  const fmDeadline = $("#fmDeadline");
  const fmStatus = $("#fmStatus");
  const fmPriority = $("#fmPriority");
  const fmKpi = $("#fmKpi");
  const fmMetric = $("#fmMetric");
  const fmCarryY = $("#fmCarryY");
  const fmCarryN = $("#fmCarryN");
  const fmCommit = $("#fmCommit");
  const fmActual = $("#fmActual");
  const fmNote = $("#fmNote");
  const btnCancel = $("#btnCancel");
  const btnSave = $("#btnSave");

  // ---------- Utils ----------
  function staffById(lists, id) {
    return (lists.staff || []).find((x) => String(x.id) === String(id)) || null;
  }
  function nextTaskId(tasks) {
    let maxId = 0;
    for (const t of tasks) {
      const n = parseInt(t.id, 10);
      if (!Number.isNaN(n)) maxId = Math.max(maxId, n);
    }
    return maxId + 1;
  }
  function isDone(status) {
    return String(status || "").toLowerCase() === "done";
  }
  function isOverdue(task) {
    if (!task.deadline) return false;
    if (isDone(task.status)) return false;
    const today = mondayOf(new Date()); // start-of-week? no, use today date
    // Actually overdue = deadline < today (real date)
    const now = new Date(); now.setHours(0,0,0,0);
    const dl = parseISODate(task.deadline);
    if (!dl) return false;
    dl.setHours(0,0,0,0);
    return dl < now;
  }
  function escapeHtml(s) {
    return String(s ?? "").replace(/[&<>"']/g, (c) => ({
      "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"
    }[c]));
  }

  // ---------- Populate dropdowns ----------
  function fillSelect(el, items, { valueKey=null, labelFn=null, emptyLabel=null } = {}) {
    el.innerHTML = "";
    if (emptyLabel !== null) {
      const opt = document.createElement("option");
      opt.value = "";
      opt.textContent = emptyLabel;
      el.appendChild(opt);
    }
    for (const it of items) {
      const opt = document.createElement("option");
      if (valueKey) opt.value = String(it[valueKey] ?? "");
      else opt.value = String(it ?? "");
      opt.textContent = labelFn ? labelFn(it) : String(it?.name ?? it);
      el.appendChild(opt);
    }
  }

  function refreshAllDropdowns() {
    const lists = getLists();

    // Me picker + Assignee
    fillSelect(elMe, lists.staff, {
      valueKey: "id",
      labelFn: (s) => `${s.id} - ${s.name}`,
      emptyLabel: "-- Chọn --"
    });
    fillSelect(fmAssignee, lists.staff, {
      valueKey: "id",
      labelFn: (s) => `${s.id} - ${s.name}`,
      emptyLabel: "-- Chọn --"
    });
    // Filters
    fillSelect(elFilterAssignee, lists.staff, {
      valueKey: "id",
      labelFn: (s) => `${s.name}`,
      emptyLabel: "-- Lọc theo CB đầu mối --"
    });

    fillSelect(fmGroup, lists.groups, { emptyLabel: "-- Chọn --" });
    fillSelect(elFilterGroup, lists.groups, { emptyLabel: "-- Lọc theo nhóm việc --" });

    fillSelect(fmStatus, lists.statuses, { emptyLabel: "-- Chọn --" });
    fillSelect(elFilterStatus, lists.statuses, { emptyLabel: "-- Lọc theo trạng thái --" });

    fillSelect(fmPriority, lists.priorities, { emptyLabel: "-- Chọn --" });

    fillSelect(fmKpi, lists.kpis, { emptyLabel: "-- (tuỳ chọn) --" });
    fillSelect(fmMetric, lists.outputMetrics, { emptyLabel: "-- (tuỳ chọn) --" });
  }

  // ---------- Rendering ----------
  function getVisibleTasks() {
    const weekISO = state.weekStartISO;
    const lists = getLists();

    const base = state.tasks.filter((t) => {
      // CarryOver rule: show current week tasks OR older week tasks not done with carryOver Y
      if (!weekISO) return false;
      if (t.weekStart === weekISO) return true;
      if (t.weekStart && t.weekStart < weekISO && String(t.carryOver || "Y").toUpperCase() === "Y" && !isDone(t.status)) return true;
      return false;
    });

    return base.filter((t) => {
      if (state.filterAssignee && String(t.assigneeId) !== String(state.filterAssignee)) return false;
      if (state.filterStatus && String(t.status) !== String(state.filterStatus)) return false;
      if (state.filterGroup && String(t.group) !== String(state.filterGroup)) return false;
      if (state.onlyOverdue && !isOverdue(t)) return false;
      return true;
    }).map((t) => {
      const ass = staffById(lists, t.assigneeId);
      const giver = staffById(lists, t.assignedById);
      return {
        ...t,
        assigneeName: ass ? ass.name : (t.assigneeName || ""),
        giverName: giver ? giver.name : (t.giverName || "")
      };
    }).sort((a,b) => {
      // sort: overdue first, then deadline, then id
      const ao = isOverdue(a) ? 0 : 1;
      const bo = isOverdue(b) ? 0 : 1;
      if (ao !== bo) return ao - bo;
      if ((a.deadline || "") !== (b.deadline || "")) return (a.deadline || "").localeCompare(b.deadline || "");
      return parseInt(a.id,10) - parseInt(b.id,10);
    });
  }

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

    const rows = visible.map((t) => {
      const overdue = isOverdue(t);
      return `
        <tr class="${overdue ? "row-overdue" : ""}">
          <td class="col-id">${escapeHtml(t.id)}</td>
          <td>${escapeHtml(t.group || "")}</td>
          <td class="col-task">${escapeHtml(t.task || "")}</td>
          <td class="col-date">${escapeHtml(formatDDMMYYYY(t.deadline))}</td>
          <td>${escapeHtml(t.assigneeName || t.assigneeId || "")}</td>
          <td>${escapeHtml(t.status || "")}</td>
          <td class="col-note">${escapeHtml(t.note || "")}</td>
          <td class="col-actions">
            <button class="btn-mini" data-act="edit" data-id="${escapeHtml(t.id)}">Sửa</button>
            <button class="btn-mini danger" data-act="del" data-id="${escapeHtml(t.id)}">Xoá</button>
          </td>
        </tr>
        <tr class="row-sub ${overdue ? "row-overdue-sub" : ""}">
          <td colspan="8">
            <div class="subgrid">
              <div><span class="k">KPI</span> ${escapeHtml(t.kpi || "")}</div>
              <div><span class="k">Output</span> ${escapeHtml(t.outputMetric || "")}</div>
              <div><span class="k">Commit</span> ${escapeHtml(t.commit ?? "")}</div>
              <div><span class="k">Actual</span> ${escapeHtml(t.actual ?? "")}</div>
              <div><span class="k">Priority</span> ${escapeHtml(t.priority || "")}</div>
              <div><span class="k">CarryOver</span> ${escapeHtml(t.carryOver || "Y")}</div>
              <div><span class="k">Giao bởi</span> ${escapeHtml(t.giverName || t.assignedById || "")}</div>
              <div><span class="k">WeekStart</span> ${escapeHtml(formatDDMMYYYY(t.weekStart))}</div>
            </div>
          </td>
        </tr>
      `;
    }).join("");

    elTblBody.innerHTML = rows || `<tr><td colspan="8" class="muted">Chưa có công việc trong tuần này. Bấm “+ Thêm việc”.</td></tr>`;
  }

  // ---------- Modal ----------
  function openModal({ mode, task=null } = {}) {
    $("#modalTitle").textContent = mode === "edit" ? "Sửa công việc" : "Thêm công việc";
    fm.reset();
    fmId.value = task ? String(task.id) : "";

    if (task) {
      fmGroup.value = task.group || "";
      fmAssignee.value = task.assigneeId || "";
      fmTask.value = task.task || "";
      fmDeadline.value = task.deadline || "";
      fmStatus.value = task.status || "";
      fmPriority.value = task.priority || "";
      fmKpi.value = task.kpi || "";
      fmMetric.value = task.outputMetric || "";
      (String(task.carryOver || "Y").toUpperCase() === "Y" ? fmCarryY : fmCarryN).checked = true;
      fmCommit.value = task.commit ?? "";
      fmActual.value = task.actual ?? "";
      fmNote.value = task.note || "";
    } else {
      // Defaults
      fmStatus.value = "Not started";
      fmPriority.value = "B";
      fmCarryY.checked = true;
      fmAssignee.value = state.meId || "";
    }

    modal.classList.add("open");
  }
  function closeModal() {
    modal.classList.remove("open");
  }

  function validateForm() {
    const errs = [];
    if (!fmGroup.value) errs.push("Bạn chưa chọn Nhóm công việc.");
    if (!fmAssignee.value) errs.push("Bạn chưa chọn CB đầu mối.");
    if (!fmTask.value.trim()) errs.push("Bạn chưa nhập Công việc / Hoạt động.");
    if (!fmDeadline.value) errs.push("Bạn chưa chọn Deadline.");
    if (!fmStatus.value) errs.push("Bạn chưa chọn Trạng thái.");
    if (!state.weekStartISO) errs.push("Bạn chưa chọn Tuần.");
    return errs;
  }

  function upsertTask() {
    const errs = validateForm();
    if (errs.length) {
      alert(errs.join("\n"));
      return;
    }

    const lists = getLists();
    const ass = staffById(lists, fmAssignee.value);
    const giver = staffById(lists, state.meId);

    const isEdit = !!fmId.value;
    const nowIso = new Date().toISOString();

    const t = {
      id: isEdit ? String(fmId.value) : String(nextTaskId(state.tasks)),
      createdAt: isEdit ? undefined : nowIso,
      updatedAt: nowIso,
      weekStart: state.weekStartISO,
      group: fmGroup.value,
      assigneeId: String(fmAssignee.value),
      assigneeName: ass ? ass.name : "",
      status: fmStatus.value,
      deadline: fmDeadline.value,
      task: fmTask.value.trim(),
      note: fmNote.value.trim(),
      kpi: fmKpi.value || "",
      outputMetric: fmMetric.value || "",
      commit: fmCommit.value !== "" ? Number(fmCommit.value) : "",
      actual: fmActual.value !== "" ? Number(fmActual.value) : "",
      priority: fmPriority.value || "",
      carryOver: fmCarryY.checked ? "Y" : "N",
      assignedById: state.meId || "",
      giverName: giver ? giver.name : ""
    };

    if (isEdit) {
      const idx = state.tasks.findIndex((x) => String(x.id) === String(t.id));
      if (idx >= 0) {
        const createdAt = state.tasks[idx].createdAt || nowIso;
        state.tasks[idx] = { ...state.tasks[idx], ...t, createdAt };
      } else {
        t.createdAt = nowIso;
        state.tasks.push(t);
      }
    } else {
      state.tasks.push(t);
    }

    saveTasks(state.tasks);
    closeModal();
    renderTable();
  }

  // ---------- Export ----------
  function buildWeeklyReport() {
    const visible = getVisibleTasks();
    const week = state.weekStartISO || "";
    const lists = getLists();

    // Sheet 1: tasks
    const sheetTasks = [
      ["WeekStart", week],
      [],
      ["ID","Group","Task","Deadline(dd/mm/yyyy)","AssigneeID","AssigneeName","Status","KPI","OutputMetric","Commit","Actual","Priority","CarryOver","AssignedByID","AssignedByName","Note"]
    ];
    for (const t of visible) {
      sheetTasks.push([
        t.weekStart,
        t.group || "",
        t.task || "",
        formatDDMMYYYY(t.deadline),
        t.assigneeId || "",
        t.assigneeName || "",
        t.status || "",
        t.kpi || "",
        t.outputMetric || "",
        t.commit ?? "",
        t.actual ?? "",
        t.priority || "",
        t.carryOver || "",
        t.assignedById || "",
        t.giverName || "",
        t.note || ""
      ]);
    }

    // Sheet 2: summary by staff
    const byStaff = {};
    for (const t of visible) {
      const sid = String(t.assigneeId || "");
      if (!byStaff[sid]) byStaff[sid] = { total:0, done:0, overdue:0, commit:0, actual:0 };
      byStaff[sid].total += 1;
      if (isDone(t.status)) byStaff[sid].done += 1;
      if (isOverdue(t)) byStaff[sid].overdue += 1;
      const c = Number(t.commit); if (!Number.isNaN(c)) byStaff[sid].commit += c;
      const a = Number(t.actual); if (!Number.isNaN(a)) byStaff[sid].actual += a;
    }

    const sheetSummary = [
      ["WeekStart", week],
      [],
      ["AssigneeID","AssigneeName","TotalTasks","Done","Overdue","%Complete","SumCommit","SumActual"]
    ];
    for (const s of lists.staff) {
      const sid = String(s.id);
      const m = byStaff[sid] || { total:0, done:0, overdue:0, commit:0, actual:0 };
      const pct = m.total ? Math.round((m.done / m.total) * 100) : 0;
      sheetSummary.push([sid, s.name, m.total, m.done, m.overdue, `${pct}%`, m.commit, m.actual]);
    }

    return { visible, sheetTasks, sheetSummary };
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
    const { sheetTasks, sheetSummary } = buildWeeklyReport();
    const week = state.weekStartISO || toISODate(mondayOf(new Date()));
    const fname = `BaoCao_Tuan_${week}.xlsx`;

    // If SheetJS available, export XLSX
    if (window.XLSX && window.XLSX.utils) {
      const wb = window.XLSX.utils.book_new();
      const ws1 = window.XLSX.utils.aoa_to_sheet(sheetTasks);
      const ws2 = window.XLSX.utils.aoa_to_sheet(sheetSummary);
      window.XLSX.utils.book_append_sheet(wb, ws1, "TASKS_WEEK");
      window.XLSX.utils.book_append_sheet(wb, ws2, "SUMMARY_BY_STAFF");
      window.XLSX.writeFile(wb, fname);
      return;
    }

    // Fallback: CSV (zip-less)
    const toCSV = (aoa) => aoa.map((row) => row.map((cell) => {
      const s = String(cell ?? "");
      if (s.includes('"') || s.includes(",") || s.includes("\n")) return `"${s.replaceAll('"','""')}"`;
      return s;
    }).join(",")).join("\n");

    const csv1 = toCSV(sheetTasks);
    const csv2 = toCSV(sheetSummary);
    downloadBlob(`TASKS_WEEK_${week}.csv`, new Blob([csv1], { type: "text/csv;charset=utf-8" }));
    downloadBlob(`SUMMARY_BY_STAFF_${week}.csv`, new Blob([csv2], { type: "text/csv;charset=utf-8" }));
    alert("Không tải được thư viện XLSX, hệ thống đã xuất CSV thay thế.");
  }

  // ---------- Actions ----------
  function onTableClick(e) {
    const btn = e.target.closest("button[data-act]");
    if (!btn) return;
    const act = btn.getAttribute("data-act");
    const id = btn.getAttribute("data-id");
    const t = state.tasks.find((x) => String(x.id) === String(id));
    if (!t) return;

    if (act === "edit") {
      openModal({ mode: "edit", task: t });
      return;
    }
    if (act === "del") {
      if (!confirm(`Xoá công việc #${id}?`)) return;
      state.tasks = state.tasks.filter((x) => String(x.id) !== String(id));
      saveTasks(state.tasks);
      renderTable();
      return;
    }
  }

  // ---------- Init ----------
  function initWeek() {
    const today = new Date();
    const m = mondayOf(today);
    const iso = toISODate(m);
    state.weekStartISO = iso;
    elWeek.value = iso;
  }

  function wireEvents() {
    elWeek.addEventListener("change", () => {
      const d = parseISODate(elWeek.value);
      if (!d) return;
      const m = mondayOf(d);
      const iso = toISODate(m);
      state.weekStartISO = iso;
      elWeek.value = iso;
      renderTable();
    });

    elMe.addEventListener("change", () => {
      state.meId = elMe.value || "";
      // default assignee in modal = me
    });

    elBtnAdd.addEventListener("click", () => {
      if (!state.meId) {
        alert("Bạn cần chọn “Tôi là” trước khi thêm việc.");
        return;
      }
      openModal({ mode: "add" });
    });

    elBtnExport.addEventListener("click", () => exportWeekly());

    elTblBody.addEventListener("click", onTableClick);

    // filters
    elFilterAssignee.addEventListener("change", () => { state.filterAssignee = elFilterAssignee.value || ""; renderTable(); });
    elFilterStatus.addEventListener("change", () => { state.filterStatus = elFilterStatus.value || ""; renderTable(); });
    elFilterGroup.addEventListener("change", () => { state.filterGroup = elFilterGroup.value || ""; renderTable(); });
    elFilterOverdue.addEventListener("change", () => { state.onlyOverdue = !!elFilterOverdue.checked; renderTable(); });
    elBtnClearFilter.addEventListener("click", () => {
      state.filterAssignee = ""; state.filterStatus = ""; state.filterGroup = ""; state.onlyOverdue = false;
      elFilterAssignee.value = ""; elFilterStatus.value = ""; elFilterGroup.value = ""; elFilterOverdue.checked = false;
      renderTable();
    });

    // modal
    btnCancel.addEventListener("click", (ev) => { ev.preventDefault(); closeModal(); });
    modal.addEventListener("click", (ev) => { if (ev.target === modal) closeModal(); });
    fm.addEventListener("submit", (ev) => { ev.preventDefault(); upsertTask(); });
    btnSave.addEventListener("click", (ev) => { ev.preventDefault(); upsertTask(); });

    // keyboard
    document.addEventListener("keydown", (ev) => {
      if (ev.key === "Escape" && modal.classList.contains("open")) closeModal();
    });
  }

  function bootstrap() {
    // load tasks
    state.tasks = loadTasks();

    initWeek();
    refreshAllDropdowns();
    wireEvents();
    renderTable();
  }

  // Start
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", bootstrap);
  } else {
    bootstrap();
  }
})();
