/* PGD Task Tracker - client-side app (GitHub Pages friendly)
 * Storage modes:
 *  - local: localStorage (mỗi máy 1 dữ liệu)
 *  - supabase: dùng chung nhiều người (cần cấu hình trong 'Danh mục')
 */

(() => {
  'use strict';

  const LS_TASKS = 'pgd_tasks_v1';
  const LS_META  = 'pgd_meta_v1';

  // ---------- Utils ----------
  const pad2 = (n) => String(n).padStart(2, '0');
  const todayIso = () => {
    const d = new Date();
    d.setHours(0,0,0,0);
    return d.toISOString().slice(0,10);
  };
  const isoToVN = (iso) => {
    if (!iso) return '';
    const [y,m,d] = iso.split('-');
    if (!y || !m || !d) return iso;
    return `${pad2(Number(d))}/${pad2(Number(m))}/${y}`;
  };
  const parseVNDateLooseToISO = (v) => {
    // Accept "15/3", "15/3/2026", "2026-03-15"
    if (!v) return '';
    const s = String(v).trim();
    if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
    const m = s.match(/^(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?$/);
    if (!m) return '';
    let dd = Number(m[1]), mm = Number(m[2]), yy = m[3] ? Number(m[3]) : (new Date()).getFullYear();
    if (yy < 100) yy += 2000;
    if (mm < 1 || mm > 12 || dd < 1 || dd > 31) return '';
    return `${yy}-${pad2(mm)}-${pad2(dd)}`;
  };

  const mondayOf = (date) => {
    const d = new Date(date);
    d.setHours(0,0,0,0);
    const day = d.getDay(); // 0=Sun
    const diff = (day === 0 ? -6 : 1) - day; // shift to Monday
    d.setDate(d.getDate() + diff);
    return d;
  };
  const isoMondayOf = (isoDate) => mondayOf(new Date(isoDate)).toISOString().slice(0,10);

  const isOverdue = (task) => {
    if (!task.deadline) return false;
    const t = todayIso();
    return task.status !== 'Done' && task.deadline < t;
  };

  const downloadBlob = (blob, filename) => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = filename;
    document.body.appendChild(a); a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 500);
  };

  // ---------- State ----------
  let meta = null;
  let tasks = [];
  let selectedWeekStart = '';
  let currentUserId = '';
  let advancedMode = false;

  // ---------- DOM ----------
  const el = (id) => document.getElementById(id);

  const weekPicker = el('weekPicker');
  const currentUser = el('currentUser');
  const weekLabel = el('weekLabel');

  const filterOwner = el('filterOwner');
  const filterStatus = el('filterStatus');
  const filterGroup = el('filterGroup');
  const filterOverdue = el('filterOverdue');

  const statTotal = el('statTotal');
  const statDone = el('statDone');
  const statOverdue = el('statOverdue');
  const statPct = el('statPct');

  const tasksTbody = el('tasksTbody');
  const toggleAdvanced = el('toggleAdvanced');

  // Task modal
  const taskModalEl = el('taskModal');
  const taskModal = new bootstrap.Modal(taskModalEl);
  const taskModalTitle = el('taskModalTitle');
  const btnSaveTask = el('btnSaveTask');

  const taskId = el('taskId');
  const taskGroup = el('taskGroup');
  const taskOwner = el('taskOwner');
  const taskTitle = el('taskTitle');
  const taskDeadline = el('taskDeadline');
  const taskStatus = el('taskStatus');
  const taskPriority = el('taskPriority');
  const taskKpi = el('taskKpi');
  const taskMetric = el('taskMetric');
  const taskCarry = el('taskCarry');
  const taskCommit = el('taskCommit');
  const taskActual = el('taskActual');
  const taskNote = el('taskNote');

  // Settings modal
  const settingsModalEl = el('settingsModal');
  const settingsModal = new bootstrap.Modal(settingsModalEl);

  const staffList = el('staffList');
  const storageMode = el('storageMode');
  const supabaseUrl = el('supabaseUrl');
  const supabaseKey = el('supabaseKey');

  const statusList = el('statusList');
  const kpiList = el('kpiList');
  const groupList = el('groupList');
  const metricList = el('metricList');

  // Hidden file inputs
  const fileJson = el('fileJson');
  const fileExcel = el('fileExcel');

  // ---------- Storage (local / supabase) ----------
  let supa = null;

  const loadLocalTasks = () => {
    try {
      tasks = JSON.parse(localStorage.getItem(LS_TASKS) || '[]');
    } catch {
      tasks = [];
    }
  };
  const saveLocalTasks = () => localStorage.setItem(LS_TASKS, JSON.stringify(tasks));

  const loadMeta = () => {
    const defaults = window.APP_CONFIG;
    let saved = null;
    try { saved = JSON.parse(localStorage.getItem(LS_META) || 'null'); } catch { saved = null; }
    meta = structuredClone(defaults);
    if (saved) {
      // shallow merge
      meta.storage = { ...meta.storage, ...(saved.storage || {}) };
      meta.statuses = Array.isArray(saved.statuses) ? saved.statuses : meta.statuses;
      meta.priorities = Array.isArray(saved.priorities) ? saved.priorities : meta.priorities;
      meta.kpis = Array.isArray(saved.kpis) ? saved.kpis : meta.kpis;
      meta.groups = Array.isArray(saved.groups) ? saved.groups : meta.groups;
      meta.metrics = Array.isArray(saved.metrics) ? saved.metrics : meta.metrics;
      meta.staff = Array.isArray(saved.staff) ? saved.staff : meta.staff;
    }
  };
  const saveMeta = () => localStorage.setItem(LS_META, JSON.stringify(meta));

  const initSupabaseIfNeeded = () => {
    if (meta.storage.mode !== 'supabase') { supa = null; return; }
    if (!meta.storage.supabaseUrl || !meta.storage.supabaseAnonKey) {
      alert('Bạn đang chọn Supabase nhưng chưa điền URL / Anon Key trong Danh mục.');
      supa = null;
      return;
    }
    supa = window.supabase.createClient(meta.storage.supabaseUrl, meta.storage.supabaseAnonKey);
  };

  const fetchTasks = async () => {
    if (meta.storage.mode !== 'supabase' || !supa) {
      loadLocalTasks();
      return;
    }
    const { data, error } = await supa.from('tasks').select('*').order('created_at', { ascending: true });
    if (error) {
      console.error(error);
      alert('Không đọc được dữ liệu từ Supabase. Kiểm tra cấu hình / RLS.');
      return;
    }
    // Normalize
    tasks = (data || []).map(r => ({
      id: r.id,
      seq: r.seq ?? 0,
      weekStart: r.week_start,
      group: r.group_name || '',
      title: r.title || '',
      deadline: r.deadline || '',
      status: r.status || 'Not started',
      ownerId: r.owner_id || '',
      ownerName: r.owner_name || '',
      note: r.note || '',
      result: r.result || '',
      kpi: r.kpi || '',
      metric: r.metric || '',
      commit: r.commit ?? null,
      actual: r.actual ?? null,
      priority: r.priority || 'B',
      carryOver: r.carry_over || 'Y',
      assignedById: r.assigned_by_id || '',
      assignedByName: r.assigned_by_name || '',
      createdAt: r.created_at || '',
      updatedAt: r.updated_at || ''
    }));
  };

  const upsertTask = async (t) => {
    if (meta.storage.mode !== 'supabase' || !supa) {
      const i = tasks.findIndex(x => x.id === t.id);
      if (i >= 0) tasks[i] = t; else tasks.push(t);
      saveLocalTasks();
      return;
    }

    const payload = {
      id: t.id,
      seq: t.seq,
      week_start: t.weekStart,
      group_name: t.group,
      title: t.title,
      deadline: t.deadline,
      status: t.status,
      owner_id: t.ownerId,
      owner_name: t.ownerName,
      note: t.note,
      result: t.result,
      kpi: t.kpi,
      metric: t.metric,
      commit: t.commit,
      actual: t.actual,
      priority: t.priority,
      carry_over: t.carryOver,
      assigned_by_id: t.assignedById,
      assigned_by_name: t.assignedByName,
      updated_at: new Date().toISOString()
    };

    const { error } = await supa.from('tasks').upsert(payload);
    if (error) {
      console.error(error);
      alert('Lỗi khi lưu lên Supabase. Kiểm tra RLS / schema.');
    }
  };

  const deleteTask = async (id) => {
    if (meta.storage.mode !== 'supabase' || !supa) {
      tasks = tasks.filter(t => t.id !== id);
      saveLocalTasks();
      return;
    }
    const { error } = await supa.from('tasks').delete().eq('id', id);
    if (error) {
      console.error(error);
      alert('Lỗi khi xoá trên Supabase.');
    }
  };

  // ---------- Helpers ----------
  const staffById = (id) => meta.staff.find(s => s.id === id) || null;

  const nextSeq = () => {
    const maxSeq = tasks.reduce((m, t) => Math.max(m, Number(t.seq || 0)), 0);
    return maxSeq + 1;
  };
  const makeId = (seq) => `T${String(seq).padStart(5,'0')}`;

  const weekViewTasks = () => {
    const ws = selectedWeekStart;
    return tasks.filter(t => {
      const inWeek = t.weekStart === ws;
      const carry = (t.weekStart && t.weekStart < ws && (t.carryOver || 'Y') === 'Y' && t.status !== 'Done');
      const show = inWeek || carry;

      if (!show) return false;

      if (filterOwner.value && t.ownerId !== filterOwner.value) return false;
      if (filterStatus.value && t.status !== filterStatus.value) return false;
      if (filterGroup.value && (t.group || '') !== filterGroup.value) return false;
      if (filterOverdue.checked && !isOverdue(t)) return false;

      return true;
    }).sort((a,b) => (a.group || '').localeCompare(b.group || '') || (a.deadline||'').localeCompare(b.deadline||'') || (a.seq||0)-(b.seq||0));
  };

  const computeSummary = (list) => {
    const total = list.length;
    const done = list.filter(t => t.status === 'Done').length;
    const overdue = list.filter(isOverdue).length;
    const pct = total ? Math.round(done * 100 / total) : 0;
    return { total, done, overdue, pct };
  };

  // ---------- Render ----------
  const fillSelect = (selectEl, items, { placeholder=null, valueKey=null, labelKey=null } = {}) => {
    selectEl.innerHTML = '';
    if (placeholder !== null) {
      const opt = document.createElement('option');
      opt.value = '';
      opt.textContent = placeholder;
      selectEl.appendChild(opt);
    }
    for (const it of items) {
      const opt = document.createElement('option');
      if (typeof it === 'string') {
        opt.value = it; opt.textContent = it;
      } else {
        opt.value = it[valueKey || 'id'];
        opt.textContent = it[labelKey || 'name'] ?? it[valueKey || 'id'];
      }
      selectEl.appendChild(opt);
    }
  };

  const renderDropdowns = () => {
    // Current user
    fillSelect(currentUser, meta.staff.filter(s => s.id !== '54000000'), { valueKey:'id', labelKey:'name' });
    if (!currentUserId) currentUserId = meta.staff[0]?.id || '';
    currentUser.value = currentUserId;

    // Filters
    fillSelect(filterOwner, meta.staff, { placeholder: '-- Lọc theo CB đầu mối --', valueKey:'id', labelKey:'name' });
    fillSelect(filterStatus, meta.statuses, { placeholder: '-- Lọc theo trạng thái --' });
    fillSelect(filterGroup, meta.groups, { placeholder: '-- Lọc theo nhóm việc --' });

    // Task modal selects
    fillSelect(taskOwner, meta.staff, { valueKey:'id', labelKey:'name' });
    fillSelect(taskStatus, meta.statuses);
    fillSelect(taskPriority, meta.priorities);
    fillSelect(taskKpi, [''].concat(meta.kpis), { placeholder: '(Không chọn)' });
    fillSelect(taskMetric, [''].concat(meta.metrics), { placeholder: '(Không chọn)' });
  };

  const renderStats = () => {
    const list = weekViewTasks();
    const s = computeSummary(list);
    statTotal.textContent = s.total;
    statDone.textContent = s.done;
    statOverdue.textContent = s.overdue;
    statPct.textContent = `${s.pct}%`;
  };

  const renderWeekLabel = () => {
    weekLabel.textContent = `Tuần bắt đầu: ${isoToVN(selectedWeekStart)}`;
  };

  const renderTable = () => {
    const list = weekViewTasks();
    tasksTbody.innerHTML = '';

    for (const t of list) {
      const tr = document.createElement('tr');
      if (isOverdue(t)) tr.classList.add('table-danger');

      const owner = staffById(t.ownerId);
      const ownerText = owner ? `${owner.id} - ${owner.name}` : (t.ownerName ? `${t.ownerId} - ${t.ownerName}` : (t.ownerId || ''));

      tr.innerHTML = `
        <td class="mono">${t.id}</td>
        <td>${escapeHtml(t.group || '')}</td>
        <td>${escapeHtml(t.title || '')}</td>
        <td>${isoToVN(t.deadline)}</td>
        <td>${escapeHtml(ownerText)}</td>
        <td>${renderStatusBadge(t.status)}</td>
        <td>${escapeHtml(t.result || t.note || '')}</td>
        <td class="text-end">
          <button class="btn btn-sm btn-outline-primary me-1" data-action="edit" data-id="${t.id}">Sửa</button>
          <button class="btn btn-sm btn-outline-danger" data-action="del" data-id="${t.id}">Xoá</button>
        </td>
      `;
      tasksTbody.appendChild(tr);

      if (advancedMode) {
        const tr2 = document.createElement('tr');
        tr2.className = 'advanced-row';
        tr2.innerHTML = `
          <td colspan="8" class="bg-body-tertiary">
            <div class="d-flex flex-wrap gap-2 small">
              <span class="badge text-bg-secondary">KPI: ${escapeHtml(t.kpi || '-')}</span>
              <span class="badge text-bg-secondary">Metric: ${escapeHtml(t.metric || '-')}</span>
              <span class="badge text-bg-secondary">Commit: ${t.commit ?? '-'}</span>
              <span class="badge text-bg-secondary">Actual: ${t.actual ?? '-'}</span>
              <span class="badge text-bg-secondary">Priority: ${escapeHtml(t.priority || 'B')}</span>
              <span class="badge text-bg-secondary">CarryOver: ${escapeHtml(t.carryOver || 'Y')}</span>
              <span class="badge text-bg-secondary">Giao bởi: ${escapeHtml((t.assignedById ? (t.assignedById + ' - ' + (t.assignedByName||'')) : '-'))}</span>
              <span class="badge text-bg-secondary">WeekStart: ${isoToVN(t.weekStart || '')}</span>
            </div>
          </td>
        `;
        tasksTbody.appendChild(tr2);
      }
    }

    renderStats();
  };

  const renderStatusBadge = (status) => {
    const s = status || 'Not started';
    let cls = 'text-bg-secondary';
    if (s === 'Done') cls = 'text-bg-success';
    else if (s === 'Doing') cls = 'text-bg-primary';
    else if (s === 'Blocked') cls = 'text-bg-warning';
    return `<span class="badge ${cls} badge-status">${escapeHtml(s)}</span>`;
  };

  const escapeHtml = (str) => {
    const s = String(str ?? '');
    return s.replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  };

  // ---------- Task modal ----------
  const openTaskModal = (existing=null) => {
    if (!existing) {
      taskModalTitle.textContent = 'Thêm công việc';
      taskId.value = '';
      taskGroup.value = meta.groups[0] || '';
      taskOwner.value = currentUserId || '';
      taskTitle.value = '';
      taskDeadline.value = '';
      taskStatus.value = meta.statuses[0] || 'Not started';
      taskPriority.value = 'B';
      taskKpi.value = '';
      taskMetric.value = '';
      taskCarry.value = 'Y';
      taskCommit.value = '';
      taskActual.value = '';
      taskNote.value = '';
    } else {
      taskModalTitle.textContent = `Sửa công việc ${existing.id}`;
      taskId.value = existing.id;
      taskGroup.value = existing.group || '';
      taskOwner.value = existing.ownerId || '';
      taskTitle.value = existing.title || '';
      taskDeadline.value = existing.deadline || '';
      taskStatus.value = existing.status || 'Not started';
      taskPriority.value = existing.priority || 'B';
      taskKpi.value = existing.kpi || '';
      taskMetric.value = existing.metric || '';
      taskCarry.value = existing.carryOver || 'Y';
      taskCommit.value = (existing.commit ?? '') === null ? '' : (existing.commit ?? '');
      taskActual.value = (existing.actual ?? '') === null ? '' : (existing.actual ?? '');
      taskNote.value = existing.result || existing.note || '';
    }
    taskModal.show();
  };

  const saveFromModal = async () => {
    const id = taskId.value.trim();
    const ownerId = taskOwner.value;
    const owner = staffById(ownerId);
    const seq = id ? (tasks.find(t => t.id === id)?.seq || 0) : nextSeq();
    const newId = id || makeId(seq);

    const t = {
      id: newId,
      seq,
      weekStart: selectedWeekStart,
      group: taskGroup.value.trim(),
      title: taskTitle.value.trim(),
      deadline: taskDeadline.value,
      status: taskStatus.value,
      ownerId,
      ownerName: owner ? owner.name : '',
      note: '',
      result: taskNote.value.trim(),
      kpi: taskKpi.value,
      metric: taskMetric.value,
      commit: taskCommit.value === '' ? null : Number(taskCommit.value),
      actual: taskActual.value === '' ? null : Number(taskActual.value),
      priority: taskPriority.value,
      carryOver: taskCarry.value,
      assignedById: currentUserId,
      assignedByName: staffById(currentUserId)?.name || '',
      createdAt: id ? (tasks.find(t => t.id === id)?.createdAt || new Date().toISOString()) : new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    if (!t.title) {
      alert('Vui lòng nhập nội dung công việc.');
      return;
    }
    if (!t.ownerId) {
      alert('Vui lòng chọn CB đầu mối.');
      return;
    }

    await upsertTask(t);
    // update local cache if supabase
    const i = tasks.findIndex(x => x.id === t.id);
    if (i >= 0) tasks[i] = t; else tasks.push(t);

    taskModal.hide();
    renderTable();
  };

  // ---------- Settings modal ----------
  const renderStaffEditor = () => {
    staffList.innerHTML = '';
    meta.staff.forEach((s, idx) => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td><input class="form-control form-control-sm mono" value="${escapeHtml(s.id)}" data-idx="${idx}" data-field="id"></td>
        <td><input class="form-control form-control-sm" value="${escapeHtml(s.name)}" data-idx="${idx}" data-field="name"></td>
        <td class="text-end"><button class="btn btn-sm btn-outline-danger" data-action="rmStaff" data-idx="${idx}">Xoá</button></td>
      `;
      staffList.appendChild(tr);
    });
  };

  const renderListEditor = (container, arr, addBtnId) => {
    container.innerHTML = '';
    arr.forEach((v, idx) => {
      const div = document.createElement('div');
      div.className = 'item';
      div.innerHTML = `
        <input class="form-control form-control-sm" value="${escapeHtml(v)}" data-idx="${idx}">
        <button class="btn btn-sm btn-outline-danger" data-action="rmItem" data-idx="${idx}">Xoá</button>
      `;
      container.appendChild(div);
    });
  };

  const openSettings = () => {
    // fill inputs
    storageMode.value = meta.storage.mode || 'local';
    supabaseUrl.value = meta.storage.supabaseUrl || '';
    supabaseKey.value = meta.storage.supabaseAnonKey || '';

    renderStaffEditor();
    renderListEditor(statusList, meta.statuses);
    renderListEditor(kpiList, meta.kpis);
    renderListEditor(groupList, meta.groups);
    renderListEditor(metricList, meta.metrics);

    settingsModal.show();
  };

  const saveSettings = async () => {
    // read staff table
    const staffRows = [...staffList.querySelectorAll('tr')];
    const newStaff = [];
    for (const tr of staffRows) {
      const inputs = tr.querySelectorAll('input');
      const id = inputs[0].value.trim();
      const name = inputs[1].value.trim();
      if (id && name) newStaff.push({ id, name });
    }
    // de-dup by id
    const seen = new Set();
    meta.staff = newStaff.filter(s => (seen.has(s.id) ? false : (seen.add(s.id), true)));

    // read lists
    const readList = (container) => [...container.querySelectorAll('input')].map(i => i.value.trim()).filter(Boolean);
    meta.statuses = readList(statusList);
    meta.kpis = readList(kpiList);
    meta.groups = readList(groupList);
    meta.metrics = readList(metricList);

    meta.storage.mode = storageMode.value;
    meta.storage.supabaseUrl = supabaseUrl.value.trim();
    meta.storage.supabaseAnonKey = supabaseKey.value.trim();

    saveMeta();
    initSupabaseIfNeeded();
    await fetchTasks();
    renderDropdowns();
    renderWeekLabel();
    renderTable();
    settingsModal.hide();
  };

  // ---------- Import/Export ----------
  const exportWeeklyReport = () => {
    const list = weekViewTasks();
    const rows = list.map(t => ({
      TaskID: t.id,
      WeekStart: isoToVN(t.weekStart),
      Group: t.group,
      Task: t.title,
      Deadline: isoToVN(t.deadline),
      Status: t.status,
      OwnerID: t.ownerId,
      OwnerName: (staffById(t.ownerId)?.name || t.ownerName || ''),
      ResultNote: (t.result || t.note || ''),
      KPI: t.kpi || '',
      Metric: t.metric || '',
      Commit: t.commit ?? '',
      Actual: t.actual ?? '',
      Priority: t.priority || '',
      CarryOver: t.carryOver || '',
      AssignedBy: t.assignedById ? `${t.assignedById} - ${(t.assignedByName||'')}` : ''
    }));

    // Summary by owner
    const byOwner = new Map();
    for (const t of list) {
      const key = t.ownerId || '';
      if (!byOwner.has(key)) byOwner.set(key, { OwnerID:key, OwnerName:(staffById(key)?.name||t.ownerName||''), Total:0, Done:0, Overdue:0 });
      const s = byOwner.get(key);
      s.Total += 1;
      if (t.status === 'Done') s.Done += 1;
      if (isOverdue(t)) s.Overdue += 1;
    }
    const summaryRows = [...byOwner.values()].map(s => ({...s, PctComplete: s.Total ? Math.round(s.Done*100/s.Total) + '%' : '0%'}));

    const wb = XLSX.utils.book_new();
    const ws1 = XLSX.utils.json_to_sheet(rows);
    const ws2 = XLSX.utils.json_to_sheet(summaryRows);

    XLSX.utils.book_append_sheet(wb, ws1, 'TASKS_WEEK');
    XLSX.utils.book_append_sheet(wb, ws2, 'SUMMARY_BY_STAFF');

    const fn = `BaoCao_Tuan_${selectedWeekStart}.xlsx`;
    XLSX.writeFile(wb, fn);
  };

  const exportJson = () => {
    const payload = { meta, tasks };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type:'application/json' });
    downloadBlob(blob, `PGD_TaskTracker_Backup_${todayIso()}.json`);
  };

  const importJson = async (file) => {
    const text = await file.text();
    const payload = JSON.parse(text);
    if (payload.meta) meta = payload.meta;
    if (payload.tasks) tasks = payload.tasks;
    saveMeta();
    saveLocalTasks();
    initSupabaseIfNeeded();
    renderDropdowns();
    renderWeekLabel();
    renderTable();
  };

  const importExcel = async (file) => {
    const buf = await file.arrayBuffer();
    const wb = XLSX.read(buf, { type: 'array' });
    const sheetName = wb.SheetNames[0];
    const ws = wb.Sheets[sheetName];
    const aoa = XLSX.utils.sheet_to_json(ws, { header: 1, raw: false });
    // Expect layout similar to user's excel: A: group header, B: task, C: deadline, D: status/result, G: owner, J: note
    let curGroup = '';
    const imported = [];
    const now = new Date().toISOString();
    let seqBase = nextSeq();

    for (let r = 0; r < aoa.length; r++) {
      const row = aoa[r] || [];
      const A = (row[0] || '').toString().trim();
      const B = (row[1] || '').toString().trim();
      const C = (row[2] || '').toString().trim();
      const D = (row[3] || '').toString().trim();
      const G = (row[6] || '').toString().trim();
      const J = (row[9] || '').toString().trim();

      // Skip title rows
      if (r < 2) continue;
      if (B === 'Công việc' && (row[2] || '').toString().includes('Thời hạn')) continue;

      const isGroupRow = A && /^\d+\./.test(A);
      if (isGroupRow) {
        curGroup = A;
        // If group row itself has an owner or deadline, create a task row for it
        const dIso = parseVNDateLooseToISO(C);
        const ownerParsed = parseOwner(G);
        if (dIso || ownerParsed.ownerId) {
          const id = makeId(seqBase);
          imported.push({
            id, seq: seqBase++,
            weekStart: selectedWeekStart,
            group: curGroup,
            title: curGroup,
            deadline: dIso,
            status: normalizeStatus(D),
            ownerId: ownerParsed.ownerId || '54000000',
            ownerName: ownerParsed.ownerName || 'ALL',
            note: '',
            result: J,
            kpi: '',
            metric: '',
            commit: null,
            actual: null,
            priority: 'B',
            carryOver: 'Y',
            assignedById: currentUserId,
            assignedByName: staffById(currentUserId)?.name || '',
            createdAt: now,
            updatedAt: now
          });
        }
        continue;
      }

      if (!B) continue;

      const dIso = parseVNDateLooseToISO(C);
      const ownerParsed = parseOwner(G);

      const id = makeId(seqBase);
      imported.push({
        id, seq: seqBase++,
        weekStart: dIso ? isoMondayOf(dIso) : selectedWeekStart,
        group: curGroup || '',
        title: B,
        deadline: dIso,
        status: normalizeStatus(D),
        ownerId: ownerParsed.ownerId || '',
        ownerName: ownerParsed.ownerName || '',
        note: '',
        result: J,
        kpi: '',
        metric: '',
        commit: null,
        actual: null,
        priority: 'B',
        carryOver: 'Y',
        assignedById: currentUserId,
        assignedByName: staffById(currentUserId)?.name || '',
        createdAt: now,
        updatedAt: now
      });
    }

    // Merge into local tasks (avoid duplicates by id)
    tasks = tasks.concat(imported);
    saveLocalTasks();
    renderTable();
    alert(`Đã import ${imported.length} dòng công việc từ Excel (${sheetName}).`);
  };

  const normalizeStatus = (raw) => {
    if (!raw) return meta.statuses[0] || 'Not started';
    const s = raw.toLowerCase();
    if (s.includes('done') || s.includes('hoàn') || s.includes('xong')) return 'Done';
    if (s.includes('doing') || s.includes('đang')) return 'Doing';
    if (s.includes('block') || s.includes('kẹt') || s.includes('vướng')) return 'Blocked';
    // default keep original if in list
    const exact = meta.statuses.find(x => x.toLowerCase() === raw.toLowerCase());
    return exact || meta.statuses[0] || 'Not started';
  };

  const parseOwner = (raw) => {
    // Expect "54000604 - HOANG TRUONG AN" or "ALL"
    if (!raw) return { ownerId:'', ownerName:'' };
    const s = raw.trim();
    if (s.toUpperCase() === 'ALL') return { ownerId:'54000000', ownerName:'ALL' };
    const m = s.match(/^(\d+)\s*-\s*(.+)$/);
    if (m) return { ownerId: m[1].trim(), ownerName: m[2].trim() };
    // If raw is id only
    if (/^\d+$/.test(s)) return { ownerId: s, ownerName: staffById(s)?.name || '' };
    return { ownerId:'', ownerName:s };
  };

  // ---------- Events ----------
  const wireEvents = () => {
    el('btnAdd').addEventListener('click', () => openTaskModal(null));
    btnSaveTask.addEventListener('click', saveFromModal);

    weekPicker.addEventListener('change', () => {
      // normalize to Monday
      const iso = weekPicker.value || todayIso();
      selectedWeekStart = isoMondayOf(iso);
      weekPicker.value = selectedWeekStart;
      renderWeekLabel();
      renderTable();
    });

    currentUser.addEventListener('change', () => {
      currentUserId = currentUser.value;
    });

    filterOwner.addEventListener('change', renderTable);
    filterStatus.addEventListener('change', renderTable);
    filterGroup.addEventListener('change', renderTable);
    filterOverdue.addEventListener('change', renderTable);

    el('btnClearFilters').addEventListener('click', () => {
      filterOwner.value = '';
      filterStatus.value = '';
      filterGroup.value = '';
      filterOverdue.checked = false;
      renderTable();
    });

    el('btnExport').addEventListener('click', exportWeeklyReport);
    el('btnExportJson').addEventListener('click', (e) => { e.preventDefault(); exportJson(); });
    el('btnImportJson').addEventListener('click', (e) => { e.preventDefault(); fileJson.click(); });
    fileJson.addEventListener('change', async () => {
      const f = fileJson.files?.[0];
      if (f) await importJson(f);
      fileJson.value = '';
    });

    el('btnImportExcel').addEventListener('click', (e) => { e.preventDefault(); fileExcel.click(); });
    fileExcel.addEventListener('change', async () => {
      const f = fileExcel.files?.[0];
      if (f) await importExcel(f);
      fileExcel.value = '';
    });

    el('btnSettings').addEventListener('click', openSettings);
    el('btnSaveSettings').addEventListener('click', saveSettings);

    // Settings add buttons
    el('btnAddStaff').addEventListener('click', () => {
      meta.staff.push({ id:'', name:'' });
      renderStaffEditor();
    });
    el('btnAddStatus').addEventListener('click', () => { meta.statuses.push(''); renderListEditor(statusList, meta.statuses); });
    el('btnAddKpi').addEventListener('click', () => { meta.kpis.push(''); renderListEditor(kpiList, meta.kpis); });
    el('btnAddGroup').addEventListener('click', () => { meta.groups.push(''); renderListEditor(groupList, meta.groups); });
    el('btnAddMetric').addEventListener('click', () => { meta.metrics.push(''); renderListEditor(metricList, meta.metrics); });

    // Remove staff / list items (event delegation)
    staffList.addEventListener('click', (e) => {
      const btn = e.target.closest('button');
      if (!btn) return;
      if (btn.dataset.action === 'rmStaff') {
        const idx = Number(btn.dataset.idx);
        meta.staff.splice(idx, 1);
        renderStaffEditor();
      }
    });
    const listRemoveHandler = (container, arr, renderFn) => {
      container.addEventListener('click', (e) => {
        const btn = e.target.closest('button');
        if (!btn) return;
        if (btn.dataset.action === 'rmItem') {
          const idx = Number(btn.dataset.idx);
          arr.splice(idx, 1);
          renderFn();
        }
      });
      container.addEventListener('input', (e) => {
        const input = e.target.closest('input');
        if (!input) return;
        const idx = Number(input.dataset.idx);
        arr[idx] = input.value;
      });
    };
    listRemoveHandler(statusList, meta.statuses, () => renderListEditor(statusList, meta.statuses));
    listRemoveHandler(kpiList, meta.kpis, () => renderListEditor(kpiList, meta.kpis));
    listRemoveHandler(groupList, meta.groups, () => renderListEditor(groupList, meta.groups));
    listRemoveHandler(metricList, meta.metrics, () => renderListEditor(metricList, meta.metrics));

    // Staff inputs update
    staffList.addEventListener('input', (e) => {
      const input = e.target.closest('input');
      if (!input) return;
      const idx = Number(input.dataset.idx);
      const field = input.dataset.field;
      meta.staff[idx][field] = input.value;
    });

    // Table actions
    tasksTbody.addEventListener('click', async (e) => {
      const btn = e.target.closest('button');
      if (!btn) return;
      const action = btn.dataset.action;
      const id = btn.dataset.id;
      const t = tasks.find(x => x.id === id);
      if (!t) return;

      if (action === 'edit') {
        openTaskModal(t);
      } else if (action === 'del') {
        if (!confirm(`Xoá công việc ${id}?`)) return;
        await deleteTask(id);
        tasks = tasks.filter(x => x.id !== id);
        renderTable();
      }
    });

    toggleAdvanced.addEventListener('change', () => {
      advancedMode = toggleAdvanced.checked;
      const advHead = document.querySelector('.advanced-head');
      if (advancedMode) advHead.classList.remove('d-none'); else advHead.classList.add('d-none');
      renderTable();
    });
  };

  // ---------- Init ----------
  const init = async () => {
    loadMeta();
    initSupabaseIfNeeded();

    selectedWeekStart = isoMondayOf(todayIso());
    weekPicker.value = selectedWeekStart;
    renderWeekLabel();

    // Set defaults
    currentUserId = meta.staff.find(s => s.id !== '54000000')?.id || (meta.staff[0]?.id || '');
    advancedMode = false;
    toggleAdvanced.checked = false;
    document.querySelector('.advanced-head').classList.add('d-none');

    await fetchTasks();
    renderDropdowns();
    renderTable();
    wireEvents();
  };

  init();

})();
