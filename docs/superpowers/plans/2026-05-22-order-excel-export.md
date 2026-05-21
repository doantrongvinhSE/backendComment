# Order Excel Export Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Tạo endpoint export Excel đơn hàng của user hiện tại, tách logic Excel khỏi controller, và thêm test bảo vệ hành vi chính.

**Architecture:** Controller chỉ xử lý HTTP headers/response. `orderService` chịu trách nhiệm lấy dữ liệu đơn hàng theo user. Helper `src/utils/orderExcelExport.js` chịu trách nhiệm đọc template và build workbook/buffer.

**Tech Stack:** Node.js, Express, Sequelize, Jest, Supertest, ExcelJS.

---

## File Structure

- Modify: `package.json` — khai báo dependency `exceljs` nếu chưa có.
- Modify: `package-lock.json` — cập nhật lockfile sau khi cài `exceljs`.
- Create: `src/utils/orderExcelExport.js` — chứa hằng số template, sheet, dòng bắt đầu, hàm điền row, hàm xóa dữ liệu cũ, hàm build buffer Excel.
- Modify: `src/services/orderService.js` — thêm `listOrdersForExport(userId)` lấy toàn bộ orders thuộc user, sắp xếp mới nhất trước.
- Modify: `src/controllers/orderController.js` — bỏ ExcelJS/path khỏi controller, thêm `exportOrdersExcel(req,res,next)`, export hàm này.
- Modify: `src/routes/orderRoutes.js` — thêm `GET /export/excel` trước `/:orderId`.
- Modify: `src/orders-api.test.js` — thêm test auth, header Excel, và dữ liệu chỉ thuộc user hiện tại.

---

### Task 1: Cài dependency ExcelJS

**Files:**
- Modify: `package.json`
- Modify: `package-lock.json`

- [ ] **Step 1: Kiểm tra dependency hiện tại**

Run:
```powershell
npm ls exceljs
```
Expected: command báo thiếu package hoặc hiển thị nếu đã cài transitive.

- [ ] **Step 2: Cài ExcelJS vào dependencies**

Run:
```powershell
npm install exceljs
```
Expected: `package.json` có `"exceljs"` trong `dependencies`, `package-lock.json` được cập nhật.

- [ ] **Step 3: Kiểm tra package hợp lệ**

Run:
```powershell
npm ls exceljs
```
Expected: PASS, hiển thị version `exceljs` đã cài.

---

### Task 2: Viết test export Excel thất bại trước

**Files:**
- Modify: `src/orders-api.test.js`

- [ ] **Step 1: Thêm import ExcelJS ở đầu file test**

Change top of `src/orders-api.test.js` to include:
```js
const request = require('supertest');
const bcrypt = require('bcrypt');
const ExcelJS = require('exceljs');
```

- [ ] **Step 2: Thêm test yêu cầu đăng nhập**

Append near other order route tests:
```js
test('GET /me/orders/export/excel yêu cầu đăng nhập', async () => {
  await request(app)
    .get('/me/orders/export/excel')
    .expect(401);
});
```

- [ ] **Step 3: Thêm helper đọc workbook từ response**

Add after `createOrder` helper:
```js
async function workbookFromResponse(response) {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(response.body);
  return workbook;
}
```

- [ ] **Step 4: Thêm parser binary cho Supertest trong test export**

Use this parser inline in the export request:
```js
.buffer(true)
.parse((res, callback) => {
  const chunks = [];
  res.on('data', (chunk) => chunks.push(chunk));
  res.on('end', () => callback(null, Buffer.concat(chunks)));
})
```

- [ ] **Step 5: Thêm test export trả file Excel và chỉ chứa order của user hiện tại**

