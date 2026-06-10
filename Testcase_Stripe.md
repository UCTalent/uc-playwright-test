# Testcase: Tích hợp Thanh toán Stripe (Stripe Payment Integration)
**Module:** Thanh toán & Nâng cấp tài khoản
**Mục tiêu:** Đảm bảo luồng thanh toán qua cổng Stripe hoạt động ổn định, xử lý đúng các trường hợp thành công và thất bại.

---

## 🛠 Điều kiện tiền đề (Pre-conditions)
1. User đã đăng nhập vào hệ thống UCTalent.
2. User đang ở trang `Pricing/Upgrade Plan` (Gói Nâng Cấp).
3. Hệ thống đang kết nối với môi trường Stripe Test (Sử dụng các thẻ test của Stripe).

---

## 📝 Danh sách Test cases

### TC01: Thanh toán thành công với thẻ hợp lệ (Visa/Mastercard)
* **Các bước thực hiện:**
  1. Truy cập vào trang `Upgrade Plan`.
  2. Chọn gói "Premium" và bấm nút `Upgrade Now`.
  3. Màn hình chuyển hướng sang Stripe Checkout Form.
  4. Nhập thông tin thẻ test hợp lệ (Ví dụ: Số thẻ `4242 4242 4242 4242`, Ngày hết hạn tương lai, CVC `123`).
  5. Bấm nút `Pay`.
* **Kết quả mong đợi:**
  1. Stripe hiển thị thông báo thanh toán thành công.
  2. Tự động chuyển hướng (redirect) về lại trang UCTalent với thông báo "Nâng cấp tài khoản thành công".
  3. Trong Dashboard của User, badge "Premium" xuất hiện.
  4. (Backend check): Database cập nhật trạng thái gói cước của User thành `ACTIVE`.

### TC02: Thanh toán thất bại do thẻ bị từ chối (Card Declined)
* **Các bước thực hiện:**
  1. Chọn gói và đi đến Stripe Checkout Form.
  2. Nhập thông tin thẻ test bị từ chối (Ví dụ: Thẻ báo lỗi Decline `4000 0000 0000 0002`).
  3. Bấm nút `Pay`.
* **Kết quả mong đợi:**
  1. Form Stripe báo lỗi chữ đỏ: "Your card was declined."
  2. Không chuyển hướng về trang thành công.
  3. Tài khoản của User trên hệ thống giữ nguyên gói Free hiện tại.

### TC03: Hủy thanh toán giữa chừng (User Cancels Checkout)
* **Các bước thực hiện:**
  1. Chọn gói và đi đến Stripe Checkout Form.
  2. Tại màn hình Stripe, bấm nút Back của trình duyệt hoặc bấm nút "Hủy và quay lại UCTalent".
* **Kết quả mong đợi:**
  1. Chuyển hướng về lại trang Pricing của UCTalent.
  2. Hiển thị thông báo (toast): "Thanh toán đã bị hủy".
  3. Tài khoản không bị trừ tiền, không được nâng cấp.

---
*(Ghi chú: File này dùng làm Prompt đầu vào để nhờ AI Antigravity tự động sinh code Playwright (file `stripe-payment.spec.ts`) dựa trên cấu trúc POM có sẵn trong dự án).*
