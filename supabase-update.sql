-- Chạy trong Supabase SQL Editor nếu app cũ của bạn chưa có 2 cột này
alter table public.words add column if not exists emoji text default '🌸';
alter table public.words add column if not exists example_vi text default '';