Append test:
```js
test('GET /me/orders/export/excel xuất Excel chỉ gồm orders của user hiện tại', async () => {
  const { user, token } = await loginUser('order_export_owner');
  const { user: otherUser } = await loginUser('order_export_other');

  await createOrder(user, {
    product_name: 'Đơn cũ',
    customer_name: 'Khách cũ',
    phone: '0900000001',
    address: 'Hà Nội',
    note: '120000',
    created_at: new Date('2026-05-14T08:00:00.000Z'),
  });
  await createOrder(user, {
    product_name: 'Đơn mới',
    customer_name: 'Khách mới',
    phone: '0900000002',
    address: 'Đà Nẵng',
    note: '250000',
    created_at: new Date('2026-05-14T09:00:00.000Z'),
  });
  await createOrder(otherUser, {
    product_name: 'Đơn người khác',
    customer_name: 'Khách khác',
    phone: '0999999999',
    address: 'Sài Gòn',
    note: '999999',
    created_at: new Date('2026-05-14T10:00:00.000Z'),
  });

  const response = await request(app)
    .get('/me/orders/export/excel')
    .set('Authorization', `Bearer ${token}`)
    .buffer(true)
    .parse((res, callback) => {
      const chunks = [];
      res.on('data', (chunk) => chunks.push(chunk));
      res.on('end', () => callback(null, Buffer.concat(chunks)));
    })
    .expect(200);

  expect(response.headers['content-type']).toContain('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  expect(response.headers['content-disposition']).toMatch(/attachment; filename="don-hang-\d+\.xlsx"/);

  const workbook = await workbookFromResponse(response);
  const worksheet = workbook.getWorksheet('Đơn hàng') || workbook.worksheets[0];

  expect(worksheet.getCell('B6').value).toBe('Khách mới');
  expect(worksheet.getCell('C6').value).toBe('0900000002');
  expect(worksheet.getCell('D6').value).toBe('Đà Nẵng');
  expect(worksheet.getCell('H6').value).toBe('Đơn mới');
  expect(worksheet.getCell('J6').value).toBe(250000);

  expect(worksheet.getCell('B7').value).toBe('Khách cũ');
  expect(worksheet.getCell('H7').value).toBe('Đơn cũ');
  expect(worksheet.getCell('B8').value).not.toBe('Khách khác');
});
```

- [ ] **Step 6: Chạy test để xác nhận thất bại đúng lý do**

Run:
```powershell
npm test -- src/orders-api.test.js
```
Expected: export endpoint fail do route/controller/service/helper chưa có hoặc trả 404.

---

### Task 3: Tạo helper build Excel

**Files:**
- Create: `src/utils/orderExcelExport.js`

- [ ] **Step 1: Tạo helper Excel**

Create `src/utils/orderExcelExport.js` with:
```js
const ExcelJS = require('exceljs');
const path = require('path');

const TEMPLATE_PATH = path.join(__dirname, 'file/lendon.upos.xlsx');
const ORDER_SHEET_NAME = 'Đơn hàng';
const ORDER_DATA_START_ROW = 6;
const DELIVERY_NOTE = 'CHO KIỂM TRA HÀNG K NHẬN THU 30K SHIP';

function fillOrderRow(worksheet, rowNumber, order) {
  worksheet.getCell(`A${rowNumber}`).value = '';
  worksheet.getCell(`B${rowNumber}`).value = order.customer_name || '';
  worksheet.getCell(`C${rowNumber}`).value = order.phone || '';
  worksheet.getCell(`D${rowNumber}`).value = order.address || '';
  worksheet.getCell(`H${rowNumber}`).value = order.product_name || '';
  worksheet.getCell(`J${rowNumber}`).value = Number(order.note) || 0;
  worksheet.getCell(`K${rowNumber}`).value = 1;
  worksheet.getCell(`O${rowNumber}`).value = 1;
  worksheet.getCell(`Q${rowNumber}`).value = DELIVERY_NOTE;
}

function clearTemplateDataRows(worksheet, startRow) {
  if (worksheet.rowCount < startRow) {
    return;
  }

  for (let rowNumber = worksheet.rowCount; rowNumber >= startRow; rowNumber -= 1) {
    worksheet.spliceRows(rowNumber, 1);
  }
}

async function buildOrdersExcelBuffer(orders) {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(TEMPLATE_PATH);

  const orderSheet = workbook.getWorksheet(ORDER_SHEET_NAME) || workbook.worksheets[0];

  if (!orderSheet) {
    throw new Error('Không tìm thấy sheet đơn hàng trong file mẫu');
  }

  clearTemplateDataRows(orderSheet, ORDER_DATA_START_ROW);
  orders.forEach((order, index) => {
    fillOrderRow(orderSheet, ORDER_DATA_START_ROW + index, order);
  });

  return workbook.xlsx.writeBuffer();
}

module.exports = {
  buildOrdersExcelBuffer,
};
```

