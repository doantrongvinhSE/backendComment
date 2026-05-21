# Thiết kế maintain export Excel đơn hàng

## Mục tiêu

Maintain phần xuất Excel đơn hàng để code dễ bảo trì hơn, endpoint chạy đúng, và có test bảo vệ hành vi chính.

## Phạm vi

- Tạo endpoint tải file Excel cho đơn hàng của user hiện tại.
- Tách logic tạo Excel khỏi controller.
- Dùng template hiện có `src/utils/file/lendon.upos.xlsx`.
- Thêm test API cho luồng export.

Không mở rộng sang nhiều loại báo cáo hoặc thay đổi format Excel ngoài các cột đang được điền hiện tại.

## Thiết kế

### Route

Thêm route `GET /me/orders/export/excel` trong `src/routes/orderRoutes.js` và đặt trước `/:orderId` để tránh Express hiểu `export` là `orderId`.

### Controller

`orderController.exportOrdersExcel` chỉ làm nhiệm vụ:

- Gọi service export với `req.user.id`.
- Set header tải file `.xlsx`.
- Gửi buffer hoặc stream workbook về response.
- Chuyển lỗi cho middleware qua `next(error)` thay vì tự trả JSON 500 rời rạc.

### Service và helper Excel

`orderService` có hàm lấy toàn bộ orders thuộc user hiện tại để export, sắp xếp mới nhất trước, không phân trang.

Logic Excel được tách sang helper riêng, ví dụ `src/utils/orderExcelExport.js`, gồm:

- Đọc template Excel.
- Tìm sheet `Đơn hàng`, fallback sheet đầu tiên nếu cần.
- Xóa các dòng dữ liệu từ dòng 6.
- Điền từng order vào các cột hiện có: B khách hàng, C số điện thoại, D địa chỉ, H sản phẩm, J tiền/ghi chú theo logic hiện tại, K/O số lượng mặc định, Q ghi chú giao hàng cố định.
- Trả workbook/buffer để controller gửi về client.

## Xử lý lỗi

Nếu thiếu template hoặc không tìm được sheet hợp lệ, helper ném lỗi rõ nghĩa. Controller để middleware xử lý lỗi chung.

## Test

Bổ sung test trong `src/orders-api.test.js`:

- Endpoint export yêu cầu đăng nhập.
- Endpoint trả header file Excel đúng.
- Endpoint không xuất đơn của user khác.
- Nếu parse được workbook bằng `exceljs`, kiểm tra dữ liệu order nằm trong sheet; nếu dependency/test environment chưa thuận lợi, kiểm header và binary response ở mức tối thiểu.

## Phụ thuộc

Dự án đang dùng `exceljs` trong code nhưng `package.json` chưa khai báo. Cần thêm `exceljs` vào dependencies nếu chưa có trong `package-lock.json` hoặc cài đặt hiện tại.
