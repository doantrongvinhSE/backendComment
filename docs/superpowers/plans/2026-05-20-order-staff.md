# Order Staff Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add nullable `staff` field to orders and expose it through order create/update/list/detail APIs.

**Architecture:** Keep existing orders architecture unchanged: model defines column shape, service owns request field picking and response presentation, controller/routes pass through unchanged. Swagger and tests update to match API contract.

**Tech Stack:** Node.js, Express, Sequelize, Jest, Supertest, OpenAPI 3.0.

---

## File Structure

- Modify `src/models/Order.js`: add Sequelize attribute `staff` as nullable `STRING(255)` with `defaultValue: null`.
- Modify `src/services/orderService.js`: include `staff` in allowed update fields, create payload, response presenter.
- Modify `src/docs/openapi.js`: document `staff` in `Order` schema and realtime order examples.
- Modify `src/order-model.test.js`: verify model default/null behavior for `staff`.
- Modify `src/orders-api.test.js`: verify API create/update responses and realtime payloads include `staff`.

---

### Task 1: Model supports nullable staff

**Files:**
- Modify: `src/models/Order.js:28-40`
- Test: `src/order-model.test.js:28-69`

- [ ] **Step 1: Write failing model tests**

In `src/order-model.test.js`, update helper `createOrder` to pass `staff` when present:

```js
function createOrder(user, data = {}) {
  return Order.create({
    user_id: user.id,
    product_name: data.product_name || 'Áo thun',
    customer_name: data.customer_name || 'Nguyễn Văn A',
    avatar_customer: data.avatar_customer === undefined ? null : data.avatar_customer,
    phone: data.phone || '0900000000',
    address: data.address || 'Hà Nội',
    staff: data.staff === undefined ? undefined : data.staff,
    total_price: data.total_price === undefined ? null : data.total_price,
    status: data.status,
    note: data.note === undefined ? null : data.note,
  });
}
```

Update test `tạo Order riêng thuộc user và mặc định status pending`:

```js
test('tạo Order riêng thuộc user và mặc định status pending', async () => {
  const user = await createUser('order_owner');

  const order = await createOrder(user, { total_price: 150000, staff: 'Nhân viên A' });

  expect(order.user_id).toBe(user.id);
  expect(order.product_name).toBe('Áo thun');
  expect(order.customer_name).toBe('Nguyễn Văn A');
  expect(order.phone).toBe('0900000000');
  expect(order.address).toBe('Hà Nội');
  expect(order.staff).toBe('Nhân viên A');
  expect(order.total_price).toBe(150000);
  expect(order.status).toBe('pending');
});
```

Update nullable test:

```js
test('Order cho phép avatar_customer, staff, total_price và note null', async () => {
  const user = await createUser('order_nullable');

  const order = await createOrder(user);

  expect(order.avatar_customer).toBeNull();
  expect(order.staff).toBeNull();
  expect(order.total_price).toBeNull();
  expect(order.note).toBeNull();
});
```

- [ ] **Step 2: Run model test to verify failure**

Run from `comment-system-backend`:

```bash
npm test -- order-model.test.js
```

Expected: FAIL because `order.staff` is `undefined` or not persisted.

- [ ] **Step 3: Add staff to Order model**

In `src/models/Order.js`, add `staff` after `address`:

```js
  staff: {
    type: DataTypes.STRING(255),
    allowNull: true,
    defaultValue: null,
  },
```

- [ ] **Step 4: Run model test to verify pass**

Run:

```bash
npm test -- order-model.test.js
```

Expected: PASS.

---

### Task 2: Order APIs create/update/respond with staff

**Files:**
- Modify: `src/services/orderService.js:6-84`
- Test: `src/orders-api.test.js:27-325`

- [ ] **Step 1: Write failing API tests**

In `src/orders-api.test.js`, update `orderPayload`:

```js
function orderPayload(overrides = {}) {
  return {
    product_name: 'Áo thun',
    customer_name: 'Nguyễn Văn A',
    avatar_customer: 'https://example.com/avatar.jpg',
    phone: '0900000000',
    address: 'Hà Nội',
    staff: 'Nhân viên A',
    total_price: 150000,
    note: 'Giao buổi sáng',
    ...overrides,
  };
}
```

Update test helper `createOrder`:

```js
async function createOrder(user, overrides = {}) {
  return Order.create({
    user_id: user.id,
    product_name: 'Áo thun',
    customer_name: 'Nguyễn Văn A',
    avatar_customer: null,
    phone: '0900000000',
    address: 'Hà Nội',
    staff: null,
    total_price: 150000,
    status: 'pending',
    note: null,
    ...overrides,
  });
}
```

Update create API expectations:

```js
expect(response.body.data).toMatchObject({
  product_name: 'Áo thun',
  customer_name: 'Nguyễn Văn A',
  avatar_customer: 'https://example.com/avatar.jpg',
  phone: '0900000000',
  address: 'Hà Nội',
  staff: 'Nhân viên A',
  total_price: 150000,
  status: 'pending',
  note: 'Giao buổi sáng',
});
```

Update realtime payload expectation in create test:

```js
order: expect.objectContaining({
  id: response.body.data.id,
  product_name: 'Áo thun',
  customer_name: 'Nguyễn Văn A',
  phone: '0900000000',
  address: 'Hà Nội',
  staff: 'Nhân viên A',
  total_price: 150000,
  status: 'pending',
  note: 'Giao buổi sáng',
}),
```

