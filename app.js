/* Kehoachtuan v6.1.6 - Tasks + Forecast (Card view) - Local / Supabase
   - Forecast card UI (mobile-friendly)
   - Excel export matches Du kien tuan.xlsx layout
*/
(() => {
  "use strict";
  const CFG = window.CONFIG || {};
  const VERSION = "6.1.0";

  // ---- Storage keys ----
  const KEY_LISTS = "kehoachtuan.lists.v6";
  const KEY_SETTINGS = "kehoachtuan.settings.v6";
  const KEY_TASKS_LOCAL = "kehoachtuan.tasks.v6";
  const KEY_FC_LOCAL = "kehoachtuan.forecast.v6";

  // ---- Helpers ----
  const $ = (s) => document.querySelector(s);
  const $$ = (s) => Array.from(document.querySelectorAll(s));
  const pad2 = (n) => String(n).padStart(2, "0");
  const toISO = (d) => `${d.getFullYear()}-${pad2(d.getMonth()+1)}-${pad2(d.getDate())}`;

  function parseISO(s){
    const m=/^(\d{4})-(\d{2})-(\d{2})$/.exec(String(s||"").trim());
    if(!m) return null;
    const d=new Date(+m[1], +m[2]-1, +m[3]);
    d.setHours(0,0,0,0);
    return d;
  }
  function fmtDDMMYYYY(iso){
    const d=parseISO(iso); if(!d) return "";
    return `${pad2(d.getDate())}/${pad2(d.getMonth()+1)}/${d.getFullYear()}`;
  }
  function mondayOf(d){
    const x=new Date(d.getFullYear(), d.getMonth(), d.getDate());
    const day=x.getDay(); // 0 Sun
    const diff=(day===0?-6:1)-day;
    x.setDate(x.getDate()+diff);
    x.setHours(0,0,0,0);
    return x;
  }
  function pickWeekStartISO(iso){
    const d=parseISO(iso)||new Date();
    return toISO(mondayOf(d));
  }
  function weekEndISO(weekStartISO){
    const d=parseISO(weekStartISO)||mondayOf(new Date());
    const end=new Date(d);
    end.setDate(end.getDate()+5); // Mon->Sat (like sample)
    return toISO(end);
  }
  function today0(){ const t=new Date(); t.setHours(0,0,0,0); return t; }
  function escapeHtml(s){
    return String(s??"").replace(/[&<>"']/g, c => ({ "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;" }[c]));
  }
  function numOrNull(v){
    if(v===null||v===undefined||v==="") return null;
    const n=Number(v);
    return Number.isFinite(n)?n:null;
  }
  function fmtNum(n){
    if(n===null||n===undefined||n==="") return "";
    const x=Number(n); if(!Number.isFinite(x)) return "";
    return x.toLocaleString("vi-VN",{maximumFractionDigits:3});
  }

  function loadJSON(key){ try { return JSON.parse(localStorage.getItem(key)||"null"); } catch { return null; } }
  function saveJSON(key,obj){ localStorage.setItem(key, JSON.stringify(obj)); }

  function getSettings(){
    const s=loadJSON(KEY_SETTINGS)||{};
    return {
      storageMode: s.storageMode || "local",
      supabaseUrl: s.supabaseUrl || "",
      supabaseAnonKey: s.supabaseAnonKey || "",
      syncSeconds: Math.max(3, Number(s.syncSeconds || 5)),
    };
  }

  function nonEmptyArr(x){ return Array.isArray(x) && x.length>0; }

  function getLists(){
    const saved=loadJSON(KEY_LISTS)||{};
    return {
      staff: nonEmptyArr(saved.staff) ? saved.staff : (CFG.staff||[]),
      groups: nonEmptyArr(saved.groups) ? saved.groups : (CFG.groups||[]),
      statuses: nonEmptyArr(saved.statuses) ? saved.statuses : (CFG.statuses||["Not started","Doing","Done","Blocked"]),
      priorities: nonEmptyArr(saved.priorities) ? saved.priorities : (CFG.priorities||["A","B","C"]),
      kpis: nonEmptyArr(saved.kpis) ? saved.kpis : (CFG.kpis||[]),
      outputMetrics: nonEmptyArr(saved.outputMetrics) ? saved.outputMetrics : (CFG.outputMetrics||[]),
      forecastMetrics: nonEmptyArr(saved.forecastMetrics) ? saved.forecastMetrics : (CFG.forecastMetrics||[]),
    };
  }

  function staffById(id){
    return (getLists().staff||[]).find(s => String(s.id)===String(id)) || null;
  }
  function isManager(meId){
    return (CFG.managerIds||[]).map(String).includes(String(meId||""));
  }

  // ---- Supabase REST helpers ----
  function sbBase(){
    const s=getSettings();
    return String(s.supabaseUrl||"").trim().replace(/\/+$/,"");
  }
  function sbHeaders(){
    const key=String(getSettings().supabaseAnonKey||"").trim();
    return {
      "apikey": key,
      "Authorization": `Bearer ${key}`,
      "Content-Type": "application/json",
      "Prefer": "return=representation",
    };
  }
  function sbUrl(path){ return `${sbBase()}/rest/v1/${path}`; }

  // ---- State ----
  const state={
    week: pickWeekStartISO(toISO(new Date())),
    meId:"",
    view:"tasks",
    filterAssignee:"",
    filterStatus:"",
    filterGroup:"",
    onlyOverdue:false,
    tasks:[],
    forecast: loadJSON(KEY_FC_LOCAL) || {}, // key: week|staff|metric
    fcStaff:"",
    fcEditAdmin:false,
    syncing:false,
    timer:null
  };

  // ---- DOM ----
  const elWeek=$("#weekPicker"), elMe=$("#mePicker");
  const btnAdd=$("#btnAdd"), btnExport=$("#btnExport"), btnLists=$("#btnLists");
  const tabTasks=$("#tabTasks"), tabForecast=$("#tabForecast");
  const viewTasks=$("#viewTasks"), viewForecast=$("#viewForecast");

  const tbody=$("#tasksTbody");
  const sumTotal=$("#sumTotal"), sumDone=$("#sumDone"), sumOverdue=$("#sumOverdue"), sumPct=$("#sumPct");
  const filterAssignee=$("#filterAssignee"), filterStatus=$("#filterStatus"), filterGroup=$("#filterGroup");
  const filterOverdue=$("#filterOverdue"), btnClear=$("#btnClearFilter");

  const syncDot=$("#syncDot"), syncText=$("#syncText");

  // Task modal
  const taskBackdrop=$("#taskBackdrop"), taskClose=$("#taskClose"), taskTitle=$("#taskTitle"), taskForm=$("#taskForm"), btnCancel=$("#btnCancel");
  const fmId=$("#fmId"), fmGroup=$("#fmGroup"), fmOwner=$("#fmOwner"), fmTitle=$("#fmTitle"), fmDeadline=$("#fmDeadline"), fmStatus=$("#fmStatus");
  const fmPriority=$("#fmPriority"), fmCarry=$("#fmCarry"), fmKpi=$("#fmKpi"), fmMetric=$("#fmMetric"), fmCommit=$("#fmCommit"), fmActual=$("#fmActual"), fmNote=$("#fmNote");

  // Lists modal
  const listsBackdrop=$("#listsBackdrop"), listsClose=$("#listsClose"), btnListsCancel=$("#btnListsCancel"), btnListsSave=$("#btnListsSave");
  const staffList=$("#staffList"), statusList=$("#statusList"), groupList=$("#groupList"), priorityList=$("#priorityList"), kpiList=$("#kpiList"), metricList=$("#metricList");
  const btnAddStaff=$("#btnAddStaff"), btnAddStatus=$("#btnAddStatus"), btnAddGroup=$("#btnAddGroup"), btnAddPriority=$("#btnAddPriority"), btnAddKpi=$("#btnAddKpi"), btnAddMetric=$("#btnAddMetric");
  const stMode=$("#stMode"), stInterval=$("#stInterval"), stUrl=$("#stUrl"), stKey=$("#stKey");

  // Forecast
  const fcStaffFilter=$("#fcStaffFilter"), btnFcImport=$("#btnFcImport"), btnFcToggle=$("#btnFcToggleEdit");
  const fcImportFile=$("#fcImportFile");
  const fcCards=$("#fcCards");

  // ---- UI helpers ----
  function mark(ok, text){
    syncDot.classList.remove("ok","bad");
    syncDot.classList.add(ok ? "ok" : "bad");
    syncText.textContent = text;
  }

  function closeModals(){
    taskBackdrop.classList.remove("open");
    listsBackdrop.classList.remove("open");
    document.body.classList.remove("modal-open");
    document.body.style.overflow="";
  }
  function openModal(el){
    closeModals();
    el.classList.add("open");
    document.body.classList.add("modal-open");
    document.body.style.overflow="hidden";
  }

  function fillSelect(el, items, opts={}){
    const {valueKey=null,labelFn=null,emptyLabel=null}=opts;
    el.innerHTML="";
    if(emptyLabel!==null){
      const o=document.createElement("option");
      o.value=""; o.textContent=emptyLabel;
      el.appendChild(o);
    }
    for(const it of items){
      const o=document.createElement("option");
      o.value=valueKey ? String(it[valueKey]??"") : String(it??"");
      o.textContent=labelFn ? labelFn(it) : String(it?.name ?? it);
      el.appendChild(o);
    }
  }

  function refreshDropdowns(){
    const L=getLists();
    const staff=L.staff||[];
    fillSelect(elMe, staff, {valueKey:"id", labelFn:s=>`${s.id} - ${s.name}`, emptyLabel:"-- Chọn --"});
    fillSelect(fmOwner, staff, {valueKey:"id", labelFn:s=>`${s.id} - ${s.name}`, emptyLabel:"-- Chọn --"});
    fillSelect(filterAssignee, staff, {valueKey:"id", labelFn:s=>s.name, emptyLabel:"-- Lọc theo CB đầu mối --"});

    fillSelect(fmGroup, L.groups||[], {emptyLabel:"-- Chọn --"});
    fillSelect(filterGroup, L.groups||[], {emptyLabel:"-- Lọc theo nhóm việc --"});
    fillSelect(fmStatus, L.statuses||[], {emptyLabel:"-- Chọn --"});
    fillSelect(filterStatus, L.statuses||[], {emptyLabel:"-- Lọc theo trạng thái --"});
    fillSelect(fmPriority, L.priorities||[], {emptyLabel:"-- Chọn --"});
    fillSelect(fmCarry, ["Y","N"], {emptyLabel:"-- Chọn --"});
    fillSelect(fmKpi, L.kpis||[], {emptyLabel:"-- (tuỳ chọn) --"});
    fillSelect(fmMetric, L.outputMetrics||[], {emptyLabel:"-- (tuỳ chọn) --"});

    // forecast staff filter (exclude ALL)
    fillSelect(fcStaffFilter, staff.filter(s=>String(s.id)!=="54000600"), {valueKey:"id", labelFn:s=>`${s.id} - ${s.name}`, emptyLabel:"-- Xem tất cả cán bộ --"});

    if(state.meId) elMe.value=state.meId;
    if(state.filterAssignee) filterAssignee.value=state.filterAssignee;
    if(state.filterStatus) filterStatus.value=state.filterStatus;
    if(state.filterGroup) filterGroup.value=state.filterGroup;
    if(state.fcStaff) fcStaffFilter.value=state.fcStaff;
  }

  // ---- Task logic ----
  function isDone(status){ return String(status||"").toLowerCase()==="done"; }
  function isOverdue(t){
    if(!t.deadline || isDone(t.status)) return false;
    const dl=parseISO(t.deadline); if(!dl) return false;
    return dl < today0();
  }

  function visibleTasks(){
    const week=state.week;
    const base=state.tasks.filter(t=>{
      if(t.weekStart===week) return true;
      if(t.weekStart && t.weekStart<week && String(t.carryOver||"Y").toUpperCase()==="Y" && !isDone(t.status)) return true;
      return false;
    });
    return base.filter(t=>{
      if(state.filterAssignee && String(t.ownerId)!==String(state.filterAssignee)) return false;
      if(state.filterStatus && String(t.status)!==String(state.filterStatus)) return false;
      if(state.filterGroup && String(t.group)!==String(state.filterGroup)) return false;
      if(state.onlyOverdue && !isOverdue(t)) return false;
      return true;
    }).map(t=>{
      const s=staffById(t.ownerId);
      return {...t, ownerName: s? s.name : (t.ownerName||t.ownerId)};
    }).sort((a,b)=>{
      const ao=isOverdue(a)?0:1, bo=isOverdue(b)?0:1;
      if(ao!==bo) return ao-bo;
      return (a.deadline||"").localeCompare(b.deadline||"");
    });
  }

  function renderTasks(){
    const vis=visibleTasks();
    const total=vis.length;
    const done=vis.filter(t=>isDone(t.status)).length;
    const overdue=vis.filter(t=>isOverdue(t)).length;
    sumTotal.textContent=String(total);
    sumDone.textContent=String(done);
    sumOverdue.textContent=String(overdue);
    sumPct.textContent= total ? `${Math.round(done/total*100)}%` : "0%";

    if(!vis.length){
      tbody.innerHTML=`<tr><td colspan="8" style="padding:18px;color:#5b6b67">Chưa có công việc trong tuần này. Bấm “+ Thêm việc”.</td></tr>`;
      return;
    }

    tbody.innerHTML=vis.map(t=>{
      const meta=[
        t.kpi?`KPI: ${escapeHtml(t.kpi)}`:"",
        t.metric?`Metric: ${escapeHtml(t.metric)}`:"",
        t.commit!==""?`Commit: ${escapeHtml(t.commit)}`:"",
        t.actual!==""?`Actual: ${escapeHtml(t.actual)}`:"",
        `Priority: ${escapeHtml(t.priority||"")}`,
        `CarryOver: ${escapeHtml(t.carryOver||"Y")}`,
        t.assignedByName?`Giao bởi: ${escapeHtml(t.assignedByName)}`:""
      ].filter(Boolean).join(" • ");
      const idLabel=t.seq?`#${t.seq}`:(t.id||"").slice(0,8);
      return `<tr class="${isOverdue(t)?"row-overdue":""}">
        <td class="fcNum" data-label="ID">${escapeHtml(idLabel)}</td>
        <td data-label="Nhóm công việc">${escapeHtml(t.group||"")}</td>
        <td data-label="Công việc / Hoạt động"><div style="font-weight:800">${escapeHtml(t.title||"")}</div>
            <div style="margin-top:6px;color:#5b6b67;font-size:12px">${escapeHtml(meta)}</div></td>
        <td class="fcNum" data-label="Deadline">${escapeHtml(fmtDDMMYYYY(t.deadline))}</td>
        <td data-label="CB đầu mối">${escapeHtml(t.ownerName||t.ownerId||"")}</td>
        <td data-label="Trạng thái">${escapeHtml(t.status||"")}</td>
        <td data-label="Kết quả / Ghi chú">${escapeHtml(t.note||"")}</td>
        <td data-label="Tác vụ">
          <button class="btn-mini" data-act="edit" data-id="${escapeHtml(t.id)}">Sửa</button>
          <button class="btn-mini danger" data-act="del" data-id="${escapeHtml(t.id)}">Xoá</button>
        </td>
      </tr>`;
    }).join("");
  }

  // ---- Forecast logic (card view) ----
  function fcKey(week, staffId, metricKey){ return `${week}|${staffId}|${metricKey}`; }
  function getFcRow(week, staffId, metricKey){
    const k=fcKey(week, staffId, metricKey);
    return state.forecast[k] || {weekStart:week, staffId, metricKey, actual:null, quarterPlan:null, weekPlan:null, note:""};
  }
  function setFcRow(row){
    state.forecast[fcKey(row.weekStart,row.staffId,row.metricKey)] = row;
  }

  function computeDeltaGap(row, kind){
    const a=numOrNull(row.actual), w=numOrNull(row.weekPlan), q=numOrNull(row.quarterPlan);
    const delta = (kind==="5col") ? ((a!==null && w!==null) ? (w-a) : null) : null;
    const gap = (a!==null && q!==null) ? (a-q) : null;
    return {a,w,q,delta,gap};
  }

  function sumMetric(metricKey){
    const L=getLists();
    const staff=L.staff.filter(s=>String(s.id)!=="54000600");
    let A=0,W=0,Q=0,ha=false,hw=false,hq=false;
    for(const s of staff){
      const row=getFcRow(state.week, s.id, metricKey);
      const a=numOrNull(row.actual), w=numOrNull(row.weekPlan), q=numOrNull(row.quarterPlan);
      if(a!==null){A+=a;ha=true;}
      if(w!==null){W+=w;hw=true;}
      if(q!==null){Q+=q;hq=true;}
    }
    return {A:ha?A:null, W:hw?W:null, Q:hq?Q:null};
  }

  function renderForecastCards(){
    const L=getLists();
    const staffAll=L.staff.filter(s=>String(s.id)!=="54000600");
    const metrics=L.forecastMetrics || [];

    const visibleStaff = state.fcStaff
      ? staffAll.filter(s=>String(s.id)===String(state.fcStaff))
      : staffAll;

    const meIsMgr=isManager(state.meId);
    const allowAdmin = state.fcEditAdmin && meIsMgr;

    const cards=[];

    // Manager total card
    if(meIsMgr && !state.fcStaff){
      const rowsHtml = metrics.map(m=>{
        const sums = sumMetric(m.key);
        const a=sums.A, w=sums.W, q=sums.Q;
        const delta = (m.kind==="5col" && a!==null && w!==null) ? (w-a) : null;
        const gap = (a!==null && q!==null) ? (a-q) : null;
        const dCls = delta===null ? "" : (delta<0 ? "neg":"pos");
        const gCls = gap===null ? "" : (gap<0 ? "neg":"pos");
        return `<tr>
          <td><span class="fcMetric">${escapeHtml(m.name)}</span>${m.unit?`<span class="fcUnit">${escapeHtml(m.unit)}</span>`:""}</td>
          <td class="fcNum">${a===null?"":fmtNum(a)}</td>
          <td class="fcNum">${w===null?"":fmtNum(w)}</td>
          <td class="fcNum"><span class="fcDelta ${dCls}">${delta===null?"":fmtNum(delta)}</span></td>
          <td class="fcNum">${q===null?"":fmtNum(q)}</td>
          <td class="fcNum"><span class="fcGap ${gCls}">${gap===null?"":fmtNum(gap)}</span></td>
        </tr>`;
      }).join("");

      cards.push(`<div class="fcCard">
        <div class="fcCardHead">
          <div>
            <div class="fcTitle">TỔNG PHÒNG</div>
            <div class="fcSubtitle">Tổng hợp theo tất cả cán bộ • tuần ${escapeHtml(fmtDDMMYYYY(state.week))}</div>
          </div>
          <div class="fcBadge">Quản lý</div>
        </div>
        <table class="fcMini">
          <thead><tr>
            <th>Chỉ tiêu</th><th>Đã TH</th><th>KH Tuần</th><th>Δ</th><th>KH Quý</th><th>GAP</th>
          </tr></thead>
          <tbody>${rowsHtml}</tbody>
        </table>
      </div>`);
    }

    // Staff cards
    for(const s of visibleStaff){
      const rowsHtml = metrics.map(m=>{
        const row=getFcRow(state.week, s.id, m.key);
        const {a,w,q,delta,gap} = computeDeltaGap(row, m.kind);
        const dCls = delta===null ? "" : (delta<0 ? "neg":"pos");
        const gCls = gap===null ? "" : (gap<0 ? "neg":"pos");

        const canEditWeek = (String(state.meId)===String(s.id)) || meIsMgr;
        const roWeek = !canEditWeek;
        const roAdmin = !allowAdmin;

        return `<tr>
          <td><span class="fcMetric">${escapeHtml(m.name)}</span>${m.unit?`<span class="fcUnit">${escapeHtml(m.unit)}</span>`:""}</td>
          <td><input data-fc="1" data-field="actual" data-staff="${escapeHtml(s.id)}" data-metric="${escapeHtml(m.key)}"
                type="number" step="any" value="${a===null?"":a}" ${roAdmin?"readonly":""}></td>
          <td><input data-fc="1" data-field="weekPlan" data-staff="${escapeHtml(s.id)}" data-metric="${escapeHtml(m.key)}"
                type="number" step="any" value="${w===null?"":w}" ${roWeek?"readonly":""}></td>
          <td class="fcNum"><span class="fcDelta ${dCls}">${delta===null?"":fmtNum(delta)}</span></td>
          <td><input data-fc="1" data-field="quarterPlan" data-staff="${escapeHtml(s.id)}" data-metric="${escapeHtml(m.key)}"
                type="number" step="any" value="${q===null?"":q}" ${roAdmin?"readonly":""}></td>
          <td class="fcNum"><span class="fcGap ${gCls}">${gap===null?"":fmtNum(gap)}</span></td>
        </tr>`;
      }).join("");

      const badge = (String(state.meId)===String(s.id)) ? "Tôi" : (meIsMgr ? "Xem/Giao" : "CB");
      cards.push(`<div class="fcCard">
        <div class="fcCardHead">
          <div>
            <div class="fcTitle">${escapeHtml(s.id)} - ${escapeHtml(s.name)}</div>
            <div class="fcSubtitle">Nhập KH Tuần • Delta/GAP tự tính</div>
          </div>
          <div class="fcBadge">${escapeHtml(badge)}</div>
        </div>
        <table class="fcMini">
          <thead><tr>
            <th>Chỉ tiêu</th><th>Đã TH</th><th>KH Tuần</th><th>Δ</th><th>KH Quý</th><th>GAP</th>
          </tr></thead>
          <tbody>${rowsHtml}</tbody>
        </table>
      </div>`);
    }

    fcCards.innerHTML = cards.join("");
  }

  // ---- Forecast save (debounced) ----
  const fcTimers = new Map();
  function scheduleSaveFc(staffId, metricKey){
    const k=`${staffId}|${metricKey}`;
    if(fcTimers.has(k)) clearTimeout(fcTimers.get(k));
    fcTimers.set(k, setTimeout(()=>{ fcTimers.delete(k); saveForecastRow(staffId, metricKey); }, 450));
  }

  async function sbUpsertForecastRow(row){
    const url = sbUrl("weekly_forecast?on_conflict=week_start,staff_id,metric_key");
    const headers = sbHeaders();
    headers["Prefer"] = "return=representation,resolution=merge-duplicates";
    const payload=[{
      week_start: row.weekStart,
      staff_id: row.staffId,
      metric_key: row.metricKey,
      actual: row.actual,
      quarter_plan: row.quarterPlan,
      week_plan: row.weekPlan,
      note: row.note || null,
      updated_by_id: state.meId || null,
      updated_by_name: (staffById(state.meId)||{}).name || null,
      updated_at: new Date().toISOString()
    }];
    const res = await fetch(url, {method:"POST", headers, body: JSON.stringify(payload)});
    if(!res.ok) throw new Error("upsert forecast failed " + res.status);
  }

  async function saveForecastRow(staffId, metricKey){
    // Always save locally (so reload is instant)
    saveJSON(KEY_FC_LOCAL, state.forecast);

    const s=getSettings();
    if(s.storageMode==="supabase"){
      try{
        const row=getFcRow(state.week, staffId, metricKey);
        await sbUpsertForecastRow(row);
        mark(true, "supabase • saved");
      }catch(e){
        console.error(e);
        mark(false, "supabase • lỗi ghi");
      }
    }else{
      mark(true, "local • saved");
    }
  }

  // ---- Import forecast (Actual + QuarterPlan) from Excel sample ----
  async function importForecastExcel(file){
    const data = new Uint8Array(await file.arrayBuffer());
    const wb = XLSX.read(data, {type:"array"});
    const ws = wb.Sheets[wb.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json(ws, {header:1, raw:true});
    const staffSet = new Set(getLists().staff.map(s=>String(s.id)));

    // Mapping based on Du kien tuan.xlsx columns (0-based):
    const map = [
      { key:"HDV_CUOI_KY", actual:2, quarter:5 },
      { key:"DU_NO_CUOI_KY", actual:7, quarter:10 },
      { key:"TK_HKD", actual:12, quarter:14 },
      { key:"THE_TD", actual:16, quarter:18 },
      { key:"HH_BAO_HIEM", actual:20, quarter:22 },
      { key:"SMARTBANKING", actual:24, quarter:26 },
    ];

    let applied=0;
    for(const r of rows){
      const colB = r[1];
      if(!colB) continue;
      const m = /^\s*(\d{6,})\s*[-–]\s*/.exec(String(colB));
      if(!m) continue;
      const staffId = m[1];
      if(!staffSet.has(String(staffId))) continue;

      for(const mm of map){
        const row=getFcRow(state.week, staffId, mm.key);
        const a=numOrNull(r[mm.actual]);
        const q=numOrNull(r[mm.quarter]);
        if(a!==null) row.actual=a;
        if(q!==null) row.quarterPlan=q;
        setFcRow(row);
        applied++;
        await saveForecastRow(staffId, mm.key);
      }
    }
    return applied;
  }

  // ---- Supabase tasks + forecast fetch ----
  function normalizeTask(row){
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
      updatedAt: row.updated_at || ""
    };
  }
  function denormTask(t){
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
      commit: t.commit===""?null:t.commit,
      actual: t.actual===""?null:t.actual,
      carry_over: t.carryOver || "Y",
      owner_id: t.ownerId,
      owner_name: t.ownerName,
      note: t.note || null,
      assigned_by_id: t.assignedById || null,
      assigned_by_name: t.assignedByName || null,
      updated_at: new Date().toISOString()
    };
  }

  async function sbFetchTasks(){
    const res=await fetch(sbUrl("tasks?select=*&order=updated_at.desc&limit=5000"), {headers: sbHeaders()});
    if(!res.ok) throw new Error("read tasks "+res.status);
    const arr=await res.json();
    return (Array.isArray(arr)?arr:[]).map(normalizeTask);
  }
  async function sbInsertTask(t){
    const res=await fetch(sbUrl("tasks"), {method:"POST", headers: sbHeaders(), body: JSON.stringify([denormTask(t)])});
    if(!res.ok) throw new Error("insert task "+res.status);
    const rows=await res.json();
    return normalizeTask(rows[0]);
  }
  async function sbUpdateTask(t){
    const res=await fetch(sbUrl(`tasks?id=eq.${encodeURIComponent(t.id)}`), {method:"PATCH", headers: sbHeaders(), body: JSON.stringify(denormTask(t))});
    if(!res.ok) throw new Error("update task "+res.status);
    const rows=await res.json();
    return normalizeTask(rows[0]);
  }
  async function sbDeleteTask(id){
    const res=await fetch(sbUrl(`tasks?id=eq.${encodeURIComponent(id)}`), {method:"DELETE", headers: sbHeaders()});
    if(!res.ok) throw new Error("delete task "+res.status);
  }

  async function sbFetchForecastWeek(weekISO){
    const res=await fetch(sbUrl(`weekly_forecast?select=*&week_start=eq.${encodeURIComponent(weekISO)}&limit=5000`), {headers: sbHeaders()});
    if(!res.ok) throw new Error("read forecast "+res.status);
    const rows=await res.json();
    for(const r of (Array.isArray(rows)?rows:[])){
      const row={
        weekStart: String(r.week_start),
        staffId: r.staff_id,
        metricKey: r.metric_key,
        actual: r.actual ?? null,
        quarterPlan: r.quarter_plan ?? null,
        weekPlan: r.week_plan ?? null,
        note: r.note || ""
      };
      setFcRow(row);
    }
    saveJSON(KEY_FC_LOCAL, state.forecast);
  }

  // ---- Sync ----
  async function syncAll(){
    if(state.syncing) return;
    state.syncing=true;
    try{
      const s=getSettings();
      if(s.storageMode==="supabase"){
        state.tasks = await sbFetchTasks();
        await sbFetchForecastWeek(state.week);
        mark(true, `supabase • synced • ${new Date().toLocaleTimeString("vi-VN")}`);
      }else{
        state.tasks = loadJSON(KEY_TASKS_LOCAL) || [];
        state.forecast = loadJSON(KEY_FC_LOCAL) || state.forecast || {};
        mark(true, "local • loaded");
      }
      render();
    }catch(e){
      console.error(e);
      mark(false, "đồng bộ lỗi");
    }finally{
      state.syncing=false;
    }
  }

  function setupTimer(){
    if(state.timer) clearInterval(state.timer);
    const sec=getSettings().syncSeconds;
    state.timer=setInterval(()=>{ if(!document.hidden) syncAll(); }, sec*1000);
  }

  // ---- Task modal ----
  function nextSeq(){ return state.tasks.reduce((m,t)=>Math.max(m, Number(t.seq||0)),0)+1; }
  function newId(){ return `t_${Math.random().toString(36).slice(2,10)}_${Date.now()}`; }

  function openTask(task){
    const L=getLists();
    if(task){
      taskTitle.textContent="Sửa công việc";
      fmId.value=task.id;
      fmGroup.value=task.group;
      fmOwner.value=task.ownerId;
      fmTitle.value=task.title;
      fmDeadline.value=task.deadline||"";
      fmStatus.value=task.status;
      fmPriority.value=task.priority||"B";
      fmCarry.value=task.carryOver||"Y";
      fmKpi.value=task.kpi||"";
      fmMetric.value=task.metric||"";
      fmCommit.value=task.commit===""?"":String(task.commit);
      fmActual.value=task.actual===""?"":String(task.actual);
      fmNote.value=task.note||"";
    }else{
      taskTitle.textContent="Thêm công việc";
      fmId.value="";
      fmGroup.value="";
      fmOwner.value=state.meId||"";
      fmTitle.value="";
      fmDeadline.value=state.week;
      fmStatus.value=(L.statuses||["Not started"])[0];
      fmPriority.value="B";
      fmCarry.value="Y";
      fmKpi.value="";
      fmMetric.value="";
      fmCommit.value="";
      fmActual.value="";
      fmNote.value="";
    }
    openModal(taskBackdrop);
  }

  async function saveTask(e){
    e.preventDefault();
    const me=staffById(state.meId);
    const isNew=!fmId.value;
    const id=isNew?newId():fmId.value;
    const t={
      id,
      __isNew:isNew,
      seq: isNew? nextSeq() : (state.tasks.find(x=>x.id===id)?.seq ?? null),
      weekStart: state.week,
      group: fmGroup.value,
      title: fmTitle.value.trim(),
      deadline: fmDeadline.value,
      status: fmStatus.value,
      priority: fmPriority.value||"B",
      kpi: fmKpi.value||"",
      metric: fmMetric.value||"",
      commit: fmCommit.value===""?"":Number(fmCommit.value),
      actual: fmActual.value===""?"":Number(fmActual.value),
      carryOver: fmCarry.value||"Y",
      ownerId: fmOwner.value,
      ownerName: (staffById(fmOwner.value)||{}).name||"",
      note: fmNote.value||"",
      assignedById: isNew ? (state.meId||"") : (state.tasks.find(x=>x.id===id)?.assignedById||""),
      assignedByName: isNew ? (me?.name||"") : (state.tasks.find(x=>x.id===id)?.assignedByName||""),
      updatedAt: new Date().toISOString()
    };

    const s=getSettings();
    try{
      let saved=t;
      if(s.storageMode==="supabase"){
        saved = isNew ? await sbInsertTask(t) : await sbUpdateTask(t);
      }else{
        const arr=state.tasks.slice();
        const idx=arr.findIndex(x=>x.id===t.id);
        if(idx>=0) arr[idx]=t; else arr.unshift(t);
        state.tasks=arr;
        saveJSON(KEY_TASKS_LOCAL, arr);
      }
      const idx2=state.tasks.findIndex(x=>x.id===saved.id);
      if(idx2>=0) state.tasks[idx2]=saved; else state.tasks.unshift(saved);

      closeModals();
      renderTasks();
      mark(true, s.storageMode==="supabase" ? "supabase • ghi OK" : "local • saved");
    }catch(err){
      console.error(err);
      alert("Không lưu được. Kiểm tra Supabase/RLS hoặc mạng.");
    }
  }

  async function delTask(id){
    const s=getSettings();
    try{
      if(s.storageMode==="supabase") await sbDeleteTask(id);
      else{
        state.tasks=state.tasks.filter(t=>t.id!==id);
        saveJSON(KEY_TASKS_LOCAL, state.tasks);
      }
      state.tasks=state.tasks.filter(t=>t.id!==id);
      renderTasks();
    }catch(e){
      console.error(e);
      alert("Không xoá được. Kiểm tra Supabase/RLS hoặc mạng.");
    }
  }

  // ---- Lists modal helpers ----
  function mkRow2(aVal="", bVal=""){
    const row=document.createElement("div");
    row.className="listRow";
    const a=document.createElement("input"); a.value=aVal;
    const b=document.createElement("input"); b.value=bVal;
    const del=document.createElement("button"); del.className="delBtn"; del.textContent="Xoá"; del.onclick=()=>row.remove();
    row.appendChild(a); row.appendChild(b); row.appendChild(del);
    return row;
  }
  function mkRow1(val=""){
    const row=document.createElement("div");
    row.className="listRow";
    row.style.gridTemplateColumns="1fr 80px";
    const a=document.createElement("input"); a.value=val;
    const del=document.createElement("button"); del.className="delBtn"; del.textContent="Xoá"; del.onclick=()=>row.remove();
    row.appendChild(a); row.appendChild(del);
    return row;
  }

  function setListTab(name){
    $$(".tabs [data-listtab]").forEach(btn=>btn.classList.toggle("active", btn.dataset.listtab===name));
    $("#tab_staff").style.display = (name==="staff") ? "" : "none";
    $("#tab_others").style.display = (name==="others") ? "" : "none";
    $("#tab_storage").style.display = (name==="storage") ? "" : "none";
  }

  function openLists(){
    const L=getLists();
    staffList.innerHTML=""; (L.staff||[]).forEach(s=>staffList.appendChild(mkRow2(String(s.id||""), String(s.name||""))));
    statusList.innerHTML=""; (L.statuses||[]).forEach(x=>statusList.appendChild(mkRow1(String(x))));
    groupList.innerHTML=""; (L.groups||[]).forEach(x=>groupList.appendChild(mkRow1(String(x))));
    priorityList.innerHTML=""; (L.priorities||[]).forEach(x=>priorityList.appendChild(mkRow1(String(x))));
    kpiList.innerHTML=""; (L.kpis||[]).forEach(x=>kpiList.appendChild(mkRow1(String(x))));
    metricList.innerHTML=""; (L.outputMetrics||[]).forEach(x=>metricList.appendChild(mkRow1(String(x))));

    const S=getSettings();
    stMode.value=S.storageMode;
    stInterval.value=String(S.syncSeconds);
    stUrl.value=S.supabaseUrl||"";
    stKey.value=S.supabaseAnonKey||"";
    setListTab("staff");
    openModal(listsBackdrop);
  }

  function saveLists(){
    const staffArr=[];
    for(const row of Array.from(staffList.querySelectorAll(".listRow"))){
      const ins=row.querySelectorAll("input");
      const id=String(ins[0].value||"").trim();
      const name=String(ins[1].value||"").trim();
      if(id && name) staffArr.push({id,name});
    }
    const seen=new Set(); const staffUniq=[];
    for(const s of staffArr){ if(seen.has(s.id)) continue; seen.add(s.id); staffUniq.push(s); }

    const read1=(container)=>Array.from(new Set(Array.from(container.querySelectorAll("input")).map(i=>String(i.value||"").trim()).filter(Boolean)));
    const newLists={
      staff: staffUniq.length?staffUniq:getLists().staff,
      statuses: read1(statusList),
      groups: read1(groupList),
      priorities: read1(priorityList),
      kpis: read1(kpiList),
      outputMetrics: read1(metricList),
      forecastMetrics: getLists().forecastMetrics || CFG.forecastMetrics || []
    };
    saveJSON(KEY_LISTS, newLists);

    const S=getSettings();
    const newS={
      storageMode: stMode.value||S.storageMode,
      supabaseUrl: stUrl.value||S.supabaseUrl,
      supabaseAnonKey: stKey.value||S.supabaseAnonKey,
      syncSeconds: Math.max(3, Number(stInterval.value||S.syncSeconds))
    };
    saveJSON(KEY_SETTINGS, newS);
    refreshDropdowns();
    setupAutoCompactTopbar();
    setupTimer();
    syncAll();
  }

  // ---- Export (Tasks + Forecast with Excel template layout) ----
  function buildTasksSheets(wb){
    const vis=visibleTasks();
    const sheet1=XLSX.utils.json_to_sheet(vis.map(t=>({
      ID: t.seq?`#${t.seq}`:t.id,
      WeekStart: t.weekStart,
      Group: t.group,
      Title: t.title,
      Deadline: t.deadline,
      Owner: t.ownerName||t.ownerId,
      Status: t.status,
      Priority: t.priority,
      KPI: t.kpi,
      Metric: t.metric,
      Commit: t.commit,
      Actual: t.actual,
      CarryOver: t.carryOver,
      AssignedBy: t.assignedByName||"",
      Note: t.note||""
    })));
    XLSX.utils.book_append_sheet(wb, sheet1, "TASKS_WEEK");

    const by=new Map();
    for(const t of vis){
      const k=t.ownerName||t.ownerId||"";
      if(!by.has(k)) by.set(k, {Owner:k, Total:0, Done:0, Overdue:0});
      const r=by.get(k); r.Total++; if(isDone(t.status)) r.Done++; if(isOverdue(t)) r.Overdue++;
    }
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(Array.from(by.values())), "SUMMARY_TASKS");
  }

  function setCell(ws, addr, v){
    ws[addr] = v;
  }

  function exportForecastSheet(wb){
    const L=getLists();
    const staff=L.staff.filter(s=>String(s.id)!=="54000600");
    const weekStart=state.week;
    const weekEnd=weekEndISO(weekStart);

    const d=parseISO(weekStart) || new Date();
    const year=d.getFullYear();
    const q=Math.floor(d.getMonth()/3)+1;
    const qLabel=`KH QUÝ ${q}/${year}`;

    // Build AOA for columns A..AB (28 columns)
    const cols=28;
    const rows=[];

    // Row1
    const r1=new Array(cols).fill("");
    r1[0]="Tuần";
    r1[2]=fmtDDMMYYYY(weekStart);
    r1[3]="-";
    r1[4]=fmtDDMMYYYY(weekEnd);
    rows.push(r1);

    // Row2 (group headers)
    const r2=new Array(cols).fill("");
    r2[0]="STT";
    r2[1]="TÊN ĐƠN VỊ";
    r2[2]="HDV CUỐI KỲ";
    r2[7]="DƯ NỢ CUỐI KỲ ";
    r2[12]="TK HKD";
    r2[16]="Thẻ TD";
    r2[20]="Hoa hồng bảo hiểm";
    r2[24]="SMARTBANKING";
    rows.push(r2);

    // Row3 (sub headers)
    const r3=new Array(cols).fill("");
    // HDV (C-G)
    r3[2]="Đã Thực hiện";
    r3[3]="KH Tuần";
    r3[4]="Tăng/giảm so đầu tuần";
    r3[5]=qLabel;
    r3[6]="GAP QUÝ";
    // DU_NO (H-L)
    r3[7]="Đã Thực hiện";
    r3[8]="KH Tuần";
    r3[9]="Tăng/giảm so đầu tuần";
    r3[10]=qLabel;
    r3[11]="GAP QUÝ";
    // TK HKD (M-P)
    r3[12]="Đã Thực hiện"; r3[13]="KH Tuần"; r3[14]="KH Quý"; r3[15]="GAP";
    // The TD (Q-T)
    r3[16]="Đã Thực hiện"; r3[17]="KH Tuần"; r3[18]="KH Quý"; r3[19]="GAP";
    // Insurance (U-X)
    r3[20]="Đã Thực hiện"; r3[21]="KH Tuần"; r3[22]="KH Quý"; r3[23]="GAP";
    // Smart (Y-AB)
    r3[24]="Đã Thực hiện"; r3[25]="KH Tuần"; r3[26]="KH Quý"; r3[27]="GAP";
    rows.push(r3);

    // Row4 (units)
    const r4=new Array(cols).fill("");
    r4[1]="Đơn vị tính";
    r4[4]="Tỷ đồng"; r4[5]="Tỷ đồng"; // match sample placement
    r4[9]="Tỷ đồng"; r4[11]="Tỷ đồng";
    r4[13]="TK"; r4[14]="TK";
    r4[17]="Thẻ";
    r4[21]="Tỷ đồng"; r4[23]="Tỷ đồng";
    r4[26]="Tỷ đồng";
    rows.push(r4);

    // Row5 total
    const r5=new Array(cols).fill("");
    r5[0]=7;
    r5[1]=CFG.forecastUnitName || "TỔNG";
    rows.push(r5);

    // Staff rows
    for(let i=0;i<staff.length;i++){
      const s=staff[i];
      const rr=new Array(cols).fill("");
      rr[1]=`${s.id} - ${s.name}`;
      rows.push(rr);
    }

    const ws=XLSX.utils.aoa_to_sheet(rows);

    // Merges (match sample)
    ws["!merges"] = [
      {s:{r:0,c:0}, e:{r:0,c:1}}, // A1:B1
      {s:{r:1,c:2}, e:{r:1,c:6}}, // C2:G2
      {s:{r:1,c:7}, e:{r:1,c:11}},// H2:L2
      {s:{r:1,c:12},e:{r:1,c:15}},// M2:P2
      {s:{r:1,c:16},e:{r:1,c:19}},// Q2:T2
      {s:{r:1,c:20},e:{r:1,c:23}},// U2:X2
      {s:{r:1,c:24},e:{r:1,c:27}},// Y2:AB2
    ];

    // Column widths (approx like template)
    ws["!cols"] = [
      {wch:5}, {wch:34},
      {wch:14},{wch:12},{wch:18},{wch:14},{wch:12},
      {wch:14},{wch:12},{wch:18},{wch:14},{wch:12},
      {wch:12},{wch:12},{wch:12},{wch:12},
      {wch:12},{wch:12},{wch:12},{wch:12},
      {wch:14},{wch:12},{wch:12},{wch:12},
      {wch:14},{wch:12},{wch:12},{wch:12},
    ];

    // Helper to addr
    function addr(r,c){ return XLSX.utils.encode_cell({r:r,c:c}); }

    const staffStartRow = 5; // 0-based row index for Excel row6
    const n = staff.length;
    const last = staffStartRow + n - 1;

    // Write staff values + formulas
    const metricCols = {
      HDV: {a:2,w:3,delta:4,q:5,gap:6, kind:"5col", key:"HDV_CUOI_KY"},
      DN:  {a:7,w:8,delta:9,q:10,gap:11, kind:"5col", key:"DU_NO_CUOI_KY"},
      HKD: {a:12,w:13,q:14,gap:15, kind:"4col", key:"TK_HKD"},
      THE: {a:16,w:17,q:18,gap:19, kind:"4col", key:"THE_TD"},
      BH:  {a:20,w:21,q:22,gap:23, kind:"4col", key:"HH_BAO_HIEM"},
      SB:  {a:24,w:25,q:26,gap:27, kind:"4col", key:"SMARTBANKING"},
    };

    for(let i=0;i<n;i++){
      const excelRow = staffStartRow + i; // 0-based
      const s=staff[i];
      // for each metric
      for(const k of Object.keys(metricCols)){
        const m=metricCols[k];
        const row=getFcRow(weekStart, s.id, m.key);
        const a=numOrNull(row.actual);
        const w=numOrNull(row.weekPlan);
        const qv=numOrNull(row.quarterPlan);

        if(a!==null) ws[addr(excelRow,m.a)] = {t:"n", v:a};
        if(w!==null) ws[addr(excelRow,m.w)] = {t:"n", v:w};
        if(qv!==null) ws[addr(excelRow,m.q)] = {t:"n", v:qv};

        if(m.kind==="5col"){
          ws[addr(excelRow,m.delta)] = {t:"n", f:`${XLSX.utils.encode_col(m.w)}${excelRow+1}-${XLSX.utils.encode_col(m.a)}${excelRow+1}`};
          ws[addr(excelRow,m.gap)]   = {t:"n", f:`${XLSX.utils.encode_col(m.a)}${excelRow+1}-${XLSX.utils.encode_col(m.q)}${excelRow+1}`};
        }else{
          ws[addr(excelRow,m.gap)]   = {t:"n", f:`${XLSX.utils.encode_col(m.a)}${excelRow+1}-${XLSX.utils.encode_col(m.q)}${excelRow+1}`};
        }
      }
    }

    // Total row formulas (Excel row5 => 0-based row4)
    const totalRow = 4;
    function sumRange(col, r1, r2){
      const c=XLSX.utils.encode_col(col);
      return `SUM(${c}${r1+1}:${c}${r2+1})`;
    }

    // HDV
    ws[addr(totalRow,2)] = {t:"n", f: sumRange(2, staffStartRow, last)}; // C
    ws[addr(totalRow,3)] = {t:"n", f: sumRange(3, staffStartRow, last)}; // D
    ws[addr(totalRow,4)] = {t:"n", f: `D${totalRow+1}-C${totalRow+1}`}; // E
    ws[addr(totalRow,5)] = {t:"n", f: sumRange(5, staffStartRow, last)}; // F
    ws[addr(totalRow,6)] = {t:"n", f: `C${totalRow+1}-F${totalRow+1}`}; // G

    // DU_NO
    ws[addr(totalRow,7)]  = {t:"n", f: sumRange(7, staffStartRow, last)};  // H
    ws[addr(totalRow,8)]  = {t:"n", f: sumRange(8, staffStartRow, last)};  // I
    ws[addr(totalRow,9)]  = {t:"n", f: `I${totalRow+1}-H${totalRow+1}`};   // J
    ws[addr(totalRow,10)] = {t:"n", f: sumRange(10, staffStartRow, last)}; // K
    ws[addr(totalRow,11)] = {t:"n", f: `H${totalRow+1}-K${totalRow+1}`};   // L

    // HKD
    ws[addr(totalRow,12)] = {t:"n", f: sumRange(12, staffStartRow, last)}; // M
    ws[addr(totalRow,13)] = {t:"n", f: sumRange(13, staffStartRow, last)}; // N
    ws[addr(totalRow,14)] = {t:"n", f: sumRange(14, staffStartRow, last)}; // O
    ws[addr(totalRow,15)] = {t:"n", f: `M${totalRow+1}-O${totalRow+1}`};   // P

    // THE
    ws[addr(totalRow,16)] = {t:"n", f: sumRange(16, staffStartRow, last)}; // Q
    ws[addr(totalRow,17)] = {t:"n", f: sumRange(17, staffStartRow, last)}; // R
    ws[addr(totalRow,18)] = {t:"n", f: sumRange(18, staffStartRow, last)}; // S
    ws[addr(totalRow,19)] = {t:"n", f: `Q${totalRow+1}-S${totalRow+1}`};   // T

    // BH
    ws[addr(totalRow,20)] = {t:"n", f: sumRange(20, staffStartRow, last)}; // U
    ws[addr(totalRow,21)] = {t:"n", f: sumRange(21, staffStartRow, last)}; // V
    ws[addr(totalRow,22)] = {t:"n", f: sumRange(22, staffStartRow, last)}; // W
    ws[addr(totalRow,23)] = {t:"n", f: `U${totalRow+1}-W${totalRow+1}`};   // X

    // SB
    ws[addr(totalRow,24)] = {t:"n", f: sumRange(24, staffStartRow, last)}; // Y
    ws[addr(totalRow,25)] = {t:"n", f: sumRange(25, staffStartRow, last)}; // Z
    ws[addr(totalRow,26)] = {t:"n", f: sumRange(26, staffStartRow, last)}; // AA
    ws[addr(totalRow,27)] = {t:"n", f: `Y${totalRow+1}-AA${totalRow+1}`};  // AB

    XLSX.utils.book_append_sheet(wb, ws, "Theo doi tien do");
  }

  function exportWeekly(){
    const wb=XLSX.utils.book_new();
    buildTasksSheets(wb);
    exportForecastSheet(wb);
    XLSX.writeFile(wb, `KehoachTuan_${state.week}.xlsx`);
  }

  // ---- View switch ----
  function setView(name){
    state.view=name;
    tabTasks.classList.toggle("active", name==="tasks");
    tabForecast.classList.toggle("active", name==="forecast");
    viewTasks.style.display = name==="tasks" ? "" : "none";
    viewForecast.style.display = name==="forecast" ? "" : "none";
    render();
  }

  function render(){
    refreshDropdowns();
    if(state.view==="tasks") renderTasks();
    else renderForecastCards();
  }

  // ---- Event wiring ----
  function wire(){
    tabTasks.onclick=()=>setView("tasks");
    tabForecast.onclick=()=>setView("forecast");

    elWeek.onchange=()=>{
      state.week = pickWeekStartISO(elWeek.value);
      elWeek.value = state.week;
      syncAll();
    };

    elMe.onchange=()=>{
      state.meId = elMe.value;
      // default forecast filter to self for non-managers
      if(!isManager(state.meId)) state.fcStaff = state.meId;
      render();
    };

    filterAssignee.onchange=()=>{ state.filterAssignee=filterAssignee.value; renderTasks(); };
    filterStatus.onchange=()=>{ state.filterStatus=filterStatus.value; renderTasks(); };
    filterGroup.onchange=()=>{ state.filterGroup=filterGroup.value; renderTasks(); };
    filterOverdue.onchange=()=>{ state.onlyOverdue=!!filterOverdue.checked; renderTasks(); };
    btnClear.onclick=()=>{ state.filterAssignee=""; state.filterStatus=""; state.filterGroup=""; state.onlyOverdue=false; filterOverdue.checked=false; render(); };

    btnAdd.onclick=()=>openTask(null);
    btnExport.onclick=()=>exportWeekly();
    btnLists.onclick=()=>openLists();

    taskClose.onclick=closeModals;
    btnCancel.onclick=closeModals;
    taskBackdrop.onclick=(e)=>{ if(e.target===taskBackdrop) closeModals(); };

    listsClose.onclick=closeModals;
    btnListsCancel.onclick=closeModals;
    listsBackdrop.onclick=(e)=>{ if(e.target===listsBackdrop) closeModals(); };

    document.addEventListener("keydown",(e)=>{ if(e.key==="Escape") closeModals(); });

    taskForm.addEventListener("submit", saveTask);

    tbody.addEventListener("click",(e)=>{
      const btn=e.target.closest("button"); if(!btn) return;
      const act=btn.dataset.act, id=btn.dataset.id;
      if(act==="edit"){ const t=state.tasks.find(x=>x.id===id); if(t) openTask(t); }
      if(act==="del"){ if(confirm("Xoá công việc này?")) delTask(id); }
    });

    $$(".tabs [data-listtab]").forEach(btn=>btn.addEventListener("click",()=>setListTab(btn.dataset.listtab)));
    btnAddStaff.onclick=()=>staffList.appendChild(mkRow2("",""));
    btnAddStatus.onclick=()=>statusList.appendChild(mkRow1(""));
    btnAddGroup.onclick=()=>groupList.appendChild(mkRow1(""));
    btnAddPriority.onclick=()=>priorityList.appendChild(mkRow1(""));
    btnAddKpi.onclick=()=>kpiList.appendChild(mkRow1(""));
    btnAddMetric.onclick=()=>metricList.appendChild(mkRow1(""));
    btnListsSave.onclick=()=>{ saveLists(); closeModals(); };

    // Forecast
    fcStaffFilter.onchange=()=>{ state.fcStaff = fcStaffFilter.value; renderForecastCards(); };
    btnFcToggle.onclick=()=>{
      if(!isManager(state.meId)) return alert("Chỉ quản lý mới bật sửa Thực hiện/KH Quý.");
      state.fcEditAdmin = !state.fcEditAdmin;
      btnFcToggle.textContent = state.fcEditAdmin ? "Tắt sửa Thực hiện/KH Quý" : "Bật sửa Thực hiện/KH Quý";
      renderForecastCards();
    };
    btnFcImport.onclick=()=>{
      if(!isManager(state.meId)) return alert("Chỉ quản lý mới import số liệu.");
      fcImportFile.value=""; fcImportFile.click();
    };
    fcImportFile.onchange=async()=>{
      const f=fcImportFile.files && fcImportFile.files[0];
      if(!f) return;
      try{
        const n=await importForecastExcel(f);
        alert("Import xong ("+n+" ô).");
        await syncAll();
      }catch(e){
        console.error(e);
        alert("Import lỗi. Hãy dùng file đúng cấu trúc như mẫu.");
      }
    };

    // Forecast input handler (event delegation)
    fcCards.addEventListener("input",(e)=>{
      const el=e.target;
      if(!(el instanceof HTMLInputElement)) return;
      if(el.dataset.fc!=="1") return;
      const staffId=el.dataset.staff;
      const metricKey=el.dataset.metric;
      const field=el.dataset.field;

      const row=getFcRow(state.week, staffId, metricKey);
      if(field==="actual") row.actual = numOrNull(el.value);
      if(field==="weekPlan") row.weekPlan = numOrNull(el.value);
      if(field==="quarterPlan") row.quarterPlan = numOrNull(el.value);
      setFcRow(row);

      scheduleSaveFc(staffId, metricKey);
      // live recompute
      renderForecastCards();
    });
  }

  // ---- Init ----

  // ---- Auto compact sticky topbar on scroll (mobile) ----
  function setupAutoCompactTopbar(){
    const topbar = document.querySelector(".topbar");
    if(!topbar) return;
    const mq = window.matchMedia("(max-width: 720px)");
    const apply = () => {
      if(!mq.matches){ topbar.classList.remove("compact"); return; }
      // If a modal is open, keep topbar hidden via CSS; no need to toggle compact.
      const y = window.scrollY || document.documentElement.scrollTop || 0;
      if(y > 60) topbar.classList.add("compact");
      else topbar.classList.remove("compact");
    };
    window.addEventListener("scroll", apply, {passive:true});
    window.addEventListener("resize", apply);
    apply();
  }

  function init(){
    elWeek.value = state.week;
    refreshDropdowns();
    setupTimer();
    wire();
    syncAll();
  }

  init();
})();
