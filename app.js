// ===============================
// PGD ĐƯỜNG 9 TASK SYSTEM
// app.js (supabase sync version)
// ===============================

const SUPABASE_URL = window.SUPABASE_URL || '';
const SUPABASE_KEY = window.SUPABASE_KEY || '';

let supabase = null;
if (SUPABASE_URL && SUPABASE_KEY) {
  supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
}

// ===============================
// GLOBAL STATE
// ===============================

let staffDirectory = [];
let reports = [];
let tasks = [];

let reportTypes = [];
let reportStatuses = [];
let statuses = [];
let groups = [];
let priorities = [];

let forecastMetrics = [];

let currentStaffId = null;
let isManager = false;

// ===============================
// STORAGE MODE
// ===============================

function getStorageMode() {
  return localStorage.getItem("storage_mode") || "supabase";
}

// ===============================
// LOAD APP
// ===============================

async function loadAllData() {
  const mode = getStorageMode();

  if (mode === "supabase") {
    await loadStaffDirectoryFromSupabase();
    await loadReportsFromSupabase();
    await loadTasksFromSupabase();
    await loadSettingsFromSupabase();
  } else {
    loadLocalData();
  }

  renderAll();
}

// ===============================
// STAFF DIRECTORY
// ===============================

async function loadStaffDirectoryFromSupabase() {
  const { data, error } = await supabase
    .from("staff_directory")
    .select("*")
    .order("staff_name");

  if (error) {
    console.error("staff load error", error);
    return;
  }

  staffDirectory = data || [];
}

async function saveStaffDirectory(rows) {

  if (getStorageMode() !== "supabase") {
    localStorage.setItem("staff_directory", JSON.stringify(rows));
    return;
  }

  const { error } = await supabase
    .from("staff_directory")
    .upsert(rows, { onConflict: "staff_id" });

  if (error) {
    console.error("staff save error", error);
  }

  await loadStaffDirectoryFromSupabase();
  renderStaffDirectory();
}
// ===============================
// SETTINGS / CATALOG
// ===============================

async function loadSettingsFromSupabase() {

  const { data, error } = await supabase
    .from("app_settings")
    .select("*");

  if (error) {
    console.error("settings load error", error);
    return;
  }

  const rows = data || [];

  reportTypes = rows
    .filter(r => r.setting_type === "report_type")
    .map(r => r.setting_label);

  reportStatuses = rows
    .filter(r => r.setting_type === "report_status")
    .map(r => r.setting_label);

  statuses = rows
    .filter(r => r.setting_type === "task_status")
    .map(r => r.setting_label);

  groups = rows
    .filter(r => r.setting_type === "work_group")
    .map(r => r.setting_label);

  priorities = rows
    .filter(r => r.setting_type === "priority")
    .map(r => r.setting_label);

  forecastMetrics = rows
    .filter(r => r.setting_type === "forecast_metric")
    .map(r => r.setting_label);
}

async function saveSettingList(type, values) {

  if (getStorageMode() !== "supabase") {
    localStorage.setItem(type, JSON.stringify(values));
    return;
  }

  await supabase
    .from("app_settings")
    .delete()
    .eq("setting_type", type);

  const payload = values.map((v, idx) => ({
    setting_type: type,
    setting_key: v,
    setting_label: v,
    sort_order: idx + 1,
    is_active: true
  }));

  if (payload.length) {
    await supabase
      .from("app_settings")
      .insert(payload);
  }

  await loadSettingsFromSupabase();
  renderDropdownCatalogs();
}
// ===============================
// REPORTS
// ===============================

async function loadReportsFromSupabase() {

  const { data, error } = await supabase
    .from("reports")
    .select("*")
    .order("deadline");

  if (error) {
    console.error("reports load error", error);
    return;
  }

  reports = data || [];
}

async function saveReport(report) {

  const { error } = await supabase
    .from("reports")
    .upsert(report);

  if (error) {
    console.error("report save error", error);
  }

  await loadReportsFromSupabase();
  renderReports();
}

// ===============================
// REPORT PERMISSION
// ===============================

function getReportRole(report) {

  if (isManager) return "manager";

  if (report.lead_id === currentStaffId)
    return "lead";

  if (
    Array.isArray(report.collaborators) &&
    report.collaborators.includes(currentStaffId)
  )
    return "collab";

  return "viewer";
}
// ===============================
// TASKS
// ===============================

async function loadTasksFromSupabase() {

  const { data, error } = await supabase
    .from("tasks")
    .select("*")
    .order("deadline");

  if (error) {
    console.error("tasks load error", error);
    return;
  }

  tasks = data || [];
}

async function saveTask(task) {

  const { error } = await supabase
    .from("tasks")
    .upsert(task);

  if (error) {
    console.error("task save error", error);
  }

  await loadTasksFromSupabase();
  renderTasks();
}

// ===============================
// RENDER
// ===============================

function renderAll() {
  renderStaffDirectory();
  renderReports();
  renderTasks();
}

function renderStaffDirectory() {
  console.log("render staff", staffDirectory.length);
}

function renderReports() {
  console.log("render reports", reports.length);
}

function renderTasks() {
  console.log("render tasks", tasks.length);
}

function renderDropdownCatalogs() {
  console.log("catalog updated");
}

// ===============================
// START
// ===============================

document.addEventListener("DOMContentLoaded", () => {
  loadAllData();
});
