(() => {
  'use strict';

  const DEFAULTS = window.APP_CONFIG || {};
  const LS_META  = 'kehoachtuan.meta.v1';
  const LS_TASKS = 'kehoachtuan.tasks.v1';

  // ---------- DOM ----------
  const $ = (id) => document.getElementById(id);
  const weekPicker = $('weekPicker');
  const mePicker = $('mePicker');
  const btnAdd = $('btnAdd');
  const btnCatalog = $('btnCatalog');
  const btnExport = $('btnExport');
  const exportMenu = $('exportMenu');
  const btnExportWeek = $('btnExportWeek');
  const btnExportJson = $('btnExportJson');
  const fileImportJson = $('fileImportJson');

  const sumTotal = $('sumTotal');
  const sumDone = $('sumDone');
  const sumOverdue = $('sumOverdue');
  const sumPct = $('sumPct');
  const syncStatus = $('syncStatus');
  const syncHint = $('syncHint');

  const filterAssignee = $('filterAssignee');
  const filterStatus = $('filterStatus');
  const filterGroup = $('filterGroup');
  const filterOverdue = $('filterOverdue');
  const btnClearFilter = $('btnClearFilter');

  const tasksTbody = $('tasksTbody');

  const subKpi = $('subKpi');
  const subMetric = $('subMetric');
  const subCommit = $('subCommit');
  const subActual = $('subActual');
  const subPriority = $('subPriority');
  const subCarry = $('subCarry');
  const subGiver = $('subGiver');

  // Task modal
  const modalTask = $('modalTask');
  const taskModalTitle = $('taskModalTitle');
  const btnSaveTask = $('btnSaveTask');
  const taskWarn = $('taskWarn');

  const fmId = $('fmId');
  const fmGroup = $('fmGroup');
  const fmAssignee = $('fmAssignee');
  const fmTask = $('fmTask');
  const fmDeadline = $('fmDeadline');
  const fmStatus = $('fmStatus');
  const fmPriority = $('fmPriority');
  const fmKpi = $('fmKpi');
  const fmMetric = $('fmMetric');
  const fmCarryY = $('fmCarryY');
  const fmCarryN = $('fmCarryN');
  const fmCommit = $('fmCommit');
  const fmActual = $('fmActual');
  const fmNote = $('fmNote');

  // Catalog modal
  const modalCatalog = $('modalCatalog');
  const staffTable = $('staffTable');
  const btnAddStaff = $('btnAddStaff');
  const statusList = $('statusList');
  const kpiList = $('kpiList');
  const groupList = $('groupList');
  const metricList = $('metricList');
  const priorityList = $('priorityList');

  const storageMode = $('storageMode');
  const pollSeconds = $('pollSeconds');
  const supabaseUrl = $('supabaseUrl');
  const supabaseKey = $('supabaseKey');

  const btnSaveCatalog = $('btnSaveCatalog');
  const catalogWarn = $('catalogWarn');

  // ---------- State ----------
  let meta = null;       // lists + storage settings
  let tasks = [];        // all tasks
  let selectedWeek = ''; // ISO Monday
  let pollTimer = null;
  let lastSync = null;

  const state = {
    filterAssignee: '',
    filterStatus: '',
    filterGroup: '',
    onlyOverdue: false,
  };

  // ---------- Utils ----------
  const pad2 = (n) => String(n).padStart(2, '0');
  const todayISO = () => {
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
  const mondayOf = (date) => {
    const d = new Date(date);
    d.setHours(0,0,0,0);
    const day = d.getDay(); // 0=Sun
    const diff = (day === 0 ? -6 : 1) - day;
    d.setDate(d.getDate() + diff);
    return d;
  };
  const mondayISOOf = (isoOrDate) => {
    const d = (isoOrDate instanceof Date) ? isoOrDate : new Date(String(isoOrDate));
    return mondayOf(d).toISOString().slice(0,10);
  };
  const isDone = (status) => String(status || '').toLowerCase() === 'done';
  const isOverdue = (t) => {
    if (!t.deadline) return false;
    if (isDone(t.status)) return false;
    return String(t.deadline) < todayISO();
  };
  const uuid = () => {
    if (window.crypto && crypto.randomUUID) return crypto.randomUUID();
    // Fallback uuid v4
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
      const r = Math.random()*16|0, v = c==='x'?r:(r&0x3|0x8);
      return v.toString(16);
    });
  };
  const uniq = (arr) => {
    const out = [];
    const seen = new Set();
    for (const x of arr) {
      const s = String(x ?? '').trim();
      if (!s) continue;
      const k = s.toLowerCase();
      if (seen.has(k)) continue;
      seen.add(k);
      out.push(s);
    }
    return out;
  };
  const escapeHtml = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

  const downloadText = (content, filename, mime='text/plain;charset=utf-8') => {
    const blob = new Blob([content], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 800);
  };

  // ---------- Modal helpers ----------
  const show = (el) => { el.hidden = false; };
  const hide = (el) => { el.hidden = true; };
  document.addEventListener('click', (e) => {
    const t = e.target;
    if (!(t instanceof HTMLElement)) return;
    const closeId = t.getAttribute('data-close');
    if (closeId) {
      const m = $(closeId);
      if (m) hide(m);
    }
  });
  // click outside card to close
  [modalTask, modalCatalog].forEach(m => {
    m.addEventListener('click', (e) => {
      if (e.target === m) hide(m);
    });
  });

  // Tabs in catalog
  modalCatalog.addEventListener('click', (e) => {
    const btn = e.target;
    if (!(btn instanceof HTMLElement)) return;
    if (!btn.classList.contains('tab')) return;
    const tabId = btn.getAttribute('data-tab');
    if (!tabId) return;

    [...modalCatalog.querySelectorAll('.tab')].forEach(x => x.classList.remove('active'));
    btn.classList.add('active');

    [...modalCatalog.querySelectorAll('.tabpane')].forEach(p => p.hidden = true);
    const pane = $(tabId);
    if (pane) pane.hidden = false;
  });

  // Export menu
  btnExport.addEventListener('click', () => {
    exportMenu.hidden = !exportMenu.hidden;
  });
  document.addEventListener('click', (e) => {
    const t = e.target;
    if (!(t instanceof HTMLElement)) return;
    if (t === btnExport) return;
    if (exportMenu.contains(t)) return;
    exportMenu.hidden = true;
  });

  // ---------- Meta (lists + storage) ----------
  const loadMeta = () => {
    const base = structuredClone(DEFAULTS);
    let saved = null;
    try { saved = JSON.parse(localStorage.getItem(LS_META) || 'null'); } catch { saved = null; }
    if (saved && typeof saved === 'object') {
      base.staff = Array.isArray(saved.staff) ? saved.staff : base.staff;
      base.kpis = Array.isArray(saved.kpis) ? saved.kpis : base.kpis;
      base.statuses = Array.isArray(saved.statuses) ? saved.statuses : base.statuses;
      base.priorities = Array.isArray(saved.priorities) ? saved.priorities : base.priorities;
      base.groups = Array.isArray(saved.groups) ? saved.groups : base.groups;
      base.metrics = Array.isArray(saved.metrics) ? saved.metrics : base.metrics;
      base.storage = { ...base.storage, ...(saved.storage || {}) };
      base.pollSeconds = Number(saved.pollSeconds || base.pollSeconds || 4);
    } else {
      base.pollSeconds = Number(base.pollSeconds || 4);
    }
    // defaults safety
    base.statuses = base.statuses?.length ? base.statuses : ['Not started','Doing','Done','Blocked'];
    base.priorities = base.priorities?.length ? base.priorities : ['A','B','C'];
    base.groups = base.groups?.length ? base.groups : [];
    base.metrics = base.metrics?.length ? base.metrics : [];
    base.kpis = base.kpis?.length ? base.kpis : [];
    base.staff = base.staff?.length ? base.staff : [];
    base.storage = base.storage || { mode:'local', supabaseUrl:'', supabaseAnonKey:'' };
    return base;
  };
  const saveMeta = () => {
    localStorage.setItem(LS_META, JSON.stringify(meta));
  };

  // ---------- Tasks storage ----------
  const loadLocalTasks = () => {
    try {
      const raw = JSON.parse(localStorage.getItem(LS_TASKS) || '[]');
      return Array.isArray(raw) ? raw : [];
    } catch {
      return [];
    }
  };
  const saveLocalTasks = () => {
    localStorage.setItem(LS_TASKS, JSON.stringify(tasks));
  };

  const sbHeaders = () => {
    return {
      'apikey': meta.storage.supabaseAnonKey,
      'Authorization': 'Bearer ' + meta.storage.supabaseAnonKey,
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    };
  };
  const sbBase = () => String(meta.storage.supabaseUrl || '').replace(/\/$/, '');
  const sbEnabled = () => meta.storage.mode === 'supabase' && !!meta.storage.supabaseUrl && !!meta.storage.supabaseAnonKey;

  const sbFetch = async (url, options={}) => {
    const res = await fetch(url, options);
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new Error('Supabase HTTP ' + res.status + ' ' + text);
    }
    const ct = res.headers.get('content-type') || '';
    if (ct.includes('application/json')) return res.json();
    return null;
  };

  const fetchTasks = async () => {
    if (!sbEnabled()) {
      tasks = loadLocalTasks();
      lastSync = new Date();
      render();
      return;
    }
    try {
      const url = sbBase() + '/rest/v1/tasks?select=*&order=created_at.asc';
      const data = await sbFetch(url, { headers: sbHeaders() });
      tasks = (data || []).map((r) => normalizeFromDb(r));
      lastSync = new Date();
      render();
    } catch (err) {
      console.error(err);
      setWarn(syncHint, 'Không đọc được dữ liệu Supabase. Kiểm tra URL/Key, RLS, bảng tasks.');
    }
  };

  const upsertTask = async (t) => {
    if (!sbEnabled()) {
      const idx = tasks.findIndex(x => x.id === t.id);
      if (idx >= 0) tasks[idx] = t; else tasks.push(t);
      saveLocalTasks();
      lastSync = new Date();
      render();
      return;
    }
    try {
      const url = sbBase() + '/rest/v1/tasks?on_conflict=id';
      const body = JSON.stringify([toDb(t)]);
      await sbFetch(url, {
        method: 'POST',
        headers: { ...sbHeaders(), 'Prefer':'resolution=merge-duplicates,return=minimal' },
        body
      });
      await fetchTasks();
    } catch (err) {
      console.error(err);
      alert('Lỗi khi lưu lên Supabase. Hãy kiểm tra RLS/policy hoặc cấu hình key.');
    }
  };

  const deleteTask = async (id) => {
    if (!sbEnabled()) {
      tasks = tasks.filter(t => t.id !== id);
      saveLocalTasks();
      lastSync = new Date();
      render();
      return;
    }
    try {
      const url = sbBase() + '/rest/v1/tasks?id=eq.' + encodeURIComponent(id);
      await sbFetch(url, {
        method: 'DELETE',
        headers: { ...sbHeaders(), 'Prefer':'return=minimal' }
      });
      await fetchTasks();
    } catch (err) {
      console.error(err);
      alert('Không xoá được trên Supabase. Kiểm tra policy.');
    }
  };

  // ---------- DB mapping ----------
  const normalizeFromDb = (r) => {
    return {
      id: r.id,
      seq: Number(r.seq || 0),
      weekStart: r.week_start || '',
      group: r.group_name || '',
      title: r.title || '',
      deadline: r.deadline || '',
      status: r.status || 'Not started',
      priority: r.priority || 'B',
      kpi: r.kpi || '',
      metric: r.metric || '',
      commit: (r.commit === null || r.commit === undefined) ? '' : r.commit,
      actual: (r.actual === null || r.actual === undefined) ? '' : r.actual,
      carryOver: r.carry_over || 'Y',
      ownerId: r.owner_id || '',
      ownerName: r.owner_name || '',
      note: r.note || '',
      assignedById: r.assigned_by_id || '',
      assignedByName: r.assigned_by_name || '',
      createdAt: r.created_at || '',
      updatedAt: r.updated_at || '',
    };
  };
  const toDb = (t) => {
    return {
      id: t.id,
      seq: t.seq,
      week_start: t.weekStart,
      group_name: t.group,
      title: t.title,
      deadline: t.deadline || null,
      status: t.status,
      priority: t.priority,
      kpi: t.kpi,
      metric: t.metric,
      commit: t.commit === '' ? null : (t.commit ?? null),
      actual: t.actual === '' ? null : (t.actual ?? null),
      carry_over: t.carryOver,
      owner_id: t.ownerId,
      owner_name: t.ownerName,
      note: t.note,
      assigned_by_id: t.assignedById,
      assigned_by_name: t.assignedByName,
      updated_at: new Date().toISOString(),
    };
  };

  // ---------- Rendering ----------
  const staffNameById = (id) => {
    const s = meta.staff.find(x => String(x.id) === String(id));
    return s ? s.name : '';
  };

  const visibleTasks = () => {
    const week = selectedWeek;
    const base = tasks.filter(t => {
      if (!week) return false;
      if (t.weekStart === week) return true;
      if (t.weekStart && t.weekStart < week && String(t.carryOver || 'Y').toUpperCase() === 'Y' && !isDone(t.status)) return true;
      return false;
    });
    return base.filter(t => {
      if (state.filterAssignee && String(t.ownerId) !== String(state.filterAssignee)) return false;
      if (state.filterStatus && String(t.status) !== String(state.filterStatus)) return false;
      if (state.filterGroup && String(t.group) !== String(state.filterGroup)) return false;
      if (state.onlyOverdue && !isOverdue(t)) return false;
      return true;
    }).sort((a,b) => {
      const ao = isOverdue(a) ? 0 : 1;
      const bo = isOverdue(b) ? 0 : 1;
      if (ao !== bo) return ao - bo;
      const ad = a.deadline || '9999-12-31';
      const bd = b.deadline || '9999-12-31';
      if (ad !== bd) return ad.localeCompare(bd);
      return (a.seq || 0) - (b.seq || 0);
    });
  };

  const renderSummary = (list) => {
    const total = list.length;
    const done = list.filter(t => isDone(t.status)).length;
    const overdue = list.filter(t => isOverdue(t)).length;
    const pct = total ? Math.round((done/total)*100) : 0;
    sumTotal.textContent = String(total);
    sumDone.textContent = String(done);
    sumOverdue.textContent = String(overdue);
    sumPct.textContent = pct + '%';
  };

  const setSubRow = (t) => {
    subKpi.textContent = t?.kpi || '—';
    subMetric.textContent = t?.metric || '—';
    subCommit.textContent = (t?.commit === '' || t?.commit === null || t?.commit === undefined) ? '—' : String(t.commit);
    subActual.textContent = (t?.actual === '' || t?.actual === null || t?.actual === undefined) ? '—' : String(t.actual);
    subPriority.textContent = t?.priority || '—';
    subCarry.textContent = t?.carryOver || '—';
    subGiver.textContent = t?.assignedByName || (t?.assignedById ? String(t.assignedById) : '—');
  };

  const render = () => {
    // Sync badge
    if (sbEnabled()) {
      syncStatus.textContent = 'supabase';
      syncHint.textContent = lastSync ? ('Đồng bộ: ' + lastSync.toLocaleTimeString()) : 'Đang đồng bộ...';
    } else {
      syncStatus.textContent = 'local';
      syncHint.textContent = 'Mỗi máy 1 dữ liệu';
    }

    const list = visibleTasks();
    renderSummary(list);

    if (!list.length) {
      tasksTbody.innerHTML = '<tr><td colspan="8" class="empty">Chưa có công việc trong tuần này. Bấm “+ Thêm việc”.</td></tr>';
      setSubRow(null);
      return;
    }

    const rows = list.map((t) => {
      const overdue = isOverdue(t);
      const cls = (overdue ? 'row-overdue' : '') + (isDone(t.status) ? ' row-done' : '');
      const owner = t.ownerName || staffNameById(t.ownerId) || t.ownerId || '';
      const note = t.note || '';
      return `
        <tr class="${cls}" data-id="${escapeHtml(t.id)}">
          <td class="col-id">${escapeHtml(String(t.seq || '').slice(-6) || '•')}</td>
          <td class="col-group">${escapeHtml(t.group || '')}</td>
          <td class="col-title">${escapeHtml(t.title || '')}</td>
          <td class="col-date">${escapeHtml(isoToVN(t.deadline))}</td>
          <td class="col-owner">${escapeHtml(owner)}</td>
          <td class="col-status">${escapeHtml(t.status || '')}</td>
          <td class="col-note">${escapeHtml(note)}</td>
          <td class="col-actions">
            <div class="actions">
              <button data-act="edit" data-id="${escapeHtml(t.id)}">Sửa</button>
              <button class="danger" data-act="del" data-id="${escapeHtml(t.id)}">Xoá</button>
            </div>
          </td>
        </tr>
      `;
    }).join('');
    tasksTbody.innerHTML = rows;

    // Subrow default: first task
    setSubRow(list[0]);
  };

  // ---------- Dropdown helpers ----------
  const fillSelect = (sel, items, { emptyLabel=null, valueKey=null, labelFn=null } = {}) => {
    sel.innerHTML = '';
    if (emptyLabel !== null) {
      const o = document.createElement('option');
      o.value = '';
      o.textContent = emptyLabel;
      sel.appendChild(o);
    }
    for (const it of items) {
      const o = document.createElement('option');
      if (valueKey) o.value = String(it[valueKey] ?? '');
      else o.value = String(it ?? '');
      o.textContent = labelFn ? labelFn(it) : String(it ?? '');
      sel.appendChild(o);
    }
  };

  const refreshDropdowns = () => {
    fillSelect(mePicker, meta.staff, { emptyLabel: '-- Chọn --', valueKey:'id', labelFn:(s)=>`${s.id} - ${s.name}` });
    fillSelect(fmAssignee, meta.staff, { emptyLabel: '-- Chọn --', valueKey:'id', labelFn:(s)=>`${s.id} - ${s.name}` });
    fillSelect(filterAssignee, meta.staff, { emptyLabel: '-- Lọc theo CB đầu mối --', valueKey:'id', labelFn:(s)=>s.name });
    fillSelect(fmGroup, meta.groups, { emptyLabel: '-- Chọn --' });
    fillSelect(filterGroup, meta.groups, { emptyLabel: '-- Lọc theo nhóm việc --' });
    fillSelect(fmStatus, meta.statuses, { emptyLabel: '-- Chọn --' });
    fillSelect(filterStatus, meta.statuses, { emptyLabel: '-- Lọc theo trạng thái --' });
    fillSelect(fmPriority, meta.priorities, { emptyLabel: '-- Chọn --' });
    fillSelect(fmKpi, meta.kpis, { emptyLabel: '-- (tuỳ chọn) --' });
    fillSelect(fmMetric, meta.metrics, { emptyLabel: '-- (tuỳ chọn) --' });
  };

  // ---------- Task modal ----------
  const clearTaskWarn = () => { taskWarn.hidden = true; taskWarn.textContent = ''; };
  const setTaskWarn = (msg) => { taskWarn.hidden = false; taskWarn.textContent = msg; };

  const openTaskModal = (task=null) => {
    clearTaskWarn();
    if (!task) {
      taskModalTitle.textContent = 'Thêm công việc';
      fmId.value = '';
      fmGroup.value = '';
      fmAssignee.value = '';
      fmTask.value = '';
      fmDeadline.value = '';
      fmStatus.value = 'Not started';
      fmPriority.value = 'B';
      fmKpi.value = '';
      fmMetric.value = '';
      fmCarryY.checked = true;
      fmCarryN.checked = false;
      fmCommit.value = '';
      fmActual.value = '';
      fmNote.value = '';
    } else {
      taskModalTitle.textContent = 'Sửa công việc';
      fmId.value = task.id;
      fmGroup.value = task.group || '';
      fmAssignee.value = task.ownerId || '';
      fmTask.value = task.title || '';
      fmDeadline.value = task.deadline || '';
      fmStatus.value = task.status || 'Not started';
      fmPriority.value = task.priority || 'B';
      fmKpi.value = task.kpi || '';
      fmMetric.value = task.metric || '';
      fmCarryY.checked = String(task.carryOver || 'Y').toUpperCase() === 'Y';
      fmCarryN.checked = !fmCarryY.checked;
      fmCommit.value = (task.commit === null || task.commit === undefined) ? '' : String(task.commit);
      fmActual.value = (task.actual === null || task.actual === undefined) ? '' : String(task.actual);
      fmNote.value = task.note || '';
    }
    show(modalTask);
  };

  btnAdd.addEventListener('click', () => openTaskModal(null));

  btnSaveTask.addEventListener('click', async () => {
    clearTaskWarn();
    const id = fmId.value || uuid();
    const group = String(fmGroup.value || '').trim();
    const ownerId = String(fmAssignee.value || '').trim();
    const title = String(fmTask.value || '').trim();
    const deadline = fmDeadline.value || '';
    const status = String(fmStatus.value || '').trim();
    const priority = String(fmPriority.value || 'B').trim();
    const kpi = String(fmKpi.value || '').trim();
    const metric = String(fmMetric.value || '').trim();
    const carryOver = (fmCarryN.checked ? 'N' : 'Y');
    const commit = (fmCommit.value === '' ? '' : Number(fmCommit.value));
    const actual = (fmActual.value === '' ? '' : Number(fmActual.value));
    const note = String(fmNote.value || '').trim();

    if (!group) return setTaskWarn('Vui lòng chọn Nhóm công việc.');
    if (!ownerId) return setTaskWarn('Vui lòng chọn CB đầu mối.');
    if (!title) return setTaskWarn('Vui lòng nhập Công việc / Hoạt động.');
    if (!deadline) return setTaskWarn('Vui lòng chọn Deadline.');
    if (!status) return setTaskWarn('Vui lòng chọn Trạng thái.');

    const meId = String(mePicker.value || '').trim();
    const tnow = new Date().toISOString();
    const existed = tasks.find(x => x.id === id);

    const task = {
      id,
      seq: existed?.seq || Date.now(),
      weekStart: selectedWeek,
      group,
      title,
      deadline,
      status,
      priority,
      kpi,
      metric,
      commit,
      actual,
      carryOver,
      ownerId,
      ownerName: staffNameById(ownerId) || existed?.ownerName || '',
      note,
      assignedById: existed?.assignedById || meId || '',
      assignedByName: existed?.assignedByName || (meId ? staffNameById(meId) : '') || '',
      createdAt: existed?.createdAt || tnow,
      updatedAt: tnow,
    };

    // If manager assigns, keep assignedBy updated
    if (meId) {
      task.assignedById = meId;
      task.assignedByName = staffNameById(meId) || '';
    }

    await upsertTask(task);
    hide(modalTask);
  });

  // ---------- Catalog modal ----------
  const clearCatalogWarn = () => { catalogWarn.hidden = true; catalogWarn.textContent = ''; };
  const setCatalogWarn = (msg) => { catalogWarn.hidden = false; catalogWarn.textContent = msg; };

  const renderStaffTable = () => {
    staffTable.innerHTML = '';
    for (let i=0;i<meta.staff.length;i++) {
      const s = meta.staff[i];
      const row = document.createElement('div');
      row.className = 'row';
      row.innerHTML = `
        <input data-staff="id" data-idx="${i}" value="${escapeHtml(s.id || '')}" placeholder="StaffID" />
        <input data-staff="name" data-idx="${i}" value="${escapeHtml(s.name || '')}" placeholder="Tên" />
        <button class="del" data-staffdel="${i}">Xoá</button>
      `;
      staffTable.appendChild(row);
    }
    if (!meta.staff.length) {
      const row = document.createElement('div');
      row.className = 'row';
      row.innerHTML = '<div style="grid-column:1/4;color:var(--muted);padding:6px 2px;">Chưa có cán bộ. Bấm “+ Thêm cán bộ”.</div>';
      staffTable.appendChild(row);
    }
  };

  const renderListEditor = (container, arr, key) => {
    container.innerHTML = '';
    for (let i=0;i<arr.length;i++) {
      const v = arr[i];
      const row = document.createElement('div');
      row.className = 'row';
      row.innerHTML = `
        <input data-list="${key}" data-idx="${i}" value="${escapeHtml(v)}" />
        <button class="del" data-listdel="${key}" data-idx="${i}">Xoá</button>
      `;
      container.appendChild(row);
    }
    if (!arr.length) {
      const row = document.createElement('div');
      row.className = 'row';
      row.innerHTML = '<div style="grid-column:1/3;color:var(--muted);padding:6px 2px;">Chưa có dữ liệu.</div>';
      container.appendChild(row);
    }
  };

  const openCatalog = () => {
    clearCatalogWarn();
    renderStaffTable();
    renderListEditor(statusList, meta.statuses, 'statuses');
    renderListEditor(kpiList, meta.kpis, 'kpis');
    renderListEditor(groupList, meta.groups, 'groups');
    renderListEditor(metricList, meta.metrics, 'metrics');
    renderListEditor(priorityList, meta.priorities, 'priorities');

    storageMode.value = meta.storage.mode || 'local';
    pollSeconds.value = String(Number(meta.pollSeconds || 4));
    supabaseUrl.value = meta.storage.supabaseUrl || '';
    supabaseKey.value = meta.storage.supabaseAnonKey || '';

    // default tab
    [...modalCatalog.querySelectorAll('.tab')].forEach((x,i)=>x.classList.toggle('active', i===0));
    [...modalCatalog.querySelectorAll('.tabpane')].forEach((p,i)=>p.hidden = i!==0);

    show(modalCatalog);
  };

  btnCatalog.addEventListener('click', openCatalog);

  btnAddStaff.addEventListener('click', () => {
    meta.staff.push({ id:'', code:'', name:'', dept:'' });
    renderStaffTable();
  });

  modalCatalog.addEventListener('click', (e) => {
    const t = e.target;
    if (!(t instanceof HTMLElement)) return;

    // delete staff
    const sdel = t.getAttribute('data-staffdel');
    if (sdel !== null) {
      const idx = Number(sdel);
      meta.staff.splice(idx, 1);
      renderStaffTable();
      return;
    }
    // add list item
    const addKey = t.getAttribute('data-addlist');
    if (addKey) {
      meta[addKey] = meta[addKey] || [];
      meta[addKey].push('');
      if (addKey==='statuses') renderListEditor(statusList, meta.statuses, 'statuses');
      if (addKey==='kpis') renderListEditor(kpiList, meta.kpis, 'kpis');
      if (addKey==='groups') renderListEditor(groupList, meta.groups, 'groups');
      if (addKey==='metrics') renderListEditor(metricList, meta.metrics, 'metrics');
      if (addKey==='priorities') renderListEditor(priorityList, meta.priorities, 'priorities');
      return;
    }
    // delete list item
    const ldel = t.getAttribute('data-listdel');
    const lidx = t.getAttribute('data-idx');
    if (ldel && lidx !== null) {
      const idx = Number(lidx);
      meta[ldel].splice(idx, 1);
      if (ldel==='statuses') renderListEditor(statusList, meta.statuses, 'statuses');
      if (ldel==='kpis') renderListEditor(kpiList, meta.kpis, 'kpis');
      if (ldel==='groups') renderListEditor(groupList, meta.groups, 'groups');
      if (ldel==='metrics') renderListEditor(metricList, meta.metrics, 'metrics');
      if (ldel==='priorities') renderListEditor(priorityList, meta.priorities, 'priorities');
      return;
    }
  });

  modalCatalog.addEventListener('input', (e) => {
    const t = e.target;
    if (!(t instanceof HTMLInputElement)) return;

    // staff edits
    const sField = t.getAttribute('data-staff');
    const sIdx = t.getAttribute('data-idx');
    if (sField && sIdx !== null) {
      const idx = Number(sIdx);
      meta.staff[idx][sField] = t.value.trim();
      return;
    }
    // list edits
    const lKey = t.getAttribute('data-list');
    const lIdx = t.getAttribute('data-idx');
    if (lKey && lIdx !== null) {
      const idx = Number(lIdx);
      meta[lKey][idx] = t.value;
    }
  });

  btnSaveCatalog.addEventListener('click', async () => {
    clearCatalogWarn();
    // sanitize
    meta.staff = meta.staff
      .map(s => ({ ...s, id:String(s.id||'').trim(), name:String(s.name||'').trim() }))
      .filter(s => s.id && s.name);

    // Unique staff by id
    const stSeen = new Set();
    meta.staff = meta.staff.filter(s => {
      const k = s.id;
      if (stSeen.has(k)) return false;
      stSeen.add(k);
      return true;
    });

    meta.statuses = uniq(meta.statuses || []);
    meta.kpis = uniq(meta.kpis || []);
    meta.groups = uniq(meta.groups || []);
    meta.metrics = uniq(meta.metrics || []);
    meta.priorities = uniq(meta.priorities || []);

    meta.storage.mode = storageMode.value || 'local';
    meta.pollSeconds = Math.max(2, Math.min(60, Number(pollSeconds.value || 4)));
    meta.storage.supabaseUrl = String(supabaseUrl.value || '').trim();
    meta.storage.supabaseAnonKey = String(supabaseKey.value || '').trim();

    if (meta.storage.mode === 'supabase' && (!meta.storage.supabaseUrl || !meta.storage.supabaseAnonKey)) {
      return setCatalogWarn('Bạn đã chọn Supabase nhưng chưa nhập URL và anon key.');
    }

    saveMeta();
    refreshDropdowns();
    restartPolling();
    await fetchTasks();
    hide(modalCatalog);
  });

  // ---------- Events: Filters ----------
  filterAssignee.addEventListener('change', () => { state.filterAssignee = filterAssignee.value; render(); });
  filterStatus.addEventListener('change', () => { state.filterStatus = filterStatus.value; render(); });
  filterGroup.addEventListener('change', () => { state.filterGroup = filterGroup.value; render(); });
  filterOverdue.addEventListener('change', () => { state.onlyOverdue = filterOverdue.checked; render(); });
  btnClearFilter.addEventListener('click', () => {
    state.filterAssignee = '';
    state.filterStatus = '';
    state.filterGroup = '';
    state.onlyOverdue = false;
    filterAssignee.value = '';
    filterStatus.value = '';
    filterGroup.value = '';
    filterOverdue.checked = false;
    render();
  });

  // Table actions
  tasksTbody.addEventListener('click', async (e) => {
    const t = e.target;
    if (!(t instanceof HTMLElement)) return;

    const act = t.getAttribute('data-act');
    const id = t.getAttribute('data-id');
    if (!act || !id) {
      // row click -> update subhead
      const tr = (t.closest('tr'));
      if (tr) {
        const rid = tr.getAttribute('data-id');
        const item = tasks.find(x => x.id === rid);
        if (item) setSubRow(item);
      }
      return;
    }

    if (act === 'edit') {
      const item = tasks.find(x => x.id === id);
      if (item) openTaskModal(item);
    }
    if (act === 'del') {
      const ok = confirm('Xoá công việc này?');
      if (!ok) return;
      await deleteTask(id);
    }
  });

  // ---------- Week & Me ----------
  weekPicker.addEventListener('change', () => {
    const val = weekPicker.value;
    selectedWeek = val ? mondayISOOf(val) : mondayISOOf(new Date());
    weekPicker.value = selectedWeek; // snap to Monday
    render();
  });

  // ---------- Export ----------
  const buildExportRows = (list) => {
    return list.map(t => {
      return {
        ID: t.seq ? String(t.seq).slice(-6) : '',
        WeekStart: t.weekStart,
        Group: t.group,
        Task: t.title,
        Deadline: t.deadline,
        AssigneeID: t.ownerId,
        Assignee: t.ownerName || staffNameById(t.ownerId),
        Status: t.status,
        Priority: t.priority,
        KPI: t.kpi,
        Metric: t.metric,
        Commit: t.commit,
        Actual: t.actual,
        CarryOver: t.carryOver,
        AssignedBy: t.assignedByName || t.assignedById,
        Note: t.note,
        UpdatedAt: t.updatedAt,
      };
    });
  };

  const buildSummaryByStaff = (list) => {
    const by = new Map();
    for (const t of list) {
      const key = t.ownerId || 'UNKNOWN';
      if (!by.has(key)) by.set(key, []);
      by.get(key).push(t);
    }
    const rows = [];
    for (const [ownerId, arr] of by.entries()) {
      const total = arr.length;
      const done = arr.filter(x=>isDone(x.status)).length;
      const overdue = arr.filter(x=>isOverdue(x)).length;
      const pct = total ? Math.round(done/total*100) : 0;
      const commit = arr.reduce((s,x)=>s + (Number(x.commit)||0), 0);
      const actual = arr.reduce((s,x)=>s + (Number(x.actual)||0), 0);
      rows.push({
        AssigneeID: ownerId,
        Assignee: staffNameById(ownerId) || '',
        TotalTasks: total,
        Done: done,
        Overdue: overdue,
        Pct: pct + '%',
        CommitSum: commit,
        ActualSum: actual,
      });
    }
    rows.sort((a,b)=> (a.Assignee||'').localeCompare(b.Assignee||''));
    return rows;
  };

  const exportWeek = () => {
    const list = visibleTasks();
    const week = selectedWeek || mondayISOOf(new Date());
    const rows = buildExportRows(list);
    const summary = buildSummaryByStaff(list);

    const fname = `BaoCao_Tuan_${week}`;

    if (window.XLSX) {
      const wb = XLSX.utils.book_new();
      const ws1 = XLSX.utils.json_to_sheet(rows);
      const ws2 = XLSX.utils.json_to_sheet(summary);
      XLSX.utils.book_append_sheet(wb, ws1, 'TASKS_WEEK');
      XLSX.utils.book_append_sheet(wb, ws2, 'SUMMARY_BY_STAFF');
      const out = XLSX.write(wb, { bookType:'xlsx', type:'array' });
      const blob = new Blob([out], { type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = fname + '.xlsx';
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(()=>URL.revokeObjectURL(url), 800);
      return;
    }

    // CSV fallback (2 files)
    const bom = '\ufeff';
    const toCsv = (arr) => {
      if (!arr.length) return '';
      const cols = Object.keys(arr[0]);
      const esc = (v) => '"' + String(v ?? '').replace(/"/g,'""') + '"';
      const lines = [cols.map(esc).join(',')];
      for (const r of arr) {
        lines.push(cols.map(c=>esc(r[c])).join(','));
      }
      return bom + lines.join('\n');
    };
    downloadText(toCsv(rows), fname + '_tasks.csv', 'text/csv;charset=utf-8');
    downloadText(toCsv(summary), fname + '_summary.csv', 'text/csv;charset=utf-8');
  };

  btnExportWeek.addEventListener('click', () => {
    exportMenu.hidden = true;
    exportWeek();
  });

  btnExportJson.addEventListener('click', () => {
    exportMenu.hidden = true;
    const payload = {
      meta,
      tasks,
      exportedAt: new Date().toISOString(),
    };
    downloadText(JSON.stringify(payload, null, 2), 'Kehoachtuan_backup.json', 'application/json;charset=utf-8');
  });

  fileImportJson.addEventListener('change', async () => {
    const f = fileImportJson.files && fileImportJson.files[0];
    if (!f) return;
    try {
      const text = await f.text();
      const obj = JSON.parse(text);
      if (obj.meta) meta = obj.meta;
      if (Array.isArray(obj.tasks)) tasks = obj.tasks;
      saveMeta();
      saveLocalTasks();
      refreshDropdowns();
      restartPolling();
      render();
      alert('Import JSON thành công (lưu local).');
    } catch (err) {
      console.error(err);
      alert('Import JSON thất bại.');
    } finally {
      fileImportJson.value = '';
    }
  });

  // ---------- Polling ----------
  const restartPolling = () => {
    if (pollTimer) clearInterval(pollTimer);
    pollTimer = null;

    if (!sbEnabled()) return;

    const sec = Math.max(2, Math.min(60, Number(meta.pollSeconds || 4)));
    pollTimer = setInterval(() => {
      fetchTasks();
    }, sec * 1000);
  };

  // ---------- Minor helpers ----------
  const setWarn = (el, msg) => {
    el.textContent = msg;
  };

  // ---------- Init ----------
  const init = async () => {
    meta = loadMeta();

    selectedWeek = mondayISOOf(new Date());
    weekPicker.value = selectedWeek;

    refreshDropdowns();

    // Filters placeholders
    filterAssignee.value = '';
    filterStatus.value = '';
    filterGroup.value = '';

    // Load tasks
    await fetchTasks();
    restartPolling();
  };

  init();
})();
