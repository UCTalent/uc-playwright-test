# 📋 Playwright E2E Test Report — UCTalent Platform

**Ngày chạy:** 2026-06-04 09:58 (UTC+7)  
**Môi trường:** localhost (FE: 3000, ATS: 3001, BE: 4000)  
**Browser:** Chromium (bundled, `.auth/` user data)  

---

## 📊 Tổng kết

| Metric | Count |
|--------|-------|
| **Tổng test cases** | 30 |
| **✅ Passed** | **6** (20%) |
| **❌ Failed** | **24** (80%) |

---

## ✅ Test Cases Passed (6/30)

1. Admin Portal > TC 14: Admin portal working
2. Homepage & Auth > TC 1: Homepage loads correctly
3. Homepage & Auth > TC 8: Reload Homepage
4. Homepage & Auth > TC 9: Logout/Disconnect Wallet
5. Job Search & Filters > TC 4: Programatic SEO link for tech/skill chips
6. Claim and Reclaim Rewards > TC 36: Reclaim reward for no-hired

*(Đã giải quyết thành công lỗi trang `/jobs` bị crash `ERR_ABORTED` do CORS nhờ việc cấu hình lại biến môi trường `.env` kết nối đúng backend local).*

---

## ❌ Phân tích nguyên nhân 24 Tests bị Failed hiện tại

Sau khi đã sửa các lỗi về môi trường và crash, hiện tại các tests còn lại fail hoàn toàn do 2 nguyên nhân cốt lõi về **Data & Authentication**:

### 1. Thiếu Dữ Liệu (Empty Database)
*VD: TC 2, TC 3, TC 19 (Job Search)*
- Mặc dù trang web tải thành công và gọi đúng API, nhưng database local của bạn chưa có dữ liệu Job nào, hoặc API trả về kết quả rỗng.
- **Biểu hiện:** Playwright chờ tìm kiếm thẻ Job (`a[href*="/jobs/detail/"]`) nhưng không thấy (Element not found) và bị timeout.
- **Cách khắc phục:** Cần chạy file seed dữ liệu cho database (ví dụ: `npm run db:seed` ở backend) để có các dữ liệu job mẫu cho test.

### 2. Thiếu Đăng Nhập (Unauthenticated State)
*VD: Review Jobs, Post Job, Apply Job, Talent Board, Referrals...*
- Các chức năng này yêu cầu người dùng phải đăng nhập bằng ví (Wallet) hoặc Google/Github.
- **Biểu hiện:** Playwright bấm vào các nút (VD: "Apply", "Next", "Pending") nhưng các nút này không hiển thị vì UI bắt người dùng đăng nhập trước.
- Mặc dù trong code có file `login.setup.js` để lưu trạng thái đăng nhập, nhưng hệ thống không thể tự động điền form Google OAuth được do Google chặn bot (lỗi `waitForEvent('page') timeout`). 
- **Cách khắc phục:** 
  1. Bạn cần chạy lệnh `node login.setup.js` thủ công 1 lần. Cửa sổ trình duyệt sẽ hiện lên, bạn đăng nhập tay.
  2. Sau khi trình duyệt đóng, file session sẽ được lưu vào `.auth`.
  3. Lần chạy test tiếp theo, Playwright sẽ dùng session đó và pass qua các bước yêu cầu login.

---

## 🛠️ Các lỗi kỹ thuật tôi đã fix cho bạn:
1. **Lỗi Frontend Crash (`ERR_ABORTED`):** Đã trỏ `NEXT_PUBLIC_URL_API_NESTJS` về `http://localhost:4000/api/v1` thay vì host Dev, giúp fix lỗi CORS.
2. **Lỗi trình duyệt Chrome:** Cấu hình Playwright dùng `chromium` đi kèm thay vì ép dùng system Chrome, giúp tránh lỗi context.
3. **Lỗi Syntax Selector:** Đã sửa cú pháp sai `table, text=History` thành `table.or(text=History)` trong `user-engagement.spec.ts`.
4. **Bật đầy đủ môi trường:** Đã tự động bật Next.js (port 3000), Vite ATS (port 3001) và NestJS (port 4000) ở background.
