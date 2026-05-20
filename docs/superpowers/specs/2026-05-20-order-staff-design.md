# Thiết kế thêm field staff cho orders

## Mục tiêu
Thêm field `staff` cho order để lưu tên nhân sự phụ trách. Field này có thể `null`, mặc định `null`, kiểu chuỗi tối đa 255 ký tự.

## Phạm vi
- Model `Order` có thêm `staff` với `DataTypes.STRING(255)`, `allowNull: true`, `defaultValue: null`.
- API tạo order nhận `staff`; nếu không gửi thì lưu `null`.
- API cập nhật order cho phép đổi `staff`, gồm cả set `null`.
- Response order ở create/list/detail/update trả thêm `staff`.
- Realtime payload `order.created` và `order.updated` có `staff` vì dùng cùng presenter.
- OpenAPI schema `Order` có thêm `staff` nullable.
- Tests cập nhật để cover create/update/response/null default.

## Ngoài phạm vi
- Không thêm `staff` vào search `/me/orders?search=...`.
- Không đổi routes/controller vì đã truyền body/query qua service.
- Không thêm migration trong thiết kế này; test dùng `sequelize.sync`. Nếu database production đã có bảng `orders`, cần thêm cột thủ công hoặc migration riêng.

## Cách kiểm chứng
Chạy test liên quan orders sau khi sửa:
- `npm test -- orders-api.test.js`
- `npm test -- order-model.test.js`
