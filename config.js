// Cấu hình mặc định. Bạn có thể chỉnh tại đây hoặc vào mục 'Danh mục' trên giao diện.
window.APP_CONFIG = {
  storage: {
    mode: "local", // "local" | "supabase"
    supabaseUrl: "",
    supabaseAnonKey: ""
  },
  statuses: ["Not started", "Doing", "Blocked", "Done"],
  priorities: ["A", "B", "C"],
  kpis: ["Du no cuoi ky", "Huy dong von cuoi ky", "The tin dung", "Smartbanking", "QR ho kinh doanh", "Hoa hong BIC", "Hoa hong Metlife", "San pham dau tu", "Don vi luong", "TK KHDN"],
  groups: ["1. Xu ly no xau, no tiem an", "2. Tiep can TT y te", "3. TT hanh chinh cong / dich vu cong", "4. Mo rong nen KH luong", "Khac"],
  metrics: ["Call", "Meet", "Proposal", "Ho so", "Khach hang", "Giao dich", "Khac"],
  staff: [{"id": "54000601", "name": "VO TUAN ANH"}, {"id": "54000602", "name": "NGUYEN THUY DUNG"}, {"id": "54000604", "name": "HOANG TRUONG AN"}, {"id": "54015402", "name": "LE THI NGOC TRANG"}, {"id": "54015403", "name": "TRAN NAM ANH"}, {"id": "54015405", "name": "NGUYEN MAI DUNG"}, {"id": "54000000", "name": "ALL"}]
};
