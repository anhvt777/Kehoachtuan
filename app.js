/* Kehoachtuan v6.4.2 - Tasks + Forecast (Card view) - Local / Supabase
   - Forecast card UI (mobile-friendly)
   - Excel export matches Du kien tuan.xlsx layout
*/
(() => {
  // fallback to avoid freeze if partial deploy
  window.renderReports = window.renderReports || function(){};

  "use strict";

  // IMPORTANT: define global handlers early so inline onclick never fails
  // (prevents: window.__fcOpen is not a function)
  window.__fcOpen = (staffId, metricKey) => {
    try{
      if(typeof openForecastModal !== "function"){
        alert("App chưa sẵn sàng. Hãy tải lại trang (hard refresh).");
        return;
      }
      openForecastModal(staffId, metricKey);
    }catch(e){
      console.error(e);
      alert("Không mở được module nhập số: " + (e && e.message ? e.message : e));
    }
  };

  window.__fcBadge = (staffId) => {
    try{
      if(typeof isManager !== "function" || !isManager(state.meId)) return;
      const ok = confirm("Chọn OK để GIAO VIỆC cho cán bộ này.\nChọn Cancel để XEM số liệu của cán bộ này.");
      if(ok){
        setView("tasks");
        openTask(null);
        if(fmOwner) fmOwner.value = staffId;
      }else{
        state.fcStaff = staffId;
        if(fcStaffFilter) fcStaffFilter.value = staffId;
        setView("forecast");
        renderForecastCards();
      }
    }catch(e){
      console.error(e);
    }
  };
  const CFG = window.CONFIG || {};
  const VERSION = "6.8.7";

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
  function fmtDM(iso){
    const d=parseISO(iso); if(!d) return "";
    return `${d.getDate()}/${d.getMonth()+1}`;
  }

  function fmtDDMMYYYYHHmm(iso){
    if(!iso) return "";
    const d=new Date(iso);
    if(Number.isNaN(d.getTime())) return String(iso);
    const dd=String(d.getDate()).padStart(2,"0");
    const mm=String(d.getMonth()+1).padStart(2,"0");
    const yyyy=d.getFullYear();
    const hh=String(d.getHours()).padStart(2,"0");
    const mi=String(d.getMinutes()).padStart(2,"0");
    return `${dd}/${mm}/${yyyy} ${hh}:${mi}`;
  }
  function toDatetimeLocalValue(iso){
    if(!iso) return "";
    const d=new Date(iso);
    if(Number.isNaN(d.getTime())) return "";
    const pad=n=>String(n).padStart(2,"0");
    return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  }
  function fromDatetimeLocalValue(v){
    if(!v) return "";
    const d=new Date(v);
    return d.toISOString();
  }
  function uniq(arr){ return Array.from(new Set((arr||[]).map(String))).filter(Boolean); }

  function isLead(rep){ return String(rep.leadId||"")===String(state.meId||""); }
  function isCollaborator(rep){ return (rep.collaborators||[]).map(String).includes(String(state.meId||"")); }
  function allCollabsDone(rep){
    const parts=rep.parts||{};
    const collabs=(rep.collaborators||[]).map(String);
    if(collabs.length===0) return true;
    return collabs.every(id => String((parts[id]||{}).status||"") === "Done");
  }
  function repDueClass(rep){
    const done = String(rep.status||"") === "Hoàn thành";
    if(done) return "rep-done";
    const dl=new Date(rep.deadline||"");
    if(Number.isNaN(dl.getTime())) return "";
    const diffH=(dl.getTime()-Date.now())/36e5;
    if(diffH<0) return "rep-overdue";
    if(diffH<=24) return "rep-duesoon";
    return "";
  }
  function repProgressText(rep){
    const collabs=(rep.collaborators||[]).map(String);
    if(collabs.length===0) return "0/0";
    const parts=rep.parts||{};
    const done=collabs.filter(id=>String((parts[id]||{}).status||"") === "Done").length;
    return `${done}/${collabs.length}`;
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
  function dashboardWeekEndISO(weekStartISO){
    const d=parseISO(weekStartISO)||mondayOf(new Date());
    const end=new Date(d);
    end.setDate(end.getDate()+6);
    return toISO(end);
  }
  function today0(){ const t=new Date(); t.setHours(0,0,0,0); return t; }
  function escapeHtml(s){
    return String(s??"").replace(/[&<>"']/g, c => ({ "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;" }[c]));
  }
  function numOrNull(v){
    if(v===null||v===undefined||v==="") return null;
    if(typeof v==="number") return Number.isFinite(v)?v:null;
    let s=String(v).trim();
    if(!s) return null;
    // Accept Vietnamese formats:
    // - "39,75525" => 39.75525
    // - "1.234,56" => 1234.56
    // - "1 234,56" => 1234.56
    s=s.replace(/\s+/g,"");
    if(s.includes(",") && s.includes(".")){
      // assume "." thousand sep, "," decimal
      s=s.replace(/\./g,"").replace(",",".");
    } else if(s.includes(",") && !s.includes(".")){
      // comma decimal
      s=s.replace(",",".");
    }
    // strip any non-number except leading - and dot
    s=s.replace(/[^0-9\.\-]/g,"");
    const n=Number(s);
    return Number.isFinite(n)?n:null;
  }
  function fmtNum(n){
    if(n===null||n===undefined||n==="") return "";
    const x=Number(n); if(!Number.isFinite(x)) return "";
    return x.toLocaleString("vi-VN",{maximumFractionDigits:3});
  }

  function updateWeekPickerDisplay(){
    if(!weekPickerDisplay) return;
    weekPickerDisplay.textContent = state && state.week ? fmtDDMMYYYY(state.week) : "dd/mm/yyyy";
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
      reportTypes: nonEmptyArr(saved.reportTypes) ? saved.reportTypes : (CFG.reportTypes||["Báo cáo tuần","Báo cáo tháng","Báo cáo đột xuất","Điều hành"]),
      reportStatuses: nonEmptyArr(saved.reportStatuses) ? saved.reportStatuses : (CFG.reportStatuses||["Chưa bắt đầu","Đang thực hiện","Chờ phối hợp","Hoàn thành"]),
    };
  }

  function staffById(id){
    return (getLists().staff||[]).find(s => String(s.id)===String(id)) || null;
  }
  function isManager(meId){
    return (CFG.managerIds||[]).map(String).includes(String(meId||""));
  }


  const STAFF_ALIAS_MAP = {
    "vo tuan anh": "AnhVT",
    "hoang truong an": "AnHT",
    "nguyen mai dung": "DungNM",
    "nguyen thuy dung": "DungNT",
    "tran nam anh": "AnhTN",
    "le thi ngoc trang": "TrangLTN"
  };

  function normalizeNameKey(s){
    return String(s||"")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/đ/g, "d").replace(/Đ/g, "D")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, " ")
      .trim();
  }

  function shortStaffName(name, fallbackId=""){
    const key = normalizeNameKey(name);
    if(STAFF_ALIAS_MAP[key]) return STAFF_ALIAS_MAP[key];
    if(!name) return String(fallbackId||"");
    return String(name);
  }

  function staffShortById(id){
    const s = staffById(id) || {};
    return shortStaffName(s.name || id, id);
  }

  function dashboardTasksBase(){
    const week=state.week;
    return (state.tasks||[]).filter(t=>{
      if(t.weekStart===week) return true;
      if(t.weekStart && t.weekStart<week && String(t.carryOver||"Y").toUpperCase()==="Y" && !isDone(t.status)) return true;
      return false;
    }).map(t=>{
      const s=staffById(t.ownerId);
      return {...t, ownerName: s? s.name : (t.ownerName||t.ownerId)};
    });
  }

  function dashboardReportRows(){
    return [...(state.reports||[])];
  }

  function pct(n,d){
    if(!d || !Number.isFinite(n) || !Number.isFinite(d)) return 0;
    return Math.max(0, Math.round((n/d)*100));
  }

  function isDueThisWeekTask(t){
    const dl=parseISO(t.deadline||"");
    const ws=parseISO(state.week);
    const we=parseISO(dashboardWeekEndISO(state.week));
    if(!dl || !ws || !we) return false;
    return dl>=ws && dl<=we && !isDone(t.status);
  }

  function clearDashboardTaskDrill(){
    state.dashboardTaskFilter="";
    state.dashboardTaskStaff="";
  }

  function taskDrillLabel(mode){
    return ({new:"Phát sinh", due:"Đến hạn", over:"Quá hạn"}[String(mode||"")] || "Công việc");
  }

  function openTasksFromDashboard(staffId, mode){
    state.filterAssignee = String(staffId||"");
    state.filterStatus = "";
    state.filterGroup = "";
    state.onlyOverdue = String(mode||"")==="over";
    state.dashboardTaskStaff = String(staffId||"");
    state.dashboardTaskFilter = String(mode||"");
    if(filterOverdue) filterOverdue.checked = !!state.onlyOverdue;
    setView("tasks");
    renderTasks();
  }

  function clearDashboardReportDrill(){
    state.dashboardReportMode="";
    state.dashboardReportStaff="";
  }

  function reportDrillLabel(mode){
    return ({lead:"Đầu mối", collab:"Phối hợp", late:"Quá hạn"}[String(mode||"")] || "Báo cáo");
  }

  function openReportsFromDashboard(staffId, mode){
    state.repFilterLead = String(mode)==="lead" ? String(staffId||"") : "";
    state.repFilterType = "";
    state.repFilterStatus = "";
    state.repOnlyMine = false;
    state.repOnlyDueSoon = false;
    state.dashboardReportStaff = String(staffId||"");
    state.dashboardReportMode = String(mode||"");
    setView("reports");
    renderReports();
  }

  function dashboardTaskCompareRows(tasks, staff){
    const weekStart=parseISO(state.week);
    const weekEnd=parseISO(dashboardWeekEndISO(state.week));
    return staff.map(s=>{
      const my=tasks.filter(t=>String(t.ownerId)===String(s.id));
      const newCount=my.filter(t=>String(t.weekStart||"")===String(state.week)).length;
      const dueCount=my.filter(t=>{
        const dl=parseISO(t.deadline);
        if(!dl || !weekStart || !weekEnd) return false;
        return dl>=weekStart && dl<=weekEnd && !isDone(t.status);
      }).length;
      const overCount=my.filter(t=>isOverdue(t)).length;
      return {
        id:s.id,
        name:s.name||s.id,
        alias:shortStaffName(s.name||s.id, s.id),
        newCount,
        dueCount,
        overCount,
        maxValue: Math.max(newCount, dueCount, overCount)
      };
    }).sort((a,b)=> ((b.newCount+b.dueCount+b.overCount)-(a.newCount+a.dueCount+a.overCount)) || (b.overCount-a.overCount) || a.alias.localeCompare(b.alias));
  }

  function renderTaskCompareChart(el, rows){
    if(!el) return;
    const weekLabel = `Công việc tuần từ ${fmtDM(state.week)}-${fmtDM(dashboardWeekEndISO(state.week))}`;
    if(!rows.length){
      el.innerHTML = `<div class="dashEmpty">Chưa có dữ liệu công việc để vẽ biểu đồ.</div>`;
      return;
    }
    const mobile = window.matchMedia("(max-width: 720px)").matches;
    const maxVal=Math.max(1, ...rows.map(r=>Math.max(r.newCount, r.dueCount, r.overCount)));

    if(mobile){
      const list=rows.map(r=>{
        const wNew=Math.max(0, (r.newCount/maxVal)*100);
        const wDue=Math.max(0, (r.dueCount/maxVal)*100);
        const wOver=Math.max(0, (r.overCount/maxVal)*100);
        return `
          <div class="dashCompareItem">
            <div class="dashCompareHead">
              <div>
                <div class="dashAlias">${escapeHtml(r.alias)}</div>
                <div class="dashFull">${escapeHtml(r.name)}</div>
              </div>
              <div class="dashCompareTotal">${r.newCount+r.dueCount+r.overCount}</div>
            </div>
            <div class="dashCompareLines">
              <button type="button" class="dashCompareBtn" data-dash-task="1" data-staff="${escapeHtml(r.id)}" data-mode="new">
                <span class="dashCompareLbl"><i class="lg new"></i>Phát sinh</span>
                <span class="dashCompareNum">${r.newCount}</span>
              </button>
              <div class="dashCompareTrack"><div class="dashCompareFill fill-new" style="width:${wNew}%"></div></div>

              <button type="button" class="dashCompareBtn" data-dash-task="1" data-staff="${escapeHtml(r.id)}" data-mode="due">
                <span class="dashCompareLbl"><i class="lg due"></i>Đến hạn</span>
                <span class="dashCompareNum">${r.dueCount}</span>
              </button>
              <div class="dashCompareTrack"><div class="dashCompareFill fill-due" style="width:${wDue}%"></div></div>

              <button type="button" class="dashCompareBtn" data-dash-task="1" data-staff="${escapeHtml(r.id)}" data-mode="over">
                <span class="dashCompareLbl"><i class="lg over"></i>Quá hạn</span>
                <span class="dashCompareNum">${r.overCount}</span>
              </button>
              <div class="dashCompareTrack"><div class="dashCompareFill fill-over" style="width:${wOver}%"></div></div>
            </div>
          </div>`;
      }).join('');
      el.innerHTML = `
        <div class="dashChartHeader">
          <div>
            <div class="dashChartTitle">${escapeHtml(weekLabel)}</div>
            <div class="dashChartSub">So sánh theo cán bộ: công việc phát sinh, đến hạn và quá hạn trong tuần hiện tại. Bấm từng dòng để lọc tab Công việc.</div>
          </div>
          <div class="dashLegend">
            <span><i class="lg new"></i>Phát sinh</span>
            <span><i class="lg due"></i>Đến hạn</span>
            <span><i class="lg over"></i>Quá hạn</span>
          </div>
        </div>
        <div class="dashCompareList">${list}</div>`;
      return;
    }

    const chartH=Math.max(280, rows.length*74);
    const pad={top:24,right:26,bottom:40,left:120};
    const innerW=740;
    const innerH=chartH-pad.top-pad.bottom;
    const groupH=innerH/Math.max(1,rows.length);
    const barH=Math.max(10, Math.min(16, (groupH-18)/3));
    const gap=5;
    const colors={new:'#0f766e', due:'#f59e0b', over:'#dc2626'};
    const x=(v)=> pad.left + (v/maxVal)*innerW;
    const yBase=(i)=> pad.top + i*groupH;
    const ticks=[];
    for(let i=0;i<=maxVal;i++) ticks.push(i);
    const grid=ticks.map(v=>{
      const xv=x(v);
      return `<g><line x1="${xv}" y1="${pad.top-8}" x2="${xv}" y2="${pad.top+innerH}" stroke="#d7e1dd" stroke-dasharray="4 4"/><text x="${xv}" y="${chartH-14}" text-anchor="middle" font-size="11" fill="#5b6b67">${v}</text></g>`;
    }).join('');
    const bars=rows.map((r,i)=>{
      const y=yBase(i);
      const lines=[
        {key:'new', label:'Phát sinh', value:r.newCount, y:y+4},
        {key:'due', label:'Đến hạn', value:r.dueCount, y:y+4+barH+gap},
        {key:'over', label:'Quá hạn', value:r.overCount, y:y+4+(barH+gap)*2},
      ].map(item=>{
        const width=Math.max(item.value>0 ? 10 : 0, (item.value/maxVal)*innerW);
        const textX=item.value>0 ? Math.min(pad.left+innerW-8, pad.left+width+8) : pad.left+8;
        return `
          <g class="dashBarHot" data-dash-task="1" data-staff="${escapeHtml(r.id)}" data-mode="${item.key}" style="cursor:pointer">
            <title>${escapeHtml(r.alias)} • ${escapeHtml(item.label)}: ${item.value}</title>
            <rect x="${pad.left}" y="${item.y}" width="${width}" height="${barH}" rx="6" fill="${colors[item.key]}" opacity="0.92"></rect>
            <text x="${textX}" y="${item.y+barH-2}" font-size="11" fill="#16312b">${item.value}</text>
          </g>`;
      }).join('');
      return `
        <g>
          <text x="${pad.left-12}" y="${y+16}" text-anchor="end" font-size="13" font-weight="700" fill="#082c35">${escapeHtml(r.alias)}</text>
          <text x="${pad.left-12}" y="${y+32}" text-anchor="end" font-size="11" fill="#5b6b67">${escapeHtml(r.name)}</text>
          ${lines}
        </g>`;
    }).join('');

    el.innerHTML = `
      <div class="dashChartHeader">
        <div>
          <div class="dashChartTitle">${escapeHtml(weekLabel)}</div>
          <div class="dashChartSub">So sánh theo cán bộ: công việc phát sinh, đến hạn và quá hạn trong tuần hiện tại. Bấm trực tiếp từng thanh để lọc tab Công việc.</div>
        </div>
        <div class="dashLegend">
          <span><i class="lg new"></i>Phát sinh</span>
          <span><i class="lg due"></i>Đến hạn</span>
          <span><i class="lg over"></i>Quá hạn</span>
        </div>
      </div>
      <div class="dashSvgWrap">
        <svg viewBox="0 0 ${pad.left+innerW+pad.right} ${chartH}" class="dashSvgChart" role="img" aria-label="${escapeHtml(weekLabel)}">
          ${grid}
          ${bars}
        </svg>
      </div>
    `;
  }


  function dashboardReportCompareRows(reports, staff){
    return staff.map(s=>{
      const lead=reports.filter(r=>String(r.leadId||"")===String(s.id));
      const collab=reports.filter(r=>(r.collaborators||[]).map(String).includes(String(s.id)));
      const late=reports.filter(r=>(String(r.leadId||"")===String(s.id) || (r.collaborators||[]).map(String).includes(String(s.id))) && repDueClass(r)==="rep-overdue");
      return {
        id:s.id,
        name:s.name||s.id,
        alias:shortStaffName(s.name||s.id, s.id),
        leadCount:lead.length,
        collabCount:collab.length,
        lateCount:late.length,
        maxValue: Math.max(lead.length, collab.length, late.length)
      };
    }).sort((a,b)=> ((b.leadCount+b.collabCount+b.lateCount)-(a.leadCount+a.collabCount+a.lateCount)) || (b.lateCount-a.lateCount) || a.alias.localeCompare(b.alias));
  }

  function renderReportCompareChart(el, rows){
    if(!el) return;
    if(!rows.length){
      el.innerHTML = `<div class="dashEmpty">Chưa có dữ liệu báo cáo để vẽ biểu đồ.</div>`;
      return;
    }
    const mobile = window.matchMedia("(max-width: 720px)").matches;
    const maxVal=Math.max(1, ...rows.map(r=>Math.max(r.leadCount, r.collabCount, r.lateCount)));

    if(mobile){
      const list=rows.map(r=>{
        const wLead=Math.max(0,(r.leadCount/maxVal)*100);
        const wCollab=Math.max(0,(r.collabCount/maxVal)*100);
        const wLate=Math.max(0,(r.lateCount/maxVal)*100);
        return `
          <div class="dashCompareItem">
            <div class="dashCompareHead">
              <div>
                <div class="dashAlias">${escapeHtml(r.alias)}</div>
                <div class="dashFull">${escapeHtml(r.name)}</div>
              </div>
              <div class="dashCompareTotal">${r.leadCount+r.collabCount+r.lateCount}</div>
            </div>
            <div class="dashCompareLines">
              <button type="button" class="dashCompareBtn" data-dash-report="1" data-staff="${escapeHtml(r.id)}" data-mode="lead">
                <span class="dashCompareLbl"><i class="lg new"></i>Đầu mối</span>
                <span class="dashCompareNum">${r.leadCount}</span>
              </button>
              <div class="dashCompareTrack"><div class="dashCompareFill fill-new" style="width:${wLead}%"></div></div>

              <button type="button" class="dashCompareBtn" data-dash-report="1" data-staff="${escapeHtml(r.id)}" data-mode="collab">
                <span class="dashCompareLbl"><i class="lg collab"></i>Phối hợp</span>
                <span class="dashCompareNum">${r.collabCount}</span>
              </button>
              <div class="dashCompareTrack"><div class="dashCompareFill fill-collab" style="width:${wCollab}%"></div></div>

              <button type="button" class="dashCompareBtn" data-dash-report="1" data-staff="${escapeHtml(r.id)}" data-mode="late">
                <span class="dashCompareLbl"><i class="lg over"></i>Quá hạn</span>
                <span class="dashCompareNum">${r.lateCount}</span>
              </button>
              <div class="dashCompareTrack"><div class="dashCompareFill fill-over" style="width:${wLate}%"></div></div>
            </div>
          </div>`;
      }).join('');
      el.innerHTML = `
        <div class="dashChartHeader">
          <div>
            <div class="dashChartTitle">Báo cáo theo cán bộ</div>
            <div class="dashChartSub">So sánh số lượng báo cáo đầu mối, phối hợp và quá hạn. Bấm từng dòng để lọc tab Báo cáo.</div>
          </div>
          <div class="dashLegend">
            <span><i class="lg new"></i>Đầu mối</span>
            <span><i class="lg collab"></i>Phối hợp</span>
            <span><i class="lg over"></i>Quá hạn</span>
          </div>
        </div>
        <div class="dashCompareList">${list}</div>`;
      return;
    }

    const chartH=Math.max(260, rows.length*74);
    const pad={top:24,right:26,bottom:40,left:120};
    const innerW=660;
    const innerH=chartH-pad.top-pad.bottom;
    const groupH=innerH/Math.max(1,rows.length);
    const barH=Math.max(10, Math.min(16, (groupH-18)/3));
    const gap=5;
    const colors={lead:'#0f766e', collab:'#2563eb', late:'#dc2626'};
    const x=(v)=> pad.left + (v/maxVal)*innerW;
    const yBase=(i)=> pad.top + i*groupH;
    const ticks=[];
    for(let i=0;i<=maxVal;i++) ticks.push(i);
    const grid=ticks.map(v=>{
      const xv=x(v);
      return `<g><line x1="${xv}" y1="${pad.top-8}" x2="${xv}" y2="${pad.top+innerH}" stroke="#d7e1dd" stroke-dasharray="4 4"/><text x="${xv}" y="${chartH-14}" text-anchor="middle" font-size="11" fill="#5b6b67">${v}</text></g>`;
    }).join('');
    const bars=rows.map((r,i)=>{
      const y=yBase(i);
      const lines=[
        {key:'lead', label:'Đầu mối', value:r.leadCount, y:y+4, mode:'lead'},
        {key:'collab', label:'Phối hợp', value:r.collabCount, y:y+4+barH+gap, mode:'collab'},
        {key:'late', label:'Quá hạn', value:r.lateCount, y:y+4+(barH+gap)*2, mode:'late'},
      ].map(item=>{
        const width=Math.max(item.value>0 ? 10 : 0, (item.value/maxVal)*innerW);
        const textX=item.value>0 ? Math.min(pad.left+innerW-8, pad.left+width+8) : pad.left+8;
        return `
          <g class="dashBarHot" data-dash-report="1" data-staff="${escapeHtml(r.id)}" data-mode="${item.mode}" style="cursor:pointer">
            <title>${escapeHtml(r.alias)} • ${escapeHtml(item.label)}: ${item.value}</title>
            <rect x="${pad.left}" y="${item.y}" width="${width}" height="${barH}" rx="6" fill="${colors[item.key]}" opacity="0.92"></rect>
            <text x="${textX}" y="${item.y+barH-2}" font-size="11" fill="#16312b">${item.value}</text>
          </g>`;
      }).join('');
      return `
        <g>
          <text x="${pad.left-12}" y="${y+16}" text-anchor="end" font-size="13" font-weight="700" fill="#082c35">${escapeHtml(r.alias)}</text>
          <text x="${pad.left-12}" y="${y+32}" text-anchor="end" font-size="11" fill="#5b6b67">${escapeHtml(r.name)}</text>
          ${lines}
        </g>`;
    }).join('');

    el.innerHTML = `
      <div class="dashChartHeader">
        <div>
          <div class="dashChartTitle">Báo cáo theo cán bộ</div>
          <div class="dashChartSub">So sánh số lượng báo cáo đầu mối, phối hợp và báo cáo quá hạn. Bấm trực tiếp từng thanh để lọc tab Báo cáo.</div>
        </div>
        <div class="dashLegend">
          <span><i class="lg new"></i>Đầu mối</span>
          <span><i class="lg collab"></i>Phối hợp</span>
          <span><i class="lg over"></i>Quá hạn</span>
        </div>
      </div>
      <div class="dashSvgWrap">
        <svg viewBox="0 0 ${pad.left+innerW+pad.right} ${chartH}" class="dashSvgChart" role="img" aria-label="Biểu đồ báo cáo theo cán bộ">
          ${grid}
          ${bars}
        </svg>
      </div>
    `;
  }

  function dashboardForecastSummaryRows(staff, metrics){
    return (metrics||[]).map(m=>{
      let actual=0, weekPlan=0, quarterPlan=0, hasA=false, hasW=false, hasQ=false;
      for(const s of staff){
        const row=getFcRow(state.week, s.id, m.key);
        const a=numOrNull(row.actual), w=numOrNull(row.weekPlan), q=numOrNull(row.quarterPlan);
        if(a!==null){actual+=a; hasA=true;}
        if(w!==null){weekPlan+=w; hasW=true;}
        if(q!==null){quarterPlan+=q; hasQ=true;}
      }
      const A=hasA?actual:null, W=hasW?weekPlan:null, Q=hasQ?quarterPlan:null;
      const progress=(A!==null && Q && Q>0) ? Math.min(100, Math.round(A/Q*100)) : 0;
      const gap=(A!==null && Q!==null) ? (A-Q) : null;
      const weekDelta=(A!==null && W!==null) ? (W-A) : null;
      return {key:m.key,name:m.name||m.key,unit:m.unit||"",A,W,Q,progress,gap,weekDelta};
    });
  }

  function renderForecastProgressChart(el, rows){
    if(!el) return;
    const data=(rows||[]).filter(r=>r.Q!==null || r.A!==null || r.W!==null);
    if(!data.length){
      el.innerHTML = `<div class="dashEmpty">Chưa có dữ liệu forecast để vẽ biểu đồ.</div>`;
      return;
    }
    const bars=data.map(r=>{
      const pctVal=Math.max(0, Math.min(100, Number(r.progress||0)));
      const gapCls=r.gap!==null && r.gap<0 ? 'neg' : '';
      return `
        <div class="dashGaugeRow">
          <div class="dashGaugeHead">
            <div>
              <div class="dashMetricName">${escapeHtml(r.name)}</div>
              <div class="dashFull">${escapeHtml(r.unit||'')}</div>
            </div>
            <div class="dashGaugePct">${pctVal}%</div>
          </div>
          <div class="dashGaugeTrack"><div class="dashGaugeFill" style="width:${Math.max(3,pctVal)}%"></div></div>
          <div class="dashMetricNums">
            <span class="dashMini">Đã TH: ${r.A===null?'-':fmtNum(r.A)}</span>
            <span class="dashMini">KH Quý: ${r.Q===null?'-':fmtNum(r.Q)}</span>
            <span class="dashMini ${gapCls}">GAP Quý: ${r.gap===null?'-':fmtNum(r.gap)}</span>
          </div>
        </div>`;
    }).join('');
    el.innerHTML = `
      <div class="dashChartHeader">
        <div>
          <div class="dashChartTitle">Tiến độ forecast so với KH quý</div>
          <div class="dashChartSub">Biểu đồ gauge tổng hợp mức độ hoàn thành kế hoạch quý theo từng chỉ tiêu.</div>
        </div>
      </div>
      <div>${bars}</div>
    `;
  }


  function renderDashboard(){
    const dashTaskCompareChart = $("#dashTaskCompareChart");
    const dashReportCompareChart = $("#dashReportCompareChart");
    const dashForecastChart = $("#dashForecastChart");
    const dashCards = $("#dashCards");
    const dashTaskStatus = $("#dashTaskStatus");
    const dashReportSummary = $("#dashReportSummary");
    const dashForecastRows = $("#dashForecastRows");
    const dashStaffTaskBody = $("#dashStaffTaskBody");
    const dashStaffReportBody = $("#dashStaffReportBody");
    if(!dashTaskCompareChart || !dashCards || !dashTaskStatus || !dashReportSummary || !dashForecastRows || !dashStaffTaskBody || !dashStaffReportBody) return;

    const L=getLists();
    const staff=(L.staff||[]).filter(s=>String(s.id)!=="54000600");
    const tasks=dashboardTasksBase();
    const reports=dashboardReportRows();

    const totalTasks=tasks.length;
    const doneTasks=tasks.filter(t=>isDone(t.status)).length;
    const openTasks=tasks.filter(t=>!isDone(t.status)).length;
    const overdueTasks=tasks.filter(t=>isOverdue(t)).length;

    renderTaskCompareChart(dashTaskCompareChart, dashboardTaskCompareRows(tasks, staff));
    renderReportCompareChart(dashReportCompareChart, dashboardReportCompareRows(reports, staff));

    dashCards.innerHTML = `
      <div class="card"><div class="k">Tổng việc tuần</div><div class="v">${totalTasks}</div><div class="smallHelp">Tuần ${escapeHtml(fmtDDMMYYYY(state.week))}</div></div>
      <div class="card"><div class="k">Hoàn thành</div><div class="v">${doneTasks}</div><div class="smallHelp">Tỷ lệ ${totalTasks?Math.round(doneTasks/totalTasks*100):0}%</div></div>
      <div class="card"><div class="k">Đang mở</div><div class="v">${openTasks}</div><div class="smallHelp">Chưa hoàn thành</div></div>
      <div class="card"><div class="k">Quá hạn</div><div class="v">${overdueTasks}</div><div class="smallHelp">Cần ưu tiên xử lý</div></div>
    `;

    const statuses=(L.statuses&&L.statuses.length?L.statuses:["Not started","Doing","Done","Blocked"]);
    const maxStatus=Math.max(1, ...statuses.map(st=>tasks.filter(t=>String(t.status||"")===String(st)).length));
    dashTaskStatus.innerHTML = statuses.map(st=>{
      const count=tasks.filter(t=>String(t.status||"")===String(st)).length;
      const w=Math.max(4, Math.round(count/maxStatus*100));
      return `<div class="dashBarRow"><div class="dashBarLabel">${escapeHtml(st)}</div><div class="dashBarTrack"><div class="dashBarFill" style="width:${w}%"></div></div><div class="dashBarValue">${count}</div></div>`;
    }).join("") || '<div class="dashEmpty">Chưa có trạng thái công việc.</div>';

    const repDone=reports.filter(r=>String(r.status||"")==="Hoàn thành").length;
    const repDueSoon=reports.filter(r=>repDueClass(r)==="rep-duesoon").length;
    const repOver=reports.filter(r=>repDueClass(r)==="rep-overdue").length;
    const repOpen=reports.length-repDone;
    dashReportSummary.innerHTML = `
      <div class="grid4">
        <div class="card"><div class="k">Tổng báo cáo</div><div class="v">${reports.length}</div></div>
        <div class="card"><div class="k">Hoàn thành</div><div class="v">${repDone}</div></div>
        <div class="card"><div class="k">Đang mở</div><div class="v">${repOpen}</div></div>
        <div class="card"><div class="k">Quá hạn / Sắp hạn</div><div class="v">${repOver} / ${repDueSoon}</div></div>
      </div>
      <div class="dashHint">Thống kê báo cáo lấy từ toàn bộ dữ liệu hiện có, không phụ thuộc bộ lọc của tab Báo cáo.</div>
    `;

    const metrics=(L.forecastMetrics||[]);
    const forecastRows = dashboardForecastSummaryRows(staff, metrics);
    renderForecastProgressChart(dashForecastChart, forecastRows);
    dashForecastRows.innerHTML = forecastRows.length ? forecastRows.map(r=>{
      return `
        <div class="dashMetric">
          <div class="dashMetricHead">
            <div>
              <div class="dashMetricName">${escapeHtml(r.name)}</div>
              <div class="dashFull">${escapeHtml(r.unit||"")}</div>
            </div>
            <div class="dashMetricPct">${r.Q?r.progress:0}% KH quý</div>
          </div>
          <div class="dashBarTrack" style="margin-top:10px"><div class="dashBarFill" style="width:${Math.max(4,r.progress)}%"></div></div>
          <div class="dashMetricNums">
            <span class="dashMini">Đã TH: ${r.A===null?'-':fmtNum(r.A)}</span>
            <span class="dashMini">KH Tuần: ${r.W===null?'-':fmtNum(r.W)}</span>
            <span class="dashMini">KH Quý: ${r.Q===null?'-':fmtNum(r.Q)}</span>
            <span class="dashMini ${r.gap!==null && r.gap<0 ? 'neg':''}">GAP Quý: ${r.gap===null?'-':fmtNum(r.gap)}</span>
            <span class="dashMini ${r.weekDelta!==null && r.weekDelta<0 ? 'neg':''}">Chênh KH Tuần: ${r.weekDelta===null?'-':fmtNum(r.weekDelta)}</span>
          </div>
        </div>`;
    }).join("") : '<div class="dashEmpty">Chưa khai báo forecastMetrics trong Danh mục.</div>';

    const taskRows = staff.map(s=>{
      const my=tasks.filter(t=>String(t.ownerId)===String(s.id));
      const total=my.length;
      const done=my.filter(t=>isDone(t.status)).length;
      const over=my.filter(t=>isOverdue(t)).length;
      const open=total-done;
      return {
        id:s.id,
        name:s.name||s.id,
        alias:shortStaffName(s.name||s.id, s.id),
        total, done, open, over, rate: total?Math.round(done/total*100):0
      };
    }).sort((a,b)=> (b.total-a.total) || (b.over-a.over) || a.alias.localeCompare(b.alias));

    dashStaffTaskBody.innerHTML = taskRows.length ? taskRows.map(r=>`
      <tr>
        <td><div class="dashAlias">${escapeHtml(r.alias)}</div><div class="dashFull">${escapeHtml(r.name)}</div></td>
        <td>${r.total}</td>
        <td>${r.done}</td>
        <td>${r.open}</td>
        <td>${r.over}</td>
        <td>${r.rate}%</td>
      </tr>`).join("") : '<tr><td colspan="6" class="dashEmpty">Chưa có dữ liệu công việc.</td></tr>';

    const reportRows = staff.map(s=>{
      const lead=reports.filter(r=>String(r.leadId||"")===String(s.id));
      const collab=reports.filter(r=>(r.collaborators||[]).map(String).includes(String(s.id)));
      const leadDone=lead.filter(r=>String(r.status||"")==="Hoàn thành").length;
      const leadOver=lead.filter(r=>repDueClass(r)==="rep-overdue").length;
      const collabDone=collab.filter(r=>String(((r.parts||{})[String(s.id)]||{}).status||"")==="Done").length;
      const totalResp=lead.length+collab.length;
      const score=totalResp?Math.round(((leadDone+collabDone)/totalResp)*100):0;
      return {
        id:s.id,
        name:s.name||s.id,
        alias:shortStaffName(s.name||s.id, s.id),
        leadTotal:lead.length,
        leadDone,
        leadOver,
        collabTotal:collab.length,
        collabDone,
        score
      };
    }).sort((a,b)=> ((b.leadTotal+b.collabTotal)-(a.leadTotal+a.collabTotal)) || (b.leadOver-a.leadOver) || a.alias.localeCompare(b.alias));

    dashStaffReportBody.innerHTML = reportRows.length ? reportRows.map(r=>`
      <tr>
        <td><div class="dashAlias">${escapeHtml(r.alias)}</div><div class="dashFull">${escapeHtml(r.name)}</div></td>
        <td>${r.leadTotal}</td>
        <td>${r.leadDone}</td>
        <td>${r.leadOver}</td>
        <td>${r.collabTotal}</td>
        <td>${r.collabDone}</td>
        <td>${r.score}%</td>
      </tr>`).join("") : '<tr><td colspan="7" class="dashEmpty">Chưa có dữ liệu báo cáo.</td></tr>';
  }

  
  // ---- Task permissions ----
  // Rule:
  // - Everyone can EDIT tasks where they are assignee (ownerId==me) OR creator (assignedById==me)
  // - Only CREATOR (assignedById==me) can DELETE their own created tasks
  // - Manager (CFG.managerIds) can edit/delete all tasks
  function canEditTask(t){
    const meId = state.meId;
    if(!meId) return false;
    if(isManager(meId)) return true;
    return String(t.ownerId||"")===String(meId) || String(t.assignedById||"")===String(meId);
  }
  function canDeleteTask(t){
    const meId = state.meId;
    if(!meId) return false;
    if(isManager(meId)) return true;
    return String(t.assignedById||"")===String(meId);
  }
  function applyTaskFormPermissions(task){
    const meId = state.meId;
    const all = [fmGroup,fmOwner,fmTitle,fmDeadline,fmStatus,fmPriority,fmCarry,fmKpi,fmMetric,fmCommit,fmActual,fmNote];
    all.forEach(el=>{ if(el) el.disabled=false; });

    const hintEl = taskForm ? taskForm.querySelector(".smallHelp") : null;
    const defaultHint = "Nhập xong bấm Lưu. Có thể bấm ESC hoặc click ra ngoài để đóng.";

    if(!task){
      if(hintEl) hintEl.textContent = defaultHint;
      return;
    }

    const creator = String(task.assignedById||"")===String(meId);
    const manager = isManager(meId);

    if(!manager && !creator){
      // Lock fields that define the task
      [fmGroup,fmOwner,fmTitle,fmDeadline,fmPriority,fmCarry,fmKpi,fmMetric,fmCommit].forEach(el=>{ if(el) el.disabled=true; });
      // Allow progress fields
      [fmStatus,fmActual,fmNote].forEach(el=>{ if(el) el.disabled=false; });

      if(hintEl){
        hintEl.innerHTML = "Bạn chỉ có quyền <b>cập nhật tiến độ</b> (Trạng thái/Actual/Ghi chú) cho việc được giao. Không thể đổi nội dung giao việc.";
      }
    } else {
      if(hintEl) hintEl.textContent = defaultHint;
    }
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

  async function sbReadJSONConfig(configKey){
    const attempts = [
      `app_config?select=config_value&config_key=eq.${encodeURIComponent(configKey)}&limit=1`,
      `app_meta?select=config_value&config_key=eq.${encodeURIComponent(configKey)}&limit=1`,
      `app_meta?select=meta_value&meta_key=eq.${encodeURIComponent(configKey)}&limit=1`
    ];
    for(const path of attempts){
      try{
        const res = await fetch(sbUrl(path), {headers: sbHeaders()});
        if(!res.ok) continue;
        const rows = await res.json();
        const first = Array.isArray(rows) ? rows[0] : null;
        const raw = first ? (first.config_value ?? first.meta_value ?? null) : null;
        if(raw && typeof raw === "object") return raw;
        if(typeof raw === "string"){
          try{ return JSON.parse(raw); }catch{ return null; }
        }
        return null;
      }catch(e){
        console.warn("read config failed", path, e);
      }
    }
    return null;
  }

  async function sbWriteJSONConfig(configKey, value){
    const jsonValue = value ?? {};
    const attempts = [
      {
        path: `app_config?on_conflict=config_key`,
        payload: [{config_key: configKey, config_value: jsonValue, updated_at: new Date().toISOString()}]
      },
      {
        path: `app_meta?on_conflict=config_key`,
        payload: [{config_key: configKey, config_value: jsonValue, updated_at: new Date().toISOString()}]
      },
      {
        path: `app_meta?on_conflict=meta_key`,
        payload: [{meta_key: configKey, meta_value: jsonValue, updated_at: new Date().toISOString()}]
      }
    ];
    for(const item of attempts){
      try{
        const headers = sbHeaders();
        headers["Prefer"] = "return=minimal,resolution=merge-duplicates";
        const res = await fetch(sbUrl(item.path), {method:"POST", headers, body: JSON.stringify(item.payload)});
        if(res.ok) return {ok:true};
      }catch(e){
        console.warn("write config failed", item.path, e);
      }
    }
    return {ok:false};
  }

  function mergeStaffRows(baseArr, extraArr){
    const byId = new Map();
    for(const item of [...(baseArr||[]), ...(extraArr||[])]){
      const id = String((item && item.id) || "").trim();
      if(!id) continue;
      const old = byId.get(id) || {};
      byId.set(id, {
        ...old,
        ...item,
        id,
        name: String((item && item.name) || old.name || id),
        emailBidv: String((item && item.emailBidv) || old.emailBidv || ""),
        emailGmail: String((item && item.emailGmail) || old.emailGmail || ""),
        notifyEmail: String((item && item.notifyEmail) || old.notifyEmail || (item && item.emailBidv) || (item && item.emailGmail) || ""),
        notifySource: String((item && item.notifySource) || old.notifySource || "")
      });
    }
    return Array.from(byId.values());
  }

  function sanitizeListsPayload(raw){
    const current = getLists();
    const src = (raw && typeof raw === "object") ? raw : {};
    return {
      staff: Array.isArray(src.staff) ? mergeStaffRows(current.staff||[], src.staff||[]) : (current.staff||[]),
      groups: Array.isArray(src.groups) && src.groups.length ? src.groups.map(String) : (current.groups||[]),
      statuses: Array.isArray(src.statuses) && src.statuses.length ? src.statuses.map(String) : (current.statuses||[]),
      priorities: Array.isArray(src.priorities) && src.priorities.length ? src.priorities.map(String) : (current.priorities||[]),
      kpis: Array.isArray(src.kpis) && src.kpis.length ? src.kpis.map(String) : (current.kpis||[]),
      outputMetrics: Array.isArray(src.outputMetrics) && src.outputMetrics.length ? src.outputMetrics.map(String) : (current.outputMetrics||[]),
      forecastMetrics: Array.isArray(src.forecastMetrics) && src.forecastMetrics.length ? src.forecastMetrics : (current.forecastMetrics||[]),
      reportTypes: Array.isArray(src.reportTypes) && src.reportTypes.length ? src.reportTypes.map(String) : (current.reportTypes||[]),
      reportStatuses: Array.isArray(src.reportStatuses) && src.reportStatuses.length ? src.reportStatuses.map(String) : (current.reportStatuses||[]),
      updatedAt: String(src.updatedAt || src.updated_at || "")
    };
  }

  // ---- State ----
  const state={
    _lastTouch: 0,
    week: pickWeekStartISO(toISO(new Date())),
    meId:"",
    prefillOwner:"",
    view:"dashboard",
    filterAssignee:"",
    filterStatus:"",
    filterGroup:"",
    onlyOverdue:false,
    tasks:[],
    reports: loadJSON("KHT_REPORTS") || [],
    repFilterLead:"",
    repFilterType:"",
    repFilterStatus:"",
    repOnlyMine:false,
    repOnlyDueSoon:false,

    forecast: loadJSON(KEY_FC_LOCAL) || {}, // key: week|staff|metric
    fcStaff:"",
    fcMetric:"",
    fcEditAdmin:false,
    sortField:"deadline",
    sortDir:"asc",
    repSortField:"deadline",
    repSortDir:"asc",
    dashboardTaskFilter:"",
    dashboardTaskStaff:"",
    dashboardReportMode:"",
    dashboardReportStaff:"",
    syncing:false,
    timer:null
  };

  // ---- DOM ----
  const elWeek=$("#weekPicker"), elMe=$("#mePicker"), weekPickerDisplay=$("#weekPickerDisplay");
  const btnAdd=$("#btnAdd"), btnAddFab=$("#btnAddFab"), btnExport=$("#btnExport"), btnDashPdf=$("#btnDashPdf"), btnLists=$("#btnLists");
  const tabDashboard=$("#tabDashboard"), tabTasks=$("#tabTasks"), tabForecast=$("#tabForecast"), tabReports=$("#tabReports");
  const viewDashboard=$("#viewDashboard"), viewTasks=$("#viewTasks"), viewForecast=$("#viewForecast"), viewReports=$("#viewReports");

  const tbody=$("#tasksTbody");
  const sumTotal=$("#sumTotal"), sumDone=$("#sumDone"), sumOverdue=$("#sumOverdue"), sumPct=$("#sumPct");
  const filterAssignee=$("#filterAssignee"), filterStatus=$("#filterStatus"), filterGroup=$("#filterGroup");
  const filterOverdue=$("#filterOverdue"), btnClear=$("#btnClearFilter"), taskDrillHint=$("#taskDrillHint");

  const syncDot=$("#syncDot"), syncText=$("#syncText");

  // Task modal
  const taskBackdrop=$("#taskBackdrop"), taskClose=$("#taskClose"), taskTitle=$("#taskTitle"), taskForm=$("#taskForm"), btnCancel=$("#btnCancel");
  const fmId=$("#fmId"), fmGroup=$("#fmGroup"), fmOwner=$("#fmOwner"), fmTitle=$("#fmTitle"), fmDeadline=$("#fmDeadline"), fmStatus=$("#fmStatus");
  const fmPriority=$("#fmPriority"), fmCarry=$("#fmCarry"), fmKpi=$("#fmKpi"), fmMetric=$("#fmMetric"), fmCommit=$("#fmCommit"), fmActual=$("#fmActual"), fmNote=$("#fmNote");

  // Lists modal
  const listsBackdrop=$("#listsBackdrop"), listsClose=$("#listsClose"), btnListsCancel=$("#btnListsCancel"), btnListsSave=$("#btnListsSave");
  const staffList=$("#staffList"), statusList=$("#statusList"), groupList=$("#groupList"), priorityList=$("#priorityList"), kpiList=$("#kpiList"), metricList=$("#metricList"), fcKpiList=$("#fcKpiList"), repTypeList=$("#repTypeList"), repStatusList=$("#repStatusList");
  const btnAddStaff=$("#btnAddStaff"), btnAddStatus=$("#btnAddStatus"), btnAddGroup=$("#btnAddGroup"), btnAddPriority=$("#btnAddPriority"), btnAddKpi=$("#btnAddKpi"), btnAddMetric=$("#btnAddMetric"), btnAddFcKpi=$("#btnAddFcKpi"), btnAddRepType=$("#btnAddRepType"), btnAddRepStatus=$("#btnAddRepStatus");
  const stMode=$("#stMode"), stInterval=$("#stInterval"), stUrl=$("#stUrl"), stKey=$("#stKey");

  // Forecast
  const fcStaffFilter=$("#fcStaffFilter"), fcMetricFilter=$("#fcMetricFilter"), btnFcImport=$("#btnFcImport"), btnFcToggle=$("#btnFcToggleEdit");
  const fcImportFile=$("#fcImportFile");
  const fcCards=$("#fcCards");
  // Reports DOM
  const repTotal=$("#repTotal"), repDone=$("#repDone"), repDueSoon=$("#repDueSoon"), repOverdue=$("#repOverdue");
  const repFilterLead=$("#repFilterLead"), repFilterType=$("#repFilterType"), repFilterStatus=$("#repFilterStatus");
  const repOnlyMine=$("#repOnlyMine"), repOnlyDueSoon=$("#repOnlyDueSoon"), btnRepClear=$("#btnRepClear");
  const btnRepAdd=$("#btnRepAdd");
  const repTbody=$("#repTbody"), repDrillHint=$("#repDrillHint");

  // Report modal DOM
  const repBackdrop=$("#repBackdrop"), repClose=$("#repClose"), repCancel=$("#repCancel"), repForm=$("#repForm");
  const repTitle=$("#repTitle"), repId=$("#repId"), repType=$("#repType"), repDeadline=$("#repDeadline");
  const repName=$("#repName"), repLead=$("#repLead"), repStatus=$("#repStatus"), repNote=$("#repNote");
  const repCollabPick=$("#repCollabPick"), repPartsBox=$("#repPartsBox");


  // Forecast modal
  const fcBackdrop=$("#fcBackdrop");
  const fcClose=$("#fcClose");
  const fcCancel=$("#fcCancel");
  const fcForm=$("#fcForm");
  const fcTitle=$("#fcTitle");
  const fcStaffId=$("#fcStaffId");
  const fcMetricKey=$("#fcMetricKey");
  const fcStaffName=$("#fcStaffName");
  const fcWeek=$("#fcWeek");
  const fcActual=$("#fcActual");
  const fcWeekPlan=$("#fcWeekPlan");
  const fcQuarterPlan=$("#fcQuarterPlan");
  const fcDeltaChip=$("#fcDeltaChip");
  const fcGapChip=$("#fcGapChip");
  const fcHint=$("#fcHint");


  // ---- UI helpers ----
  function mark(ok, text){
    syncDot.classList.remove("ok","bad");
    syncDot.classList.add(ok ? "ok" : "bad");
    syncText.textContent = text;
  }

  function closeModals(){
    taskBackdrop.classList.remove("open");
    listsBackdrop.classList.remove("open");
    if(typeof fcBackdrop!=="undefined" && fcBackdrop) fcBackdrop.classList.remove("open");
    if(typeof repBackdrop!=="undefined" && repBackdrop) repBackdrop.classList.remove("open");
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
    if(!el) return;
    el.innerHTML="";
    if(emptyLabel!==null){
      const o=document.createElement("option");
      o.value=""; o.textContent=emptyLabel;
      el.appendChild(o);
    }
    (items||[]).forEach(it=>{
      const o=document.createElement("option");
      if(valueKey){
        o.value = String(it && it[valueKey]!==undefined ? it[valueKey] : "");
      }else{
        o.value = String(it && it.id!==undefined ? it.id : it);
      }
      if(labelFn){
        o.textContent = String(labelFn(it));
      }else if(it && typeof it==="object"){
        o.textContent = String(it.name!==undefined ? it.name : o.value);
      }else{
        o.textContent = String(it);
      }
      el.appendChild(o);
    });
  }

  

  // Fill dropdown options inside Task modal (call ONLY when opening the modal)
  function fillTaskModalOptions(){
    const L=getLists();
    fillSelect(fmOwner, L.staff || [], {valueKey:"id", labelFn:s=>`${s.id} - ${s.name}`, emptyLabel:"-- Chọn --"});
    fillSelect(fmGroup, L.groups || [], {emptyLabel:"-- Chọn --"});
    fillSelect(fmStatus, L.statuses || [], {emptyLabel:"-- Chọn --"});
    fillSelect(fmPriority, L.priorities || [], {emptyLabel:"-- Chọn --"});
    fillSelect(fmCarry, ["Y","N"], {emptyLabel:"-- Chọn --"});
    fillSelect(fmKpi, L.kpis || [], {emptyLabel:"-- (tuỳ chọn) --"});
    fillSelect(fmMetric, L.outputMetrics || [], {emptyLabel:"-- (tuỳ chọn) --"});
  }

  function refreshDropdowns(){
    // IMPORTANT: do not rebuild dropdowns while a modal is open (prevents reset while typing)
    if(document.body.classList.contains("modal-open")) return;

    const L=getLists();
    const staff=L.staff||[];
    fillSelect(elMe, staff, {valueKey:"id", labelFn:s=>shortStaffName(s.name||s.id, s.id), emptyLabel:"-- Chọn --"});
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

    // Forecast metric filter
    const mOpts = [{key:"", name:"-- Tất cả chỉ tiêu --"}].concat((L.forecastMetrics||[]).map(m=>({key:m.key, name:m.name})));
    fillSelect(fcMetricFilter, mOpts, {valueKey:"key", labelFn:m=>m.name, emptyLabel:null});


    if(state.meId) elMe.value=state.meId;
    if(state.filterAssignee) filterAssignee.value=state.filterAssignee;
    if(state.filterStatus) filterStatus.value=state.filterStatus;
    if(state.filterGroup) filterGroup.value=state.filterGroup;
    if(state.fcStaff) fcStaffFilter.value=state.fcStaff;
    if(state.fcMetric) fcMetricFilter.value=state.fcMetric;
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
      if(state.dashboardTaskFilter){
        if(String(state.dashboardTaskFilter)==="new" && String(t.weekStart||"")!==String(state.week)) return false;
        if(String(state.dashboardTaskFilter)==="due" && !isDueThisWeekTask(t)) return false;
        if(String(state.dashboardTaskFilter)==="over" && !isOverdue(t)) return false;
      }
      return true;
    }).map(t=>{
      const s=staffById(t.ownerId);
      return {...t, ownerName: s? s.name : (t.ownerName||t.ownerId)};
    }).sort((a,b)=>{
      const ao=isOverdue(a)?0:1, bo=isOverdue(b)?0:1;
      if(ao!==bo) return ao-bo;

      const field = String(state.sortField||"deadline");
      const dir = state.sortDir === "desc" ? -1 : 1;
      const getVal = (row) => {
        switch(field){
          case "seq": return Number(row.seq||0);
          case "group": return String(row.group||"").toLowerCase();
          case "title": return String(row.title||"").toLowerCase();
          case "deadline": {
            const d=parseISO(row.deadline||"");
            return d ? d.getTime() : Number.MAX_SAFE_INTEGER;
          }
          case "ownerName": return String(row.ownerName||row.ownerId||"").toLowerCase();
          case "status": return String(row.status||"").toLowerCase();
          case "note": return String(row.note||"").toLowerCase();
          case "priority": return String(row.priority||"").toLowerCase();
          default: return String(row[field]||"").toLowerCase();
        }
      };
      const va=getVal(a), vb=getVal(b);
      if(va<vb) return -1*dir;
      if(va>vb) return 1*dir;
      return String(a.id||"").localeCompare(String(b.id||""));
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

    if(taskDrillHint){
      if(state.dashboardTaskFilter && state.dashboardTaskStaff){
        const label=`Đang lọc từ Dashboard: ${escapeHtml(staffShortById(state.dashboardTaskStaff))} • ${escapeHtml(taskDrillLabel(state.dashboardTaskFilter))}. Bấm “Xoá lọc” để bỏ.`;
        taskDrillHint.style.display="";
        taskDrillHint.innerHTML=label;
      }else{
        taskDrillHint.style.display="none";
        taskDrillHint.innerHTML="";
      }
    }

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
          <button class="btn-mini" data-act="edit" data-id="${escapeHtml(t.id)}" ${canEditTask(t)?"":"disabled title=\"Bạn chỉ được sửa việc của mình (là người giao hoặc người được giao).\""}>Sửa</button>
          <button class="btn-mini danger" data-act="del" data-id="${escapeHtml(t.id)}" ${canDeleteTask(t)?"":"disabled title=\"Chỉ người tạo/giao việc mới được xoá. Việc trưởng phòng giao không thể xoá.\""}>Xoá</button>
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

  function metricMetaByKey(key){
    const ms=(getLists().forecastMetrics||[]);
    return ms.find(x=>String(x.key)===String(key)) || {key, name:key, unit:"", kind:"4col"};
  }

  function updateFcModalChips(metricKind){
    const a=numOrNull(fcActual.value);
    const w=numOrNull(fcWeekPlan.value);
    const q=numOrNull(fcQuarterPlan.value);
    const delta = (metricKind==="5col" && a!==null && w!==null) ? (w-a) : null;
    const gap = (a!==null && q!==null) ? (a-q) : null;

    fcDeltaChip.textContent = metricKind==="5col" ? ("Δ: " + (delta===null?"-":fmtNum(delta))) : "Δ: -";
    fcGapChip.textContent = "GAP: " + (gap===null?"-":fmtNum(gap));

    fcDeltaChip.classList.remove("neg","pos","primary");
    fcGapChip.classList.remove("neg","pos","primary");
    if(metricKind==="5col" && delta!==null) fcDeltaChip.classList.add(delta<0?"neg":"pos");
    if(gap!==null) fcGapChip.classList.add(gap<0?"neg":"pos");
  }

  function openForecastModal(staffId, metricKey){
    const meta=metricMetaByKey(metricKey);
    const staff = staffId==="__TOTAL__" ? {id:"__TOTAL__", name:"TỔNG PHÒNG"} : (staffById(staffId)||{id:staffId,name:staffId});
    const row = (staffId==="__TOTAL__") ? null : getFcRow(state.week, staffId, metricKey);

    fcTitle.textContent = "Nhập số liệu - " + meta.name;
    fcStaffId.value = staffId;
    fcMetricKey.value = metricKey;
    fcStaffName.textContent = staff.id + " - " + staff.name;
    fcWeek.textContent = fmtDDMMYYYY(state.week);

    // Permissions
    const meIsMgr=isManager(state.meId);
    const allowAdmin = state.fcEditAdmin && meIsMgr;
    const canEditWeek = meIsMgr || String(state.meId)===String(staffId);

    // Fill values
    const a = row? (row.actual??"") : "";
    const w = row? (row.weekPlan??"") : "";
    const q = row? (row.quarterPlan??"") : "";

    fcActual.value = (a===null||a==="")? "" : String(a).replace(".",",");
    fcWeekPlan.value = (w===null||w==="")? "" : String(w).replace(".",",");
    fcQuarterPlan.value = (q===null||q==="")? "" : String(q).replace(".",",");

    // Readonly rules
    fcActual.disabled = !(allowAdmin);
    fcQuarterPlan.disabled = !(allowAdmin);
    fcWeekPlan.disabled = !(canEditWeek);

    if(staffId==="__TOTAL__"){
      fcActual.disabled = true;
      fcQuarterPlan.disabled = true;
      fcWeekPlan.disabled = true;
      fcHint.innerHTML = "Đây là <b>TỔNG</b>. Không nhập trực tiếp ở đây.";
    } else {
      fcHint.innerHTML = "CB chỉ cần nhập <b>KH Tuần</b>. QL nhập/Import <b>Đã TH</b> &amp; <b>KH Quý</b>.";
    }

  // Expose forecast module openers reliably (for inline onclick)
  // These are set here (near openForecastModal) so they exist even if init() changes.
  window.__fcOpen = (staffId, metricKey) => {
    try{
      // Basic sanity checks to help debug production issues
      if(!document.getElementById("fcBackdrop")){
        alert("Thiếu modal forecast (#fcBackdrop). Hãy chắc chắn bạn đã replace index.html đúng phiên bản.");
        return;
      }
      openForecastModal(staffId, metricKey);
    }catch(e){
      console.error(e);
      alert("Không mở được module nhập số: " + (e && e.message ? e.message : e));
    }
  };

  window.__fcBadge = (staffId) => {
    try{
      if(!isManager(state.meId)) return;
      const ok = confirm("Chọn OK để GIAO VIỆC cho cán bộ này.\nChọn Cancel để XEM số liệu của cán bộ này.");
      if(ok){
        setView("tasks");
        openTask(null);
        if(fmOwner) fmOwner.value = staffId;
      }else{
        state.fcStaff = staffId;
        if(fcStaffFilter) fcStaffFilter.value = staffId;
        setView("forecast");
        renderForecastCards();
      }
    }catch(e){
      console.error(e);
      alert("Lỗi thao tác badge: " + (e && e.message ? e.message : e));
    }
  };

    updateFcModalChips(meta.kind);

    openModal(fcBackdrop);
  }

  async function saveForecastModal(){
    const staffId=fcStaffId.value;
    const metricKey=fcMetricKey.value;
    const meta=metricMetaByKey(metricKey);
    if(staffId==="__TOTAL__") return closeModals();

    const row=getFcRow(state.week, staffId, metricKey);
    if(!fcActual.disabled) row.actual = numOrNull(fcActual.value);
    if(!fcQuarterPlan.disabled) row.quarterPlan = numOrNull(fcQuarterPlan.value);
    if(!fcWeekPlan.disabled) row.weekPlan = numOrNull(fcWeekPlan.value);

    setFcRow(row);
    saveJSON(KEY_FC_LOCAL, state.forecast);
    await saveForecastRow(staffId, metricKey);

    closeModals();
    renderForecastCards();
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
    const metrics=(L.forecastMetrics || []).filter(m=>!state.fcMetric || String(m.key)===String(state.fcMetric));
    const visibleStaff = state.fcStaff
      ? staffAll.filter(s=>String(s.id)===String(state.fcStaff))
      : staffAll;

    const meIsMgr=isManager(state.meId);
    const allowAdmin = state.fcEditAdmin && meIsMgr;

    const cards=[];

    // Total card (manager)
    if(meIsMgr && !state.fcStaff){
      const rows = metrics.map(m=>{
        const sums=sumMetric(m.key);
        const a=sums.A, w=sums.W, q=sums.Q;
        const delta=(m.kind==="5col" && a!==null && w!==null) ? (w-a) : null;
        const gap=(a!==null && q!==null) ? (a-q) : null;

        const dCls = delta===null ? "" : (delta<0?"neg":"pos");
        const gCls = gap===null ? "" : (gap<0?"neg":"pos");

        return `<button type="button" class="fcRow fcTap" data-fc-staff="__TOTAL__" data-fc-metric="${escapeHtml(m.key)}" onclick="window.__fcOpen(\'__TOTAL__\',\'${escapeHtml(m.key)}\')">
          <div class="fcRowLeft">
            <div class="fcRowName">${escapeHtml(m.name)}</div>
            ${m.unit?`<div class="fcRowUnit">${escapeHtml(m.unit)}</div>`:""}
          </div>
          <div class="fcRowRight">
            <span class="chip">Đã TH: ${a===null?"-":fmtNum(a)}</span>
            <span class="chip primary">KH Tuần: ${w===null?"-":fmtNum(w)}</span>
            ${m.kind==="5col" ? `<span class="chip ${dCls}">Δ: ${delta===null?"-":fmtNum(delta)}</span>` : ``}
            <span class="chip">KH Quý: ${q===null?"-":fmtNum(q)}</span>
            <span class="chip ${gCls}">GAP: ${gap===null?"-":fmtNum(gap)}</span>
          </div>
        </button>`;
      }).join("");

      cards.push(`<div class="fcCard">
        <div class="fcCardHead">
          <div>
            <div class="fcTitle">TỔNG PHÒNG</div>
            <div class="fcSubtitle">Tổng hợp theo tất cả cán bộ • tuần ${escapeHtml(fmtDDMMYYYY(state.week))}</div>
          </div>
          <div class="fcBadge">Quản lý</div>
        </div>
        <div class="fcRowList">${rows}</div>
        <div class="smallHelp" style="margin-top:10px">Chạm vào chỉ tiêu để xem/nhập số theo dạng module.</div>
      </div>`);
    }


  function ensureReportFilters(){
    const L=getLists();
    const leadItems=[{id:"", name:"-- Lọc theo đầu mối --"}].concat((L.staff||[]).filter(s=>String(s.id)!=="54000600").map(s=>({id:String(s.id), name:`${s.id} - ${s.name}`})));
    fillSelect(repFilterLead, leadItems, {valueKey:"id", labelFn:x=>x.name});
    fillSelect(repFilterType, ["", ...(L.reportTypes||[])], {emptyLabel:"-- Lọc theo loại báo cáo --"});
    fillSelect(repFilterStatus, ["", ...(L.reportStatuses||[])], {emptyLabel:"-- Lọc theo trạng thái --"});
  
    // restore UI state (avoid hidden filters after refilling options)
    if(repFilterLead) repFilterLead.value = state.repFilterLead || "";
    if(repFilterType) repFilterType.value = state.repFilterType || "";
    if(repFilterStatus) repFilterStatus.value = state.repFilterStatus || "";
    if(repOnlyMine) repOnlyMine.checked = !!state.repOnlyMine;
    if(repOnlyDueSoon) repOnlyDueSoon.checked = !!state.repOnlyDueSoon;
}

  function renderReports(){
    if(!repTbody) return;
    ensureReportFilters();
    const L=getLists();
    const staffMap=new Map((L.staff||[]).map(s=>[String(s.id), s]));
    const me=String(state.meId||"");
    if(state.repOnlyMine && !me){
      // If user hasn't selected "Tôi là", ignore "Chỉ việc của tôi" to avoid empty list.
      state.repOnlyMine=false;
      if(repOnlyMine) repOnlyMine.checked=false;
    }

    let reps=[...(state.reports||[])];

    if(state.repFilterLead) reps=reps.filter(r=>String(r.leadId||"")===String(state.repFilterLead));
    if(state.repFilterType) reps=reps.filter(r=>String(r.type||"")===String(state.repFilterType));
    if(state.repFilterStatus) reps=reps.filter(r=>String(r.status||"")===String(state.repFilterStatus));
    if(state.repOnlyMine) reps=reps.filter(r=>String(r.leadId||"")===me || (r.collaborators||[]).map(String).includes(me) || String(r.createdById||"")===me);
    if(state.repOnlyDueSoon) reps=reps.filter(r=>{const c=repDueClass(r); return c==="rep-duesoon"||c==="rep-overdue";});
    if(state.dashboardReportMode && state.dashboardReportStaff){
      const sid=String(state.dashboardReportStaff);
      if(String(state.dashboardReportMode)==="lead") reps=reps.filter(r=>String(r.leadId||"")===sid);
      if(String(state.dashboardReportMode)==="collab") reps=reps.filter(r=>(r.collaborators||[]).map(String).includes(sid));
      if(String(state.dashboardReportMode)==="late") reps=reps.filter(r=>(String(r.leadId||"")===sid || (r.collaborators||[]).map(String).includes(sid)) && repDueClass(r)==="rep-overdue");
    }

    const total=reps.length;
    const done=reps.filter(r=>String(r.status||"")==="Hoàn thành").length;
    const dueSoon=reps.filter(r=>repDueClass(r)==="rep-duesoon").length;
    const overdue=reps.filter(r=>repDueClass(r)==="rep-overdue").length;
    repTotal.textContent=String(total);
    repDone.textContent=String(done);
    repDueSoon.textContent=String(dueSoon);
    repOverdue.textContent=String(overdue);

    if(repDrillHint){
      if(state.dashboardReportMode && state.dashboardReportStaff){
        repDrillHint.style.display="";
        repDrillHint.innerHTML=`Đang lọc từ Dashboard: ${escapeHtml(staffShortById(state.dashboardReportStaff))} • ${escapeHtml(reportDrillLabel(state.dashboardReportMode))}. Bấm “Xoá lọc” để bỏ.`;
      }else{
        repDrillHint.style.display="none";
        repDrillHint.innerHTML="";
      }
    }

    reps.sort((a,b)=>{
      const field = String(state.repSortField||"deadline");
      const dir = state.repSortDir === "desc" ? -1 : 1;
      const getVal = (row) => {
        switch(field){
          case "id": return Number(row.id||0);
          case "type": return String(row.type||"").toLowerCase();
          case "name": return String(row.name||"").toLowerCase();
          case "deadline": {
            const d=new Date(row.deadline||0);
            return Number.isNaN(d.getTime()) ? Number.MAX_SAFE_INTEGER : d.getTime();
          }
          case "lead": return String((staffMap.get(String(row.leadId||""))?.name)||row.leadId||"").toLowerCase();
          case "status": return String(row.status||"").toLowerCase();
          case "progress": {
            const total=(row.collaborators||[]).length;
            const done=(row.collaborators||[]).map(String).filter(id=>String((row.parts||{})[id]?.status||"")==="Done").length;
            return total===0 ? 1 : done/total;
          }
          default: return String(row[field]||"").toLowerCase();
        }
      };
      const va=getVal(a), vb=getVal(b);
      if(va<vb) return -1*dir;
      if(va>vb) return 1*dir;
      return Number(a.id||0)-Number(b.id||0);
    });

    repTbody.innerHTML = reps.map(rep=>{
      const lead = staffMap.get(String(rep.leadId||"")) || {name: rep.leadId||""};
      const collabs=(rep.collaborators||[]).map(String);
      const collabNames = collabs.map(id => (staffMap.get(id)?.name)||id).join(", ");
      const prog = repProgressText(rep);
      const cls = repDueClass(rep);

      const createdByName = (staffMap.get(String(rep.createdById||""))?.name) || rep.createdById || "";

      return `<tr class="${cls}">
        <td data-label="ID">#${escapeHtml(String(rep.id||""))}</td>
        <td data-label="Loại báo cáo">${escapeHtml(rep.type||"")}</td>
        <td data-label="Báo cáo">
          <div style="font-weight:900">${escapeHtml(rep.name||"")}</div>
          <div class="smallHelp">Giao bởi: ${escapeHtml(createdByName)}</div>
        </td>
        <td data-label="Deadline">${escapeHtml(fmtDDMMYYYYHHmm(rep.deadline))}</td>
        <td data-label="Đầu mối">${escapeHtml(lead.name||"")}</td>
        <td data-label="Phối hợp">${escapeHtml(collabNames||"-")}</td>
        <td data-label="Tiến độ phối hợp">${escapeHtml(prog)}</td>
        <td data-label="Trạng thái">${escapeHtml(rep.status||"")}</td>
        <td data-label="Tác vụ">
          <button class="btn-mini" data-rep="open" data-id="${escapeHtml(String(rep.id))}">Mở</button>
          <button class="btn-mini danger" data-rep="del" data-id="${escapeHtml(String(rep.id))}" ${isManager(state.meId)?"":"disabled"}>Xoá</button>
        </td>
      </tr>`;
    }).join("");
  }
  // expose for debugging
  window.renderReports = renderReports;


    // Staff cards
    for(const s of visibleStaff){
      const badge=(String(state.meId)===String(s.id)) ? "Tôi" : (meIsMgr ? "Xem/Giao" : "CB");
      const rows = metrics.map(m=>{
        const row=getFcRow(state.week, s.id, m.key);
        const {a,w,q,delta,gap} = computeDeltaGap(row, m.kind);
        const dCls = delta===null ? "" : (delta<0?"neg":"pos");
        const gCls = gap===null ? "" : (gap<0?"neg":"pos");
        return `<button type="button" class="fcRow fcTap" data-fc-staff="${escapeHtml(s.id)}" data-fc-metric="${escapeHtml(m.key)}" onclick="window.__fcOpen(\'${escapeHtml(s.id)}\',\'${escapeHtml(m.key)}\')">
          <div class="fcRowLeft">
            <div class="fcRowName">${escapeHtml(m.name)}</div>
            ${m.unit?`<div class="fcRowUnit">${escapeHtml(m.unit)}</div>`:""}
          </div>
          <div class="fcRowRight">
            <span class="chip primary">KH Tuần: ${w===null?"-":fmtNum(w)}</span>
            ${m.kind==="5col" ? `<span class="chip ${dCls}">Δ: ${delta===null?"-":fmtNum(delta)}</span>` : ``}
            <span class="chip ${gCls}">GAP: ${gap===null?"-":fmtNum(gap)}</span>
          </div>
        </button>`;
      }).join("");

      cards.push(`<div class="fcCard">
        <div class="fcCardHead">
          <div>
            <div class="fcTitle">${escapeHtml(s.id)} - ${escapeHtml(s.name)}</div>
            <div class="fcSubtitle">Chạm từng chỉ tiêu để nhập số • module đầy đủ</div>
          </div>
          <button type="button" class="fcBadge" data-fc-badge="1" data-staff="${escapeHtml(s.id)}" onclick="window.__fcBadge(\'${escapeHtml(s.id)}\')">${escapeHtml(badge)}</button>
        </div>
        <div class="fcRowList">${rows}</div>
        <div class="smallHelp" style="margin-top:10px">CB nhập <b>KH Tuần</b>. QL nhập/Import <b>Đã TH</b> &amp; <b>KH Quý</b>.</div>
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
  

  async function loadReportsFromSupabase(){
    const s=getSettings();
    if(String(s.storageMode||"local")!=="supabase") return;
    if(!sbBase() || !s.supabaseAnonKey) return;
    try{
      const res = await fetch(sbUrl("reports?select=*"), {method:"GET", headers:sbHeaders()});
      if(!res.ok) throw new Error("load reports failed " + res.status);
      const rows=await res.json();
      state.reports=(rows||[]).map(r=>({
        id: String(r.id),
        createdAt: r.created_at || "",
        type: r.type || "",
        name: r.name || "",
        deadline: r.deadline || "",
        leadId: r.lead_id || "",
        createdById: r.created_by_id || "",
        status: r.status || "Chưa bắt đầu",
        note: r.note || "",
        collaborators: Array.isArray(r.collaborators) ? r.collaborators : [],
        parts: (r.parts && typeof r.parts === "object") ? r.parts : {}
      }));
      saveJSON("KHT_REPORTS", state.reports);
    }catch(e){
      console.error(e);
    }
  }

  async function saveReportToSupabase(rep){
    const s=getSettings();
    if(String(s.storageMode||"local")!=="supabase") return;
    if(!sbBase() || !s.supabaseAnonKey) return;

    const payload={
      id: String(rep.id),
      created_at: rep.createdAt || new Date().toISOString(),
      type: rep.type,
      name: rep.name,
      deadline: rep.deadline,
      lead_id: rep.leadId,
      created_by_id: rep.createdById,
      status: rep.status,
      note: rep.note,
      collaborators: rep.collaborators || [],
      parts: rep.parts || {},
      updated_at: new Date().toISOString()
    };

    let res;
    let bodyText = "";

    try{
      const headers = sbHeaders();
      headers["Prefer"] = "return=representation,resolution=merge-duplicates";
      res = await fetch(sbUrl("reports?on_conflict=id"), {method:"POST", headers, body: JSON.stringify([payload])});
      if(res.ok) return;
      bodyText = await res.text().catch(()=>"");
    }catch(e){
      bodyText = String(e && e.message ? e.message : e || "");
    }

    try{
      const headers = sbHeaders();
      headers["Prefer"] = "return=representation";
      res = await fetch(sbUrl(`reports?id=eq.${encodeURIComponent(String(rep.id))}`), {method:"PATCH", headers, body: JSON.stringify(payload)});
      if(res.ok){
        const rows = await res.json().catch(()=>[]);
        if(Array.isArray(rows) && rows.length) return;
      }else{
        bodyText = await res.text().catch(()=>bodyText);
      }
    }catch(e){
      bodyText = String(e && e.message ? e.message : e || bodyText);
    }

    try{
      const headers = sbHeaders();
      headers["Prefer"] = "return=representation";
      res = await fetch(sbUrl("reports"), {method:"POST", headers, body: JSON.stringify([payload])});
      if(res.ok) return;
      bodyText = await res.text().catch(()=>bodyText);
    }catch(e){
      bodyText = String(e && e.message ? e.message : e || bodyText);
    }

    throw new Error(bodyText || "save report failed");
  }

  async function persistReport(rep, options={}){
    const opts = options || {};
    const i=(state.reports||[]).findIndex(r=>String(r.id)===String(rep.id));
    if(i>=0) state.reports[i]=rep; else state.reports.push(rep);
    saveJSON("KHT_REPORTS", state.reports);
    if(opts.skipRemote) return;
    await saveReportToSupabase(rep);
  }

  async function loadStaffDirectoryFromSupabase(){
    const s=getSettings();
    if(String(s.storageMode||"local")!=="supabase") return;
    if(!sbBase() || !s.supabaseAnonKey) return;
    const current=getLists();
    const mergeAndSave=(rows, full=false)=>{
      const byId=new Map((current.staff||[]).map(x=>[String(x.id), {...x}]));
      for(const r of (rows||[])){
        const id=String(r.staff_id||r.id||"");
        if(!id) continue;
        const old=byId.get(id)||{};
        byId.set(id, {
          ...old,
          id,
          name: String(r.staff_name||r.name||old.name||id),
          emailBidv: full ? String(r.email_bidv||old.emailBidv||"") : String(old.emailBidv||"") ,
          emailGmail: full ? String(r.email_gmail||old.emailGmail||"") : String(old.emailGmail||"") ,
          notifyEmail: String((full ? (r.notify_email||"") : "") || r.email || old.notifyEmail || old.emailBidv || old.emailGmail || ""),
          notifySource: old.notifySource || "custom"
        });
      }
      saveJSON(KEY_LISTS, {...current, staff: Array.from(byId.values())});
    };

    let res=await fetch(sbUrl("staff_directory?select=staff_id,staff_name,email_bidv,email_gmail,notify_email,email,is_manager&order=staff_id.asc"), {headers: sbHeaders()});
    if(res.ok){
      const rows=await res.json();
      mergeAndSave(rows, true);
      return;
    }
    // fallback schema: only email column exists
    res=await fetch(sbUrl("staff_directory?select=staff_id,staff_name,email,is_manager&order=staff_id.asc"), {headers: sbHeaders()});
    if(res.ok){
      const rows=await res.json();
      mergeAndSave(rows, false);
    }
  }

  async function syncStaffDirectoryToSupabase(staffRows){
    const s=getSettings();
    if(String(s.storageMode||"local")!=="supabase") return {ok:false, skipped:true};
    if(!sbBase() || !s.supabaseAnonKey) return {ok:false, skipped:true};
    const baseHeaders={...sbHeaders(), "Prefer":"return=representation,resolution=merge-duplicates"};
    const payloadFull=(staffRows||[]).map(x=>({
      staff_id: String(x.id||""),
      staff_name: String(x.name||""),
      email_bidv: x.emailBidv || null,
      email_gmail: x.emailGmail || null,
      notify_email: x.notifyEmail || null,
      email: x.notifyEmail || x.emailBidv || x.emailGmail || null,
      is_manager: !!isManager(x.id),
      updated_at: new Date().toISOString()
    })).filter(x=>x.staff_id && x.staff_name);
    if(!payloadFull.length) return {ok:true, skipped:true};

    let res=await fetch(sbUrl("staff_directory?on_conflict=staff_id"), {method:"POST", headers: baseHeaders, body: JSON.stringify(payloadFull)});
    if(res.ok) return {ok:true};

    // fallback for older schema without email_bidv/email_gmail/notify_email
    const payloadMin=payloadFull.map(x=>({
      staff_id: x.staff_id,
      staff_name: x.staff_name,
      email: x.email,
      is_manager: x.is_manager,
      updated_at: x.updated_at
    }));
    res=await fetch(sbUrl("staff_directory?on_conflict=staff_id"), {method:"POST", headers: baseHeaders, body: JSON.stringify(payloadMin)});
    if(res.ok) return {ok:true, fallback:true};
    const txt=await res.text().catch(()=>"");
    console.error("sync staff_directory failed", res.status, txt);
    return {ok:false, status:res.status, text:txt};
  }
  async function loadListsFromSupabase(){
    const s=getSettings();
    if(String(s.storageMode||"local")!=="supabase") return;
    if(!sbBase() || !s.supabaseAnonKey) return;
    const remoteRaw = await sbReadJSONConfig("lists_v6");
    if(!remoteRaw || typeof remoteRaw !== "object") return;
    const current = getLists();
    const remote = sanitizeListsPayload(remoteRaw);
    const merged = {
      ...current,
      ...remote,
      staff: mergeStaffRows(current.staff||[], remote.staff||[]),
      updatedAt: String(remote.updatedAt || current.updatedAt || "")
    };
    saveJSON(KEY_LISTS, merged);
  }

  async function syncListsToSupabase(listsObj){
    const s=getSettings();
    if(String(s.storageMode||"local")!=="supabase") return {ok:false, skipped:true};
    if(!sbBase() || !s.supabaseAnonKey) return {ok:false, skipped:true};
    const payload = sanitizeListsPayload({...listsObj, updatedAt: new Date().toISOString()});
    return await sbWriteJSONConfig("lists_v6", payload);
  }

async function syncAll(){
    if(state.syncing) return;
    state.syncing=true;
    if(document.body.classList.contains("modal-open")){
      // defer sync rendering until user finishes editing
    }

    try{
      const s=getSettings();
      if(s.storageMode==="supabase"){
        await loadListsFromSupabase();
        state.tasks = await sbFetchTasks();
        await sbFetchForecastWeek(state.week);
        await loadReportsFromSupabase();
        await loadStaffDirectoryFromSupabase();
        mark(true, `supabase • synced • ${new Date().toLocaleTimeString("vi-VN")}`);
      }else{
        state.tasks = loadJSON(KEY_TASKS_LOCAL) || [];
        state.forecast = loadJSON(KEY_FC_LOCAL) || state.forecast || {};
        mark(true, "local • loaded");
      }
      if(!document.body.classList.contains("modal-open")) render();
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
    state.timer=setInterval(()=>{
      if(document.hidden) return;
      if(document.body.classList.contains("modal-open")) return; // avoid resetting fields while editing
      syncAll();
    }, sec*1000);
  }

  // ---- Task modal ----
  function nextSeq(){ return state.tasks.reduce((m,t)=>Math.max(m, Number(t.seq||0)),0)+1; }
  function newId(){ return `t_${Math.random().toString(36).slice(2,10)}_${Date.now()}`; }

  
  // Defensive: ensure fillTaskModalOptions exists (avoid runtime ReferenceError)
  function fillTaskModalOptions(){
    try{
      const L=getLists();
      if(typeof fillSelect!=="function") return;
      if(typeof fmOwner==="undefined") return;
      fillSelect(fmOwner, L.staff || [], {valueKey:"id", labelFn:s=>`${s.id} - ${s.name}`, emptyLabel:"-- Chọn --"});
      fillSelect(fmGroup, L.groups || [], {emptyLabel:"-- Chọn --"});
      fillSelect(fmStatus, L.statuses || [], {emptyLabel:"-- Chọn --"});
      fillSelect(fmPriority, L.priorities || [], {emptyLabel:"-- Chọn --"});
      fillSelect(fmCarry, ["Y","N"], {emptyLabel:"-- Chọn --"});
      fillSelect(fmKpi, L.kpis || [], {emptyLabel:"-- (tuỳ chọn) --"});
      fillSelect(fmMetric, L.outputMetrics || [], {emptyLabel:"-- (tuỳ chọn) --"});
    }catch(e){
      console.warn("fillTaskModalOptions error", e);
    }
  }

  // Prefill assignee when manager assigns from Forecast
  state.prefillOwnerId = "";
  function safeOpenTask(task){
    try{
      openTask(task);
    }catch(err){
      console.error(err);
      alert("Lỗi mở form: " + (err?.message || err));
    }
  }

  function safeOpenReport(rep){
    try{
      openReport(rep);
    }catch(err){
      console.error(err);
      alert("Lỗi mở form báo cáo: " + (err?.message || err));
    }
  }

  function safeOpenAdd(){
    if(state.view==="reports"){
      if(!state.meId) return alert("Bạn cần chọn ô Tôi là để giao báo cáo.");
      if(!isManager(state.meId)) return alert("Chỉ quản lý mới giao báo cáo.");
      return safeOpenReport(null);
    }
    if(state.view==="dashboard") return safeOpenTask(null);
    return safeOpenTask(null);
  }

  function openTask(task){
    fillTaskModalOptions();

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
      fmOwner.value=(state.prefillOwner||state.meId||"");
      state.prefillOwner="";
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
    applyTaskFormPermissions(task);
    openModal(taskBackdrop);
    state.prefillOwnerId = "";
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
    const t = state.tasks.find(x=>x.id===id);
    if(t && !canDeleteTask(t)){
      alert("Bạn không có quyền xoá việc này. Chỉ người tạo/giao việc mới xoá được.\n(Việc trưởng phòng giao: chỉ cập nhật, không xoá.)");
      return;
    }

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
    // legacy 2-col row (kept for compatibility)
    const row=document.createElement("div");
    row.className="listRow";
    const a=document.createElement("input"); a.value=aVal;
    const b=document.createElement("input"); b.value=bVal;
    const del=document.createElement("button"); del.className="delBtn"; del.textContent="Xoá"; del.onclick=()=>row.remove();
    row.appendChild(a); row.appendChild(b); row.appendChild(del);
    return row;
  }
  function mkStaffRow(obj={}){
    const s = obj || {};
    const row=document.createElement("div");
    row.className="staffRow";

    const id=document.createElement("input"); id.value=String(s.id||""); id.placeholder="54000601"; id.dataset.field="id";
    const name=document.createElement("input"); name.value=String(s.name||""); name.placeholder="VÕ TUẤN ANH"; name.dataset.field="name";
    const bidv=document.createElement("input"); bidv.value=String(s.emailBidv||s.email||""); bidv.placeholder="anh_vt@bidv.com.vn"; bidv.dataset.field="emailBidv"; bidv.type="email";
    const gmail=document.createElement("input"); gmail.value=String(s.emailGmail||""); gmail.placeholder="ten@gmail.com"; gmail.dataset.field="emailGmail"; gmail.type="email";

    const notifyWrap=document.createElement("div"); notifyWrap.className="staffNotifyWrap";
    const source=document.createElement("select"); source.dataset.field="notifySource";
    [
      ["","-- Chọn --"],
      ["bidv","BIDV"],
      ["gmail","Gmail"],
      ["custom","Tuỳ chỉnh"]
    ].forEach(([v,t])=>{ const o=document.createElement("option"); o.value=v; o.textContent=t; source.appendChild(o); });
    const notify=document.createElement("input"); notify.value=String(s.notifyEmail||s.email||s.emailBidv||s.emailGmail||""); notify.placeholder="email nhận digest"; notify.dataset.field="notifyEmail"; notify.type="email";

    const detectSource=()=>{
      const nv=String(notify.value||"").trim();
      const bv=String(bidv.value||"").trim();
      const gv=String(gmail.value||"").trim();
      if(nv && bv && nv.toLowerCase()===bv.toLowerCase()) return "bidv";
      if(nv && gv && nv.toLowerCase()===gv.toLowerCase()) return "gmail";
      return nv?"custom":"";
    };
    source.value = String(s.notifySource||detectSource()||"");
    const applySource=()=>{
      if(source.value==="bidv") notify.value=String(bidv.value||"").trim();
      else if(source.value==="gmail") notify.value=String(gmail.value||"").trim();
    };
    source.onchange=applySource;
    bidv.oninput=()=>{ if(source.value==="bidv") notify.value=String(bidv.value||"").trim(); };
    gmail.oninput=()=>{ if(source.value==="gmail") notify.value=String(gmail.value||"").trim(); };

    const del=document.createElement("button"); del.className="delBtn"; del.textContent="Xoá"; del.onclick=()=>row.remove();

    notifyWrap.appendChild(source); notifyWrap.appendChild(notify);
    row.appendChild(id); row.appendChild(name); row.appendChild(bidv); row.appendChild(gmail); row.appendChild(notifyWrap); row.appendChild(del);
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

  
  function mkRowFcKpi(obj){
    const m = obj || {key:"", name:"", unit:"", kind:"4col"};
    const row=document.createElement("div");
    row.className="listRow";

    const key=document.createElement("input"); key.value=String(m.key||""); key.readOnly=true; key.placeholder="Mã KPI";
    const name=document.createElement("input"); name.value=String(m.name||""); name.placeholder="Tên hiển thị";
    const unit=document.createElement("input"); unit.value=String(m.unit||""); unit.placeholder="Đơn vị (Tỷ đồng/TK/Thẻ...)";

    const kind=document.createElement("select");
    const opt4=document.createElement("option"); opt4.value="4col"; opt4.textContent="4 cột (không Δ)";
    const opt5=document.createElement("option"); opt5.value="5col"; opt5.textContent="5 cột (có Δ)";
    kind.appendChild(opt4); kind.appendChild(opt5);
    kind.value = (String(m.kind||"4col")==="5col") ? "5col" : "4col";

    const del=document.createElement("button"); del.className="delBtn"; del.textContent="Xoá"; del.onclick=()=>row.remove();

    row.appendChild(key); row.appendChild(name); row.appendChild(unit); row.appendChild(kind); row.appendChild(del);
    return row;
  }

  function genFcKpiKey(){
    return "fc_" + Date.now().toString(36);
  }
function setListTab(name){
    $$(".tabs [data-listtab]").forEach(btn=>btn.classList.toggle("active", btn.dataset.listtab===name));
    $("#tab_staff").style.display = (name==="staff") ? "" : "none";
    $("#tab_others").style.display = (name==="others") ? "" : "none";
    $("#tab_storage").style.display = (name==="storage") ? "" : "none";
  }

  function openLists(){
    const L=getLists();
    staffList.innerHTML=""; (L.staff||[]).forEach(s=>staffList.appendChild(mkStaffRow(s)));
    statusList.innerHTML=""; (L.statuses||[]).forEach(x=>statusList.appendChild(mkRow1(String(x))));
    groupList.innerHTML=""; (L.groups||[]).forEach(x=>groupList.appendChild(mkRow1(String(x))));
    priorityList.innerHTML=""; (L.priorities||[]).forEach(x=>priorityList.appendChild(mkRow1(String(x))));
    kpiList.innerHTML=""; (L.kpis||[]).forEach(x=>kpiList.appendChild(mkRow1(String(x))));
    metricList.innerHTML=""; (L.outputMetrics||[]).forEach(x=>metricList.appendChild(mkRow1(String(x))));
    if(repTypeList){ repTypeList.innerHTML=""; (L.reportTypes||[]).forEach(x=>repTypeList.appendChild(mkRow1(String(x)))); }
    if(repStatusList){ repStatusList.innerHTML=""; (L.reportStatuses||[]).forEach(x=>repStatusList.appendChild(mkRow1(String(x)))); }
    if(fcKpiList){
      fcKpiList.innerHTML="";
      const fm = (L.forecastMetrics && L.forecastMetrics.length) ? L.forecastMetrics : (CFG.forecastMetrics||[]);
      (fm||[]).forEach(m=>fcKpiList.appendChild(mkRowFcKpi(m)));
    }

    const S=getSettings();
    stMode.value=S.storageMode;
    stInterval.value=String(S.syncSeconds);
    stUrl.value=S.supabaseUrl||"";
    stKey.value=S.supabaseAnonKey||"";
    setListTab("staff");
    openModal(listsBackdrop);
  }

  async function saveLists(){
    const staffArr=[];
    for(const row of Array.from(staffList.querySelectorAll(".staffRow"))){
      const get=(f)=>String(row.querySelector(`[data-field="${f}"]`)?.value||"").trim();
      const id=get("id");
      const name=get("name");
      const emailBidv=get("emailBidv");
      const emailGmail=get("emailGmail");
      const notifySource=get("notifySource");
      let notifyEmail=get("notifyEmail");
      if(!notifyEmail) notifyEmail = emailBidv || emailGmail || "";
      if(id && name) staffArr.push({id,name,emailBidv,emailGmail,notifyEmail,notifySource});
    }
    const seen=new Set(); const staffUniq=[];
    for(const s of staffArr){ if(seen.has(s.id)) continue; seen.add(s.id); staffUniq.push(s); }

    const read1=(container)=>Array.from(new Set(Array.from(container.querySelectorAll("input")).map(i=>String(i.value||"").trim()).filter(Boolean)));
    
    const readFcKpis=()=>{
      if(!fcKpiList) return (getLists().forecastMetrics||CFG.forecastMetrics||[]);
      const arr=[];
      for(const row of Array.from(fcKpiList.querySelectorAll(".listRow"))){
        const inputs=row.querySelectorAll("input");
        const key=String(inputs[0].value||"").trim();
        const name=String(inputs[1].value||"").trim();
        const unit=String(inputs[2].value||"").trim();
        const sel=row.querySelector("select");
        const kind=sel ? String(sel.value||"4col") : "4col";
        if(!key) continue;
        arr.push({key, name: name||key, unit, kind});
      }
      // uniq by key
      const seen=new Set(); const out=[];
      for(const m of arr){
        if(seen.has(m.key)) continue;
        seen.add(m.key);
        out.push(m);
      }
      return out;
    };
const newLists={
      staff: staffUniq.length?staffUniq:getLists().staff,
      statuses: read1(statusList),
      groups: read1(groupList),
      priorities: read1(priorityList),
      kpis: read1(kpiList),
      outputMetrics: read1(metricList),
      forecastMetrics: readFcKpis(),
      reportTypes: repTypeList ? read1(repTypeList) : (getLists().reportTypes||[]),
      reportStatuses: repStatusList ? read1(repStatusList) : (getLists().reportStatuses||[]),
      updatedAt: new Date().toISOString()
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

    const staffSyncResult = await syncStaffDirectoryToSupabase(staffUniq);
    const listsSyncResult = await syncListsToSupabase(newLists);
    refreshDropdowns();
    if(typeof renderReports==="function") renderReports();
    renderForecastCards();
    setupAutoCompactTopbar();
    // Expose handlers for inline onclick (iPhone reliability)
    window.__fcOpen = (staffId, metricKey) => { try{ openForecastModal(staffId, metricKey); }catch(e){ console.error(e); alert('Không mở được module nhập số: ' + e.message); } };
    window.__fcBadge = (staffId) => {
      try{
        if(!isManager(state.meId)) return;
        const ok = confirm('Chọn OK để GIAO VIỆC cho cán bộ này.\nChọn Cancel để XEM số liệu của cán bộ này.');
        if(ok){ setView('tasks'); openTask(null); if(fmOwner) fmOwner.value = staffId; }
        else { state.fcStaff = staffId; if(fcStaffFilter) fcStaffFilter.value = staffId; setView('forecast'); renderForecastCards(); }
      }catch(e){ console.error(e); }
    };
    setupTimer();
    syncAll();
    if(staffSyncResult && staffSyncResult.ok && !staffSyncResult.skipped){
      console.info("Đã đồng bộ staff_directory lên Supabase");
    }
    if(listsSyncResult && listsSyncResult.ok && !listsSyncResult.skipped){
      console.info("Đã đồng bộ danh mục lên Supabase");
    } else if(String(newS.storageMode||"") === "supabase"){
      console.warn("Chưa đồng bộ được danh mục lên Supabase", listsSyncResult);
      alert("Danh mục chưa đồng bộ lên Supabase. Hãy chạy SQL tạo bảng app_config rồi bấm Lưu danh mục lại.");
    }
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


  async function exportDashboardPdf(){
    try{
      if(typeof html2canvas!=="function" || !(window.jspdf && window.jspdf.jsPDF)){
        alert("Thiếu thư viện xuất PDF Dashboard. Hãy tải lại trang rồi thử lại.");
        return;
      }
      if(!viewDashboard) return;

      const oldView=state.view;
      if(oldView!=="dashboard") setView("dashboard");

      const btn = btnDashPdf;
      const oldText = btn ? btn.textContent : "";
      if(btn){ btn.disabled=true; btn.textContent="Đang tạo PDF..."; }

      await new Promise(r=>requestAnimationFrame(()=>setTimeout(r,180)));

      const target=viewDashboard;
      const canvas=await html2canvas(target,{
        scale:2,
        useCORS:true,
        allowTaint:true,
        backgroundColor:"#f5f7f6",
        width: Math.max(target.scrollWidth, target.offsetWidth),
        height: Math.max(target.scrollHeight, target.offsetHeight),
        windowWidth: Math.max(document.documentElement.clientWidth, target.scrollWidth),
        windowHeight: Math.max(document.documentElement.clientHeight, target.scrollHeight),
        scrollX: 0,
        scrollY: -window.scrollY
      });

      const { jsPDF } = window.jspdf;
      const pdf=new jsPDF("l","mm","a4");
      const pageWidth=pdf.internal.pageSize.getWidth();
      const pageHeight=pdf.internal.pageSize.getHeight();
      const margin=8;
      const usableWidth=pageWidth-margin*2;
      const usableHeight=pageHeight-margin*2;
      const imgData=canvas.toDataURL("image/png");
      const imgWidth=usableWidth;
      const imgHeight=canvas.height*imgWidth/canvas.width;

      let heightLeft=imgHeight;
      let position=margin;
      pdf.addImage(imgData,"PNG",margin,position,imgWidth,imgHeight,undefined,"FAST");
      heightLeft -= usableHeight;
      while(heightLeft>0){
        position = margin - (imgHeight - heightLeft);
        pdf.addPage("a4","l");
        pdf.addImage(imgData,"PNG",margin,position,imgWidth,imgHeight,undefined,"FAST");
        heightLeft -= usableHeight;
      }
      pdf.save(`Dashboard_${state.week}.pdf`);

      if(btn){ btn.disabled=false; btn.textContent=oldText || "Xuất PDF Dashboard"; }
      if(oldView!=="dashboard") setView(oldView);
    }catch(e){
      console.error(e);
      if(btnDashPdf){ btnDashPdf.disabled=false; btnDashPdf.textContent="Xuất PDF Dashboard"; }
      alert("Không xuất được PDF Dashboard: " + (e && e.message ? e.message : e));
    }
  }

  

  function fillReportModalSelects(){
    const L=getLists();
    // Loại báo cáo (string list)
    repType.innerHTML="";
    const ph1=document.createElement("option"); ph1.value=""; ph1.textContent="-- Chọn --"; repType.appendChild(ph1);
    (L.reportTypes||[]).forEach(t=>{
      const o=document.createElement("option"); o.value=String(t); o.textContent=String(t); repType.appendChild(o);
    });

    // CB đầu mối
    fillSelect(repLead, (L.staff||[]).filter(s=>String(s.id)!=="54000600"), {valueKey:"id", labelFn:s=>`${s.id} - ${s.name}`, emptyLabel:"-- Chọn --"});

    // Trạng thái (đầu mối)
    repStatus.innerHTML="";
    const ph2=document.createElement("option"); ph2.value=""; ph2.textContent="-- Chọn --"; repStatus.appendChild(ph2);
    (L.reportStatuses||[]).forEach(s=>{
      const o=document.createElement("option"); o.value=String(s); o.textContent=String(s); repStatus.appendChild(o);
    });
  }

  function buildCollabPick(selected){
    const L=getLists();
    const sel=new Set((selected||[]).map(String));
    repCollabPick.innerHTML="";
    (L.staff||[]).filter(s=>String(s.id)!=="54000600").forEach(s=>{
      const div=document.createElement("div");
      div.className="chipItem"+(sel.has(String(s.id))?" on":"");
      div.dataset.id=String(s.id);
      div.textContent=`${s.id} - ${s.name}`;
      div.onclick=()=>div.classList.toggle("on");
      repCollabPick.appendChild(div);
    });
  }
  function readCollabPick(){
    return Array.from(repCollabPick.querySelectorAll(".chipItem.on")).map(x=>x.dataset.id);
  }

  function renderPartsBox(rep){
    const L=getLists();
    const staffMap=new Map((L.staff||[]).map(s=>[String(s.id), s]));
    const collabs=uniq(rep.collaborators||[]);
    const parts=rep.parts||{};
    repPartsBox.innerHTML="";
    if(collabs.length===0){
      repPartsBox.innerHTML='<div class="smallHelp">Không có cán bộ phối hợp.</div>';
      return;
    }
    collabs.forEach(id=>{
      const st=staffMap.get(String(id))||{name:id};
      const p=parts[String(id)]||{status:"Pending", updatedAt:""};
      const row=document.createElement("div");
      row.className="partRow";
      const left=document.createElement("div");
      left.className="partLeft";
      left.innerHTML=`<div class="partName">${escapeHtml(st.name||id)}</div><div class="partMeta">${p.updatedAt?("Cập nhật: "+escapeHtml(fmtDDMMYYYYHHmm(p.updatedAt))):"Chưa cập nhật"}</div>`;
      const right=document.createElement("div");
      right.className="partRight";
      const btn=document.createElement("button");
      btn.type="button";
      btn.className="partBtn "+(String(p.status)==="Done"?"done":"pending");
      btn.textContent=(String(p.status)==="Done")?"Đã hoàn thành":"Chưa xong";
      const canToggle = isManager(state.meId) || String(state.meId)===String(id);
      btn.disabled=!canToggle;
      btn.onclick=async()=>{
        rep.parts=rep.parts||{};
        const cur=rep.parts[String(id)]||{status:"Pending"};
        const next=(String(cur.status)==="Done")?"Pending":"Done";
        rep.parts[String(id)]={...cur,status:next,updatedAt:new Date().toISOString()};
        repBackdrop._repObj = rep;
        renderPartsBox(rep);
        if(rep.id){
          try{
            await persistReport(rep);
            mark(true, "supabase • báo cáo đã lưu");
          }catch(e){
            console.error(e);
            mark(false, "lỗi lưu báo cáo");
            alert("Không lưu được trạng thái phối hợp báo cáo. " + (e && e.message ? e.message : e));
          }
        }
      };
      right.appendChild(btn);
      row.appendChild(left); row.appendChild(right);
      repPartsBox.appendChild(row);
    });
  }

  function openReport(rep){
    fillReportModalSelects();
    const manager=isManager(state.meId);
    const me=String(state.meId||"");
    const obj = rep ? JSON.parse(JSON.stringify(rep)) : {
      id:"",
      createdAt:new Date().toISOString(),
      type:"",
      name:"",
      deadline:"",
      leadId:"",
      createdById: me,
      status:"Chưa bắt đầu",
      note:"",
      collaborators:[],
      parts:{}
    };
    repBackdrop._repObj=obj;

    repTitle.textContent = rep ? "Cập nhật báo cáo" : "Thêm báo cáo";
    repId.value=obj.id||"";
    repType.value=obj.type||"";
    repName.value=obj.name||"";
    repDeadline.value=toDatetimeLocalValue(obj.deadline)||"";
    repLead.value=obj.leadId||"";
    repStatus.value=obj.status||"Chưa bắt đầu";
    repNote.value=obj.note||"";

    buildCollabPick(obj.collaborators||[]);
    renderPartsBox(obj);

    // permissions
    repType.disabled=!manager;
    repName.disabled=!manager;
    repDeadline.disabled=!manager;
    repLead.disabled=!manager;
    Array.from(repCollabPick.querySelectorAll(".chipItem")).forEach(ch=>ch.style.pointerEvents = manager ? "auto":"none");
    const canEditReport = manager || isLead(obj) || isCollaborator(obj) || String(obj.createdById||"")===me;
    repNote.disabled = !canEditReport;
    repStatus.disabled = !(manager || String(obj.leadId||"")===me);

    openModal(repBackdrop);
  }

  async function saveReport(){
    const obj=repBackdrop._repObj;
    if(!obj) return closeModals();
    const manager=isManager(state.meId);
    const me=String(state.meId||"");
    const canEditReport = manager || isLead(obj) || isCollaborator(obj) || String(obj.createdById||"")===me;
    if(!canEditReport && obj.id){
      alert("Bạn không có quyền cập nhật báo cáo này.");
      return;
    }

    if(manager){
      obj.type=String(repType.value||"").trim();
      obj.name=String(repName.value||"").trim();
      obj.deadline=fromDatetimeLocalValue(repDeadline.value);
      obj.leadId=String(repLead.value||"").trim();
      obj.collaborators=uniq(readCollabPick().filter(id=>id!==String(obj.leadId)));
    }
    obj.note=String(repNote.value||"");

    if(manager){
      if(!obj.type || !obj.name || !obj.deadline || !obj.leadId){
        alert("Vui lòng nhập đủ: Loại báo cáo, Tên báo cáo, Deadline, CB đầu mối.");
        return;
      }
    }

    obj.parts=obj.parts||{};
    (obj.collaborators||[]).forEach(id=>{
      if(!obj.parts[String(id)]) obj.parts[String(id)]={status:"Pending",updatedAt:""};
    });
    for(const k of Object.keys(obj.parts)){
      if(!(obj.collaborators||[]).map(String).includes(String(k))) delete obj.parts[k];
    }

    const next=String(repStatus.value||obj.status||"");
    if(next==="Hoàn thành" && !(manager)){
      if(!allCollabsDone(obj)){
        alert("Chưa thể Hoàn thành: còn CB phối hợp chưa 'Đã hoàn thành'.");
        return;
      }
      obj.status="Hoàn thành";
    }else if(manager || String(obj.leadId||"")===me){
      obj.status=next;
    }

    if(!obj.id){
      const maxId=Math.max(0,...(state.reports||[]).map(r=>Number(r.id)||0));
      obj.id=String(maxId+1);
      obj.createdById=me;
    }

    try{
      await persistReport(obj);
      closeModals();
      renderReports();
      mark(true, "supabase • báo cáo đã lưu");
    }catch(e){
      console.error(e);
      mark(false, "lỗi lưu báo cáo");
      alert("Lưu báo cáo thất bại. Kiểm tra quyền bảng reports trên Supabase rồi thử lại.");
    }
  }
// ---- View switch ----
  function setView(name){
    state.view=name;
    if(tabDashboard) tabDashboard.classList.toggle("active", name==="dashboard");
    tabTasks.classList.toggle("active", name==="tasks");
    tabForecast.classList.toggle("active", name==="forecast");
    if(tabReports) tabReports.classList.toggle("active", name==="reports");

    if(viewDashboard) viewDashboard.style.display = name==="dashboard" ? "" : "none";
    viewTasks.style.display = name==="tasks" ? "" : "none";
    viewForecast.style.display = name==="forecast" ? "" : "none";
    if(viewReports) viewReports.style.display = name==="reports" ? "" : "none";

    const isRep = name==="reports";
    const isDash = name==="dashboard";
    if(btnAdd){
      btnAdd.textContent = isRep ? "+ Thêm báo cáo" : "+ Thêm việc";
      btnAdd.disabled = false;
      btnAdd.style.display = isDash ? "none" : "";
      btnAdd.title = isRep ? (isManager(state.meId) ? "Giao báo cáo" : "Chỉ quản lý mới giao báo cáo.") : "Thêm công việc";
    }
    if(btnAddFab){
      btnAddFab.textContent = isRep ? "+" : "+";
      const showFab = window.matchMedia("(max-width: 720px)").matches && !isDash;
      btnAddFab.style.display = showFab ? "flex" : "none";
      btnAddFab.title = isRep ? "Thêm báo cáo" : "Thêm việc";
    }
    if(btnDashPdf){
      btnDashPdf.style.display = name==="dashboard" ? "" : "none";
    }
    if(btnAdd && window.matchMedia("(max-width: 720px)").matches){
      btnAdd.style.display = name==="dashboard" ? "none" : "";
    } else if(btnAdd){
      btnAdd.style.display = "";
    }
    render();
  }

  function render(){
    refreshDropdowns();
    if(state.view==="dashboard") renderDashboard();
    if(state.view==="tasks") renderTasks();
    if(state.view==="forecast") renderForecastCards();
    if(state.view==="reports") renderReports();
  }

  
  // ---- Add button shim (fix ReferenceError: safeOpenAdd is not defined) ----
  // Some previous builds had scope issues; keep this shim in the same scope as wire().
  function safeOpenAdd(){
    try{
      if(state.view==="dashboard") return openTask(null);
      if(state.view==="reports"){
        if(!state.meId) return alert("Bạn cần chọn ô \"Tôi là\" (Võ Tuấn Anh) để giao báo cáo.");
        if(!isManager(state.meId)) return alert("Chỉ quản lý mới giao báo cáo.");
        return openReport(null);
      }
      return openTask(null);
    }catch(err){
      console.error(err);
      alert("Lỗi mở form: " + (err?.message || err));
    }
  }

// ---- Event wiring ----
  function wire(){
    if(tabDashboard) tabDashboard.onclick=()=>setView("dashboard");
    tabTasks.onclick=()=>setView("tasks");
    tabForecast.onclick=()=>setView("forecast");
    if(tabReports) tabReports.onclick=()=>setView("reports");

    elWeek.onchange=()=>{
      state.week = pickWeekStartISO(elWeek.value);
      elWeek.value = state.week;
      updateWeekPickerDisplay();
      syncAll();
    };

    elMe.onchange=()=>{
      state.meId = elMe.value;
      // default forecast filter to self for non-managers
      if(!isManager(state.meId)) state.fcStaff = state.meId;
      else if(String(state.fcStaff||"")===String(state.meId||"")) state.fcStaff = "";
      if(!document.body.classList.contains("modal-open")) render();
    };

    filterAssignee.onchange=()=>{ state.filterAssignee=filterAssignee.value; renderTasks(); };
    filterStatus.onchange=()=>{ state.filterStatus=filterStatus.value; renderTasks(); };
    filterGroup.onchange=()=>{ state.filterGroup=filterGroup.value; renderTasks(); };
    filterOverdue.onchange=()=>{ state.onlyOverdue=!!filterOverdue.checked; renderTasks(); };
    btnClear.onclick=()=>{ state.filterAssignee=""; state.filterStatus=""; state.filterGroup=""; state.onlyOverdue=false; clearDashboardTaskDrill(); filterOverdue.checked=false; render(); };

    btnAdd.onclick=()=>safeOpenAdd();
    if(btnAddFab) btnAddFab.onclick=()=>safeOpenAdd();
    btnExport.onclick=()=>exportWeekly();
    if(btnDashPdf) btnDashPdf.onclick=()=>exportDashboardPdf();
    btnLists.onclick=()=>openLists();

    // Safety: delegate click in case header button is overlaid / re-rendered
    document.addEventListener("click",(e)=>{
      const add=e.target.closest("#btnAdd");
      if(add){ e.preventDefault(); safeOpenAdd(); }
    }, {passive:false});

    taskClose.onclick=closeModals;
    btnCancel.onclick=closeModals;
    taskBackdrop.onclick=(e)=>{ if(e.target===taskBackdrop) closeModals(); };

    listsClose.onclick=closeModals;
    btnListsCancel.onclick=closeModals;
    listsBackdrop.onclick=(e)=>{ if(e.target===listsBackdrop) closeModals(); };

    document.addEventListener("keydown",(e)=>{ if(e.key==="Escape") closeModals(); });

    taskForm.addEventListener("submit", saveTask);


    const dashTaskCompareChart = document.getElementById("dashTaskCompareChart");
    if(dashTaskCompareChart){
      dashTaskCompareChart.addEventListener("click",(e)=>{
        const hot=(e.target && e.target.closest) ? e.target.closest("[data-dash-task]") : null;
        if(!hot) return;
        const staffId=hot.getAttribute("data-staff") || "";
        const mode=hot.getAttribute("data-mode") || "";
        if(staffId && mode) openTasksFromDashboard(staffId, mode);
      });
    }

    const dashReportCompareChart = document.getElementById("dashReportCompareChart");
    if(dashReportCompareChart){
      dashReportCompareChart.addEventListener("click",(e)=>{
        const hot=(e.target && e.target.closest) ? e.target.closest("[data-dash-report]") : null;
        if(!hot) return;
        const staffId=hot.getAttribute("data-staff") || "";
        const mode=hot.getAttribute("data-mode") || "";
        if(staffId && mode) openReportsFromDashboard(staffId, mode);
      });
    }

    tbody.addEventListener("click",(e)=>{
      const btn=e.target.closest("button"); if(!btn) return;
      const act=btn.dataset.act, id=btn.dataset.id;
      if(act==="edit") {
        const t=state.tasks.find(x=>x.id===id);
        if(!t) return;
        if(!canEditTask(t)){
          alert("Bạn không có quyền sửa việc này.");
          return;
        }
        safeOpenTask(t);
      }
      if(act==="del"){ if(confirm("Xoá công việc này?")) delTask(id); }
    });

    const taskHeaderMap = {"ID":"seq","Nhóm công việc":"group","Công việc / Hoạt động":"title","Deadline":"deadline","CB đầu mối":"ownerName","Trạng thái":"status","Kết quả / Ghi chú":"note"};
    document.querySelectorAll("#viewTasks thead th").forEach(th=>{
      const label=String(th.textContent||"").trim();
      const field=th.dataset.sort || taskHeaderMap[label];
      if(!field) return;
      th.dataset.sort = field;
      th.style.cursor = "pointer";
      th.title = "Bấm để sắp xếp";
      th.onclick=()=>{
        if(state.sortField===field) state.sortDir = state.sortDir==="asc" ? "desc" : "asc";
        else { state.sortField=field; state.sortDir="asc"; }
        renderTasks();
      };
    });

    const repHeaderMap = {"ID":"id","Loại báo cáo":"type","Báo cáo":"name","Deadline":"deadline","Đầu mối":"lead","Tiến độ phối hợp":"progress","Trạng thái":"status"};
    document.querySelectorAll("#viewReports thead th").forEach(th=>{
      const label=String(th.textContent||"").trim();
      const field=th.dataset.sort || repHeaderMap[label];
      if(!field) return;
      th.dataset.sort = field;
      th.style.cursor = "pointer";
      th.title = "Bấm để sắp xếp";
      th.onclick=()=>{
        if(state.repSortField===field) state.repSortDir = state.repSortDir==="asc" ? "desc" : "asc";
        else { state.repSortField=field; state.repSortDir="asc"; }
        renderReports();
      };
    });

    $$(".tabs [data-listtab]").forEach(btn=>btn.addEventListener("click",()=>setListTab(btn.dataset.listtab)));
    btnAddStaff.onclick=()=>staffList.appendChild(mkStaffRow({}));
    btnAddStatus.onclick=()=>statusList.appendChild(mkRow1(""));
    btnAddGroup.onclick=()=>groupList.appendChild(mkRow1(""));
    btnAddPriority.onclick=()=>priorityList.appendChild(mkRow1(""));
    btnAddKpi.onclick=()=>kpiList.appendChild(mkRow1(""));
    btnAddMetric.onclick=()=>metricList.appendChild(mkRow1(""));

    if(btnAddFcKpi && fcKpiList){
      btnAddFcKpi.onclick=()=>{
        const key=genFcKpiKey();
        fcKpiList.appendChild(mkRowFcKpi({key, name:"", unit:"", kind:"4col"}));
      };
    }
    btnListsSave.onclick=async()=>{ await saveLists(); closeModals(); };

    // Forecast (filters / admin / import)
    fcStaffFilter.onchange=()=>{ state.fcStaff = fcStaffFilter.value; renderForecastCards(); };
    fcMetricFilter.onchange=()=>{ state.fcMetric = fcMetricFilter.value; renderForecastCards(); };

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

    // Forecast modal events (MUST prevent default submit to avoid page reload)
    if(fcForm){
      fcForm.addEventListener("submit",(e)=>{ e.preventDefault(); saveForecastModal(); });
    }
    if(fcClose) fcClose.onclick=closeModals;
    if(fcCancel) fcCancel.onclick=closeModals;
    if(fcBackdrop) fcBackdrop.onclick=(e)=>{ if(e.target===fcBackdrop) closeModals(); };

    // Update chips live while typing
    [fcActual, fcWeekPlan, fcQuarterPlan].forEach(inp=>{
      if(!inp) return;
      inp.addEventListener("input", ()=>{
        const meta=metricMetaByKey(fcMetricKey.value);
        updateFcModalChips(meta.kind);
      });
    });

    // Forecast: delegated open (fallback) for KPI rows and badges
    fcCards.addEventListener("click",(e)=>{
      const t = e.target && e.target.nodeType===3 ? e.target.parentElement : e.target;
      if(!t || !t.closest) return;

      const row = t.closest("[data-fc-staff][data-fc-metric]");
      if(row){
        const staffId=row.getAttribute("data-fc-staff");
        const metricKey=row.getAttribute("data-fc-metric");
        if(staffId && metricKey) window.__fcOpen(staffId, metricKey);
        return;
      }

      const badge = t.closest("[data-fc-badge]");
      if(badge){
        const staffId=badge.getAttribute("data-staff");
        if(staffId) window.__fcBadge(staffId);
      }
    });



    // Reports filters
    if(repFilterLead){
      repFilterLead.onchange=()=>{ state.repFilterLead=repFilterLead.value; renderReports(); };
      repFilterType.onchange=()=>{ state.repFilterType=repFilterType.value; renderReports(); };
      repFilterStatus.onchange=()=>{ state.repFilterStatus=repFilterStatus.value; renderReports(); };
      repOnlyMine.onchange=()=>{ state.repOnlyMine=repOnlyMine.checked; renderReports(); };
      repOnlyDueSoon.onchange=()=>{ state.repOnlyDueSoon=repOnlyDueSoon.checked; renderReports(); };

      btnRepClear.onclick=()=>{
        state.repFilterLead=""; state.repFilterType=""; state.repFilterStatus="";
        state.repOnlyMine=false; state.repOnlyDueSoon=false; clearDashboardReportDrill();
        repFilterLead.value=""; repFilterType.value=""; repFilterStatus.value="";
        repOnlyMine.checked=false; repOnlyDueSoon.checked=false;
        renderReports();
      };

      btnRepAdd.onclick=()=>{
        if(!state.meId) return alert("Bạn cần chọn ô \"Tôi là\" (Võ Tuấn Anh) để giao báo cáo.");
        if(!isManager(state.meId)) return alert("Chỉ quản lý mới giao báo cáo.");
        openReport(null);
      };

      repTbody.addEventListener("click",(e)=>{
        const b=e.target.closest("button[data-rep]");
        if(!b) return;
        const id=b.getAttribute("data-id");
        const act=b.getAttribute("data-rep");
        const rep=(state.reports||[]).find(r=>String(r.id)===String(id));
        if(act==="open" && rep) openReport(rep);
        if(act==="del"){
          if(!isManager(state.meId)) return;
          if(!confirm("Xoá báo cáo này?")) return;
          state.reports=(state.reports||[]).filter(r=>String(r.id)!==String(id));
          saveJSON("KHT_REPORTS", state.reports);
          const s=getSettings();
          if(String(s.storageMode||"local")==="supabase"){
            fetch(sbUrl(`reports?id=eq.${encodeURIComponent(id)}`), {method:"DELETE", headers:sbHeaders()}).catch(console.error);
          }
          renderReports();
        }
      });

      // Report modal events
      repClose.onclick=closeModals;
      repCancel.onclick=closeModals;
      repBackdrop.onclick=(e)=>{ if(e.target===repBackdrop) closeModals(); };
      repForm.addEventListener("submit",(e)=>{ e.preventDefault(); saveReport(); });
    }

    // Danh mục: báo cáo
    if(btnAddRepType && repTypeList) btnAddRepType.onclick=()=>repTypeList.appendChild(mkRow1(""));
    if(btnAddRepStatus && repStatusList) btnAddRepStatus.onclick=()=>repStatusList.appendChild(mkRow1(""));
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
    window.addEventListener("resize", ()=>{ apply(); setView(state.view||"dashboard"); });
    apply();
  }

  function init(){
    elWeek.value = state.week;
    updateWeekPickerDisplay();
    refreshDropdowns();
    setupTimer();
    wire();
    setView(state.view || "dashboard");
    syncAll();
  }

  init();
})();