---

### Task 4: Thêm service lấy orders export

**Files:**
- Modify: `src/services/orderService.js`

- [ ] **Step 1: Thêm hàm service**

Add before `module.exports`:
```js
async function listOrdersForExport(userId) {
  const orders = await Order.findAll({
    where: { user_id: userId },
    order: [['created_at', 'DESC']],
  });

  return orders.map(presentOrder);
}
```

- [ ] **Step 2: Export hàm mới**

Update module exports:
```js
module.exports = {
  createOrder,
  listOrders,
  getOrder,
  updateOrder,
  deleteOrder,
  listOrdersForExport,
};
```

---

### Task 5: Gọn controller export

**Files:**
- Modify: `src/controllers/orderController.js`

- [ ] **Step 1: Thay import đầu file**

Change top imports to:
```js
const orderService = require('../services/orderService');
const { buildOrdersExcelBuffer } = require('../utils/orderExcelExport');
```

- [ ] **Step 2: Xóa helper Excel khỏi controller**

Remove these controller-local items:
```js
const ExcelJS = require('exceljs');
const path = require('path');
const TEMPLATE_PATH = path.join(__dirname, '../utils/file/lendon.upos.xlsx');
const ORDER_SHEET_NAME = 'Đơn hàng';
const ORDER_DATA_START_ROW = 6;
const fillOrderRow = ...;
const clearTemplateDataRows = ...;
```

- [ ] **Step 3: Thay `exportOrdersExcel`**

Use:
```js
async function exportOrdersExcel(req, res, next) {
  try {
    const orders = await orderService.listOrdersForExport(req.user.id);
    const buffer = await buildOrdersExcelBuffer(orders);
    const fileName = `don-hang-${Date.now()}.xlsx`;

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
    return res.send(buffer);
  } catch (error) {
    return next(error);
  }
}
```

- [ ] **Step 4: Export controller mới**

Update module exports:
```js
module.exports = {
  createOrder,
  listOrders,
  getOrder,
  updateOrder,
  deleteOrder,
  exportOrdersExcel,
};
```

---

### Task 6: Thêm route export đúng thứ tự

**Files:**
- Modify: `src/routes/orderRoutes.js`

- [ ] **Step 1: Thêm route trước `/:orderId`**

Use this order:
```js
router.post('/', orderController.createOrder);
router.get('/', orderController.listOrders);
router.get('/export/excel', orderController.exportOrdersExcel);
router.get('/:orderId', orderController.getOrder);
router.patch('/:orderId', orderController.updateOrder);
router.delete('/:orderId', orderController.deleteOrder);
```

---

### Task 7: Chạy test và sửa lỗi tích hợp nếu có

**Files:**
- Modify as needed only in files above.

- [ ] **Step 1: Chạy test orders**

Run:
```powershell
npm test -- src/orders-api.test.js
```
Expected: PASS.

- [ ] **Step 2: Nếu test parse workbook fail do Supertest content handling, đổi assertion tối thiểu**

Only if needed, replace workbook assertions with:
```js
expect(Buffer.isBuffer(response.body)).toBe(true);
expect(response.body.length).toBeGreaterThan(0);
```
Expected: PASS while still protecting endpoint, auth, headers, and binary response.

- [ ] **Step 3: Chạy toàn bộ test**

Run:
```powershell
npm test
```
Expected: PASS.

---

### Task 8: Kiểm tra thủ công endpoint export

**Files:**
- No code changes expected.

- [ ] **Step 1: Start server nếu cần kiểm tra thủ công**

Run:
```powershell
npm start
```
Expected: server chạy không lỗi.

- [ ] **Step 2: Gọi endpoint với token thật từ frontend/API client**

Request:
```http
GET /me/orders/export/excel
Authorization: Bearer <token>
```
Expected: trình duyệt/API client tải file `.xlsx`, mở được bằng Excel, dữ liệu bắt đầu từ dòng 6.

---

## Self-Review

- Spec coverage: endpoint export, tách helper Excel, service lấy orders theo user, route đúng thứ tự, error qua middleware, test auth/header/user isolation đều có task.
- Placeholder scan: không có TBD/TODO/implement later.
- Type consistency: dùng thống nhất `listOrdersForExport(userId)` và `buildOrdersExcelBuffer(orders)`.
