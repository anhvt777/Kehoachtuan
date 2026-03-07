// Kehoachtuan CONFIG v6.1.0
window.CONFIG = {
  // StaffIDs that are allowed to import & edit 'Đã thực hiện' and 'KH Quý'
  managerIds: ["54000601"],

  // Optional unit name shown in exported forecast (row tổng)
  forecastUnitName: "154-PGD DUONG 9",

  staff: [
  {
    "id": "54000601",
    "name": "VO TUAN ANH"
  },
  {
    "id": "54000602",
    "name": "NGUYEN THUY DUNG"
  },
  {
    "id": "54000604",
    "name": "HOANG TRUONG AN"
  },
  {
    "id": "54015402",
    "name": "LE THI NGOC TRANG"
  },
  {
    "id": "54015403",
    "name": "TRAN NAM ANH"
  },
  {
    "id": "54015405",
    "name": "NGUYEN MAI DUNG"
  },
  {
    "id": "54000600",
    "name": "ALL"
  }
],

  groups: [
    "Chăm sóc KH hiện hữu",
    "Tìm kiếm KH mới / Leads",
    "Gọi điện (Call)",
    "Hẹn gặp / Tư vấn trực tiếp",
    "Chuẩn bị & nộp hồ sơ",
    "Thẩm định / phối hợp phê duyệt",
    "Giải ngân / hoàn thiện thủ tục",
    "Thu hồi nợ / nhắc nợ",
    "Bán chéo BIC/MetLife",
    "Thẻ tín dụng",
    "SmartBanking / eKYC",
    "QR Hộ kinh doanh",
    "TK KHDN / DVTT",
    "Khác"
  ],

  statuses: ["Not started","Doing","Done","Blocked"],
  priorities: ["A","B","C"],

  kpis: ["HDV cuối kỳ","Dư nợ cuối kỳ","TK HKD","Thẻ TD","Hoa hồng bảo hiểm","SmartBanking"],
  outputMetrics: ["Call","Meet","Proposal","Hồ sơ","Khách hàng","Giao dịch","Khác"],

  // Forecast metrics (the same structure as your Excel sample)
  forecastMetrics: [
    { key:"HDV_CUOI_KY", name:"HDV CUỐI KỲ", unit:"Tỷ đồng", kind:"5col" },
    { key:"DU_NO_CUOI_KY", name:"DƯ NỢ CUỐI KỲ", unit:"Tỷ đồng", kind:"5col" },
    { key:"TK_HKD", name:"TK HKD", unit:"TK", kind:"4col" },
    { key:"THE_TD", name:"Thẻ TD", unit:"Thẻ", kind:"4col" },
    { key:"HH_BAO_HIEM", name:"Hoa hồng bảo hiểm", unit:"Tỷ đồng", kind:"4col" },
    { key:"SMARTBANKING", name:"SMARTBANKING", unit:"", kind:"4col" }
  ]
};
