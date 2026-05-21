# Học từ vựng cùng bé Bút Bi

App dùng 3 nền tảng:
- GitHub: lưu source code
- Supabase: đăng nhập + database, dữ liệu không mất khi đổi thiết bị
- Vercel: deploy web app

## 1. Supabase
1. Tạo project Supabase.
2. Vào Authentication > Providers > bật Email.
3. Vào SQL Editor, chạy toàn bộ file `supabase-schema.sql`.
4. Vào Project Settings > API, copy:
   - Project URL
   - anon public key

## 2. Gắn key vào app
Mở `app.js`, sửa 2 dòng đầu:

```js
const SUPABASE_URL = "DAN_PROJECT_URL_VAO_DAY";
const SUPABASE_ANON_KEY = "DAN_ANON_PUBLIC_KEY_VAO_DAY";
```

## 3. GitHub
Upload toàn bộ folder này lên GitHub repository.

## 4. Vercel
1. Vercel > Add New Project > Import GitHub repo.
2. Framework Preset: Other.
3. Build Command: để trống.
4. Output Directory: để trống hoặc `.`.
5. Deploy.

## 5. Dùng app
- Tạo tài khoản bằng email + mật khẩu.
- Tạo folder.
- Thêm từ vựng, nghĩa, câu ví dụ.
- App tự lấy phiên âm qua dictionaryapi.dev nếu có.
- Nút loa dùng giọng đọc của trình duyệt.