Update detail test expectation:

```js
expect(response.body.data).toMatchObject({
  id: order.id,
  product_name: 'Đơn chi tiết',
  staff: null,
});
```

Update PATCH test request and expectations:

```js
const response = await request(app)
  .patch(`/me/orders/${order.id}`)
  .set('Authorization', `Bearer ${token}`)
  .send({ status: 'completed', note: 'Đã giao', staff: 'Nhân viên B' })
  .expect(200);

expect(response.body.success).toBe(true);
expect(response.body.data).toMatchObject({
  id: order.id,
  status: 'completed',
  note: 'Đã giao',
  staff: 'Nhân viên B',
});
```

Update realtime payload expectation in PATCH test:

```js
order: expect.objectContaining({
  id: response.body.data.id,
  status: 'completed',
  note: 'Đã giao',
  staff: 'Nhân viên B',
}),
```

- [ ] **Step 2: Run API test to verify failure**

Run from `comment-system-backend`:

```bash
npm test -- orders-api.test.js
```

Expected: FAIL because `staff` is missing from API responses or update payload.

- [ ] **Step 3: Update order service**

In `src/services/orderService.js`, update `ORDER_FIELDS`:

```js
const ORDER_FIELDS = [
  'product_name',
  'customer_name',
  'avatar_customer',
  'phone',
  'address',
  'staff',
  'total_price',
  'status',
  'note',
];
```

Update `presentOrder`:

```js
function presentOrder(order) {
  return {
    id: order.id,
    product_name: order.product_name,
    customer_name: order.customer_name,
    avatar_customer: order.avatar_customer,
    phone: order.phone,
    address: order.address,
    staff: order.staff,
    total_price: order.total_price,
    status: order.status,
    note: order.note,
    created_at: order.created_at,
    updated_at: order.updated_at,
  };
}
```

Update `createOrder` create payload:

```js
  const order = await Order.create({
    user_id: userId,
    product_name: body.product_name,
    customer_name: body.customer_name,
    avatar_customer: body.avatar_customer || null,
    phone: body.phone,
    address: body.address,
    staff: body.staff === undefined ? null : body.staff,
    total_price: body.total_price === undefined ? null : body.total_price,
    status: body.status || 'pending',
    note: body.note || null,
  });
```

Do not change `buildOrderFilters`; search must remain limited to customer, product, phone, address.

- [ ] **Step 4: Run API test to verify pass**

Run:

```bash
npm test -- orders-api.test.js
```

Expected: PASS.

---

### Task 3: OpenAPI documents staff

**Files:**
- Modify: `src/docs/openapi.js:121-135`
- Modify: `src/docs/openapi.js:199-200`

- [ ] **Step 1: Update Order schema**

In `src/docs/openapi.js`, add `staff` after `address` in `components.schemas.Order.properties`:

```js
staff: { type: 'string', nullable: true, example: 'Nhân viên A' },
```

Expected Order properties around that area:

```js
          phone: { type: 'string', example: '0900000000' },
          address: { type: 'string', example: 'Hà Nội' },
          staff: { type: 'string', nullable: true, example: 'Nhân viên A' },
          total_price: { type: 'number', nullable: true, example: 150000 },
```

- [ ] **Step 2: Update realtime examples**

In `src/docs/openapi.js`, update `order.created` and `order.updated` examples:

```js
            'order.created': { payload: { order: { id: 1, product_name: 'Áo thun', customer_name: 'Nguyễn Văn A', phone: '0900000000', address: 'Hà Nội', staff: 'Nhân viên A', total_price: 150000, status: 'pending', note: 'Giao buổi sáng' } } },
            'order.updated': { payload: { order: { id: 1, product_name: 'Áo thun', customer_name: 'Nguyễn Văn A', phone: '0900000000', address: 'Hà Nội', staff: 'Nhân viên B', total_price: 150000, status: 'completed', note: 'Đã giao' } } },
```

- [ ] **Step 3: Run Swagger test**

Run from `comment-system-backend`:

```bash
npm test -- swagger.test.js
```

Expected: PASS.

---

### Task 4: Full verification

**Files:**
- Verify only, no code changes expected.

- [ ] **Step 1: Run focused tests**

Run from `comment-system-backend`:

```bash
npm test -- order-model.test.js orders-api.test.js swagger.test.js
```

Expected: PASS for all matching suites.

- [ ] **Step 2: Run full test suite**

Run from `comment-system-backend`:

```bash
npm test
```

Expected: PASS.

- [ ] **Step 3: Check changed files**

Run from `comment-system-backend`:

```bash
git status --short
```

Expected in git repo: modified `src/models/Order.js`, `src/services/orderService.js`, `src/docs/openapi.js`, `src/order-model.test.js`, `src/orders-api.test.js`, plus plan/spec docs if tracked. If not a git repo, command reports not a git repository.

---

## Self-Review

- Spec coverage: model field, create/update/list/detail response, realtime via presenter, OpenAPI, tests covered. Search unchanged covered by explicit service instruction.
- Placeholder scan: no TBD/TODO/implement later placeholders.
- Type consistency: property name is consistently `staff`; type is Sequelize `DataTypes.STRING(255)` and OpenAPI nullable string.
