# Kehoachtuan - Theo dõi & Phân công công việc (GitHub Pages)

## 1) Chạy local (mỗi máy 1 dữ liệu)
- Mặc định `Storage mode = local`
- Dữ liệu lưu trong trình duyệt (localStorage)

## 2) Chạy realtime (nhiều người dùng chung) với Supabase
### Bước A: tạo bảng
- Supabase → SQL Editor → chạy `supabase.sql`

### Bước B: tạm test nhanh
- Table editor → tasks → RLS: **Disable** (tạm thời)

### Bước C: cấu hình trên web (mỗi thiết bị)
- Bấm **Danh mục** → tab **Lưu trữ**
- Storage mode = **supabase**
- Dán Supabase URL + anon key
- Lưu danh mục
- Thêm 1 công việc thử trên điện thoại → máy quản lý sẽ thấy sau vài giây (polling).

## 3) Xuất báo cáo tuần
- Bấm **Xuất báo cáo tuần** → **Xuất Excel/CSV tuần**
- Nếu CDN SheetJS bị chặn, hệ thống sẽ tự xuất CSV.

