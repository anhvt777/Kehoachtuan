# PGD - Theo dõi & Phân công công việc (GitHub Pages)

Website 1 trang, giao diện dạng bảng giống Excel, dùng tốt trên mobile.

## Tính năng chính
- Bảng công việc: **Nhóm công việc / Công việc / Deadline / Trạng thái / CB đầu mối / Kết quả-Ghi chú**
- Dropdown cho: **CB đầu mối, Trạng thái, KPI, Output metric, Priority**
- Tự tô đỏ việc quá hạn
- **CarryOver**: việc tuần trước chưa Done + CarryOver=Y sẽ tự hiện trong tuần hiện tại
- Nút **Xuất báo cáo tuần** (Excel .xlsx): 2 sheet *TASKS_WEEK* và *SUMMARY_BY_STAFF*
- **Danh mục**: thêm/bớt cán bộ, KPI, nhóm việc, trạng thái… → dropdown tự cập nhật
- Import Excel mẫu (layout gần giống file bạn upload) để chuyển dữ liệu từ Excel sang web

---

## Deploy lên GitHub Pages (không cần cài gì)
1. Tạo repo mới trên GitHub, ví dụ: `pgd-task-tracker`
2. Upload toàn bộ file trong thư mục này lên repo (giữ nguyên cấu trúc):
   - `index.html`
   - `assets/`
3. Vào **Settings → Pages**
   - Source: `Deploy from a branch`
   - Branch: `main` / folder: `/ (root)`
4. Mở link Pages: `https://<username>.github.io/pgd-task-tracker/`

---

## Lưu dữ liệu theo 2 chế độ

### 1) `local` (mặc định)
Dữ liệu lưu trong trình duyệt (localStorage). Mỗi máy 1 dữ liệu.
- Phù hợp: dùng 1 máy (trưởng phòng) để tổng hợp
- Có thể backup bằng **Export JSON / Import JSON**

### 2) `supabase` (đề xuất nếu 7 người cùng cập nhật “chung”)
Bạn tạo 1 project Supabase miễn phí, tạo bảng tasks theo file `supabase.sql`, rồi điền:
- Supabase URL
- Supabase anon key
trong màn hình **Danh mục** → Storage mode = `supabase`

> Lưu ý: nếu bật RLS, bạn cần policy phù hợp. Nếu team nội bộ, bạn có thể tạm tắt RLS để chạy nhanh.

---

## Import Excel
Menu cạnh nút “Xuất báo cáo tuần” → **Import Excel mẫu**
- Hệ thống sẽ đọc sheet đầu tiên, theo layout:
  - Cột A: Nhóm công việc (dạng “1. ...”)
  - Cột B: Công việc
  - Cột C: Deadline (15/3 hoặc 15/03/2026)
  - Cột D: Trạng thái/kết quả
  - Cột G: CB đầu mối (VD: `54000604 - HOANG TRUONG AN` hoặc `ALL`)
  - Cột J: Ghi chú

---

## Tuỳ biến giao diện
- Sửa `assets/styles.css`
- Sửa danh mục mặc định trong `assets/config.js`

