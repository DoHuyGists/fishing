begin;

create table public.guides (
  id uuid primary key default gen_random_uuid(),
  title text not null check (length(btrim(title)) > 0),
  content text not null check (length(btrim(content)) > 0),
  sort_order integer not null default 0,
  is_published boolean not null default true,
  created_at timestamptz not null default now()
);

alter table public.guides enable row level security;

revoke all on table public.guides from anon, authenticated;
grant select on table public.guides to authenticated;
grant all on table public.guides to service_role;

create policy guides_read_published
  on public.guides for select
  to authenticated
  using (is_published = true);

-- Nội dung là văn bản thuần; xuống dòng được giữ nguyên khi hiển thị.
-- Quản lý nội dung qua Supabase SQL Editor hoặc backend dùng service_role.
insert into public.guides (title, content, sort_order) values
  ('Bắt đầu hành trình', $$Mở Tài khoản để chọn tên, ảnh đại diện và quốc gia.

Bạn có thể mở Hướng dẫn chơi ở sảnh để xem hướng dẫn từng bước.$$ , 10),
  ('Chuẩn bị trang bị', $$Mở Túi đồ và chọn đủ cần, dây, máy, lưỡi và mồi trong một set.

Nếu còn thiếu trang bị, hãy ghé Cửa hàng trước khi vào bãi câu.$$ , 20),
  ('Chọn bãi câu', $$Mở một quốc gia trên bản đồ thế giới và chọn bãi câu.

Kiểm tra trang bị trước khi vào bãi. Một số tính năng cần đạt cấp độ yêu cầu để mở khóa.$$ , 30),
  ('Thả câu và kéo cá', $$Ở bãi câu, chỉnh độ sâu, thả cần và chờ cá cắn.

Làm theo hướng dẫn của thử thách để kéo cá lên.$$ , 40),
  ('Giữ và bán cá', $$Khi về sảnh, mở Lưới cá và chuyển cá muốn giữ vào Kho cá. Cá còn trong lưới sẽ được thả khi bạn chọn Kết thúc.

Trong Kho cá, bạn có thể bán cá hoặc đăng lên Chợ cá. Dùng tiền kiếm được để mua trang bị và nguyên liệu.$$ , 50);

commit;
