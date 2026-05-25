# Ingest Post Blocking Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Thêm trạng thái `is_blocked` cho post chung và mở rộng API ingest không auth để crawler lọc/cập nhật trạng thái này.

**Architecture:** Trạng thái nằm trên model `Post` vì đây là post chung được ingest dùng qua `fb_post_id`. API ingest hiện có tiếp tục là boundary duy nhất: presenter trả thêm field, list nhận query filter, patch nhận thêm field update.

**Tech Stack:** Node.js, Express, Sequelize, Jest, Supertest.

---

## File Structure

- Modify: `src/models/Post.js` — thêm field `is_blocked` boolean mặc định `false` vào schema Sequelize.
- Modify: `src/services/ingestService.js` — presenter trả `is_blocked`, list lọc theo `query.is_blocked`, patch cập nhật `is_blocked` cùng `last_count`.
- Modify: `src/ingest-api.test.js` — thêm test API ingest cho response/filter/update `is_blocked`.
- Modify: `src/post-models.test.js` — thêm test model `Post` có default `is_blocked=false`.

---

### Task 1: Model Post có field is_blocked mặc định false

**Files:**
- Modify: `src/models/Post.js`
- Modify: `src/post-models.test.js`

- [ ] **Step 1: Write the failing model test**

Add this test near existing `Post` model tests in `src/post-models.test.js`:

```js
test('Post có is_blocked mặc định false', async () => {
  const post = await Post.create({ fb_post_id: 'fb_block_default', last_count: 0 });

  expect(post.is_blocked).toBe(false);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
npm test -- src/post-models.test.js --runInBand
```

Expected: FAIL because `post.is_blocked` is `undefined` or the column does not exist.

- [ ] **Step 3: Add the Sequelize field**

In `src/models/Post.js`, add this field after `phone_today` and before `stats_date`:

```js
  is_blocked: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: false,
  },
```

The surrounding model section should become:

```js
  phone_today: {
    type: integerType,
    allowNull: false,
    defaultValue: 0,
  },
  is_blocked: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: false,
  },
  stats_date: {
    type: DataTypes.DATEONLY,
    allowNull: true,
  },
```

- [ ] **Step 4: Run test to verify it passes**

Run:

```bash
npm test -- src/post-models.test.js --runInBand
```

Expected: PASS.

- [ ] **Step 5: Commit**

Only if this directory is a git repository. If not, skip commit and continue.

```bash
git add src/models/Post.js src/post-models.test.js
git commit -m "feat: add blocked flag to posts"
```

---

### Task 2: Ingest list posts trả và lọc theo is_blocked

**Files:**
- Modify: `src/services/ingestService.js`
- Modify: `src/ingest-api.test.js`

- [ ] **Step 1: Write failing tests for list response and filter**

Add these tests after the existing test `GET /ingest/posts trả danh sách post gốc cho crawler` in `src/ingest-api.test.js`:

```js
test('GET /ingest/posts trả is_blocked của post gốc', async () => {
  const post = await Post.create({ fb_post_id: 'fb_blocked_visible', last_count: 3, is_blocked: true });

  const response = await request(app)
    .get('/ingest/posts')
    .expect(200);

  expect(response.body.data.posts[0]).toMatchObject({
    id: post.id,
    fb_post_id: 'fb_blocked_visible',
    last_count: 3,
    is_blocked: true,
  });
});

test('GET /ingest/posts lọc theo is_blocked=true', async () => {
  const blockedPost = await Post.create({ fb_post_id: 'fb_blocked_only', last_count: 1, is_blocked: true });
  await Post.create({ fb_post_id: 'fb_unblocked_hidden', last_count: 2, is_blocked: false });

  const response = await request(app)
    .get('/ingest/posts?is_blocked=true')
    .expect(200);

  expect(response.body.data.posts).toHaveLength(1);
  expect(response.body.data.posts[0]).toMatchObject({
    id: blockedPost.id,
    fb_post_id: 'fb_blocked_only',
    is_blocked: true,
  });
  expect(response.body.pagination.total).toBe(1);
});

test('GET /ingest/posts lọc theo is_blocked=false', async () => {
  await Post.create({ fb_post_id: 'fb_blocked_hidden', last_count: 1, is_blocked: true });
  const unblockedPost = await Post.create({ fb_post_id: 'fb_unblocked_only', last_count: 2, is_blocked: false });

  const response = await request(app)
    .get('/ingest/posts?is_blocked=false')
    .expect(200);

  expect(response.body.data.posts).toHaveLength(1);
  expect(response.body.data.posts[0]).toMatchObject({
    id: unblockedPost.id,
    fb_post_id: 'fb_unblocked_only',
    is_blocked: false,
  });
  expect(response.body.pagination.total).toBe(1);
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run:

```bash
npm test -- src/ingest-api.test.js --runInBand
```

Expected: FAIL because presenter does not return `is_blocked` and query does not filter by it.

- [ ] **Step 3: Update ingest presenter and list query**

In `src/services/ingestService.js`, replace `presentPost` with:

```js
function presentPost(post) {
  return {
    id: post.id,
    fb_post_id: post.fb_post_id,
    last_count: post.last_count,
    is_blocked: post.is_blocked,
    created_at: post.created_at,
    updated_at: post.updated_at,
  };
}
```

Replace `listPostsForIngest` with:

```js
async function listPostsForIngest(query = {}) {
  const offset = Math.max(parseInt(query.offset || '0', 10), 0);
  const limit = Math.max(parseInt(query.limit || '100', 10), 1);
  const where = {};

  if (query.is_blocked === 'true') {
    where.is_blocked = true;
  }

  if (query.is_blocked === 'false') {
    where.is_blocked = false;
  }

  const [posts, total] = await Promise.all([
    Post.findAll({ where, order: [['created_at', 'DESC']], offset, limit }),
    Post.count({ where }),
  ]);

  return {
    status: 200,
    body: { success: true, data: { posts: posts.map(presentPost) }, pagination: { offset, limit, total } },
  };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run:

```bash
npm test -- src/ingest-api.test.js --runInBand
```

Expected: PASS.

- [ ] **Step 5: Commit**

Only if this directory is a git repository. If not, skip commit and continue.

```bash
git add src/services/ingestService.js src/ingest-api.test.js
git commit -m "feat: filter ingest posts by blocked status"
```

---

### Task 3: Ingest patch posts cập nhật is_blocked

**Files:**
- Modify: `src/controllers/ingestController.js`
- Modify: `src/services/ingestService.js`
- Modify: `src/ingest-api.test.js`

- [ ] **Step 1: Write failing update tests**

Add these tests after the existing test `PATCH /ingest/posts/:fbPostId cập nhật last_count riêng cho post gốc` in `src/ingest-api.test.js`:

```js
test('PATCH /ingest/posts/:fbPostId cập nhật is_blocked cho post gốc', async () => {
  const post = await Post.create({ fb_post_id: 'fb_update_blocked', last_count: 5, is_blocked: false });

  const response = await request(app)
    .patch('/ingest/posts/fb_update_blocked')
    .send({ is_blocked: true })
    .expect(200);

  expect(response.body).toMatchObject({
    success: true,
    data: {
      id: post.id,
      fb_post_id: 'fb_update_blocked',
      last_count: 5,
      is_blocked: true,
    },
  });

  await post.reload();
  expect(post.is_blocked).toBe(true);
  expect(post.last_count).toBe(5);
});

test('PATCH /ingest/posts/:fbPostId cập nhật last_count và is_blocked cùng lúc', async () => {
  const post = await Post.create({ fb_post_id: 'fb_update_count_and_blocked', last_count: 5, is_blocked: true });

  const response = await request(app)
    .patch('/ingest/posts/fb_update_count_and_blocked')
    .send({ last_count: 12, is_blocked: false })
    .expect(200);

  expect(response.body).toMatchObject({
    success: true,
    data: {
      id: post.id,
      fb_post_id: 'fb_update_count_and_blocked',
      last_count: 12,
      is_blocked: false,
    },
  });

  await post.reload();
  expect(post.last_count).toBe(12);
  expect(post.is_blocked).toBe(false);
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run:

```bash
npm test -- src/ingest-api.test.js --runInBand
```

Expected: FAIL because controller/service only forwards `last_count` and does not update `is_blocked`.

- [ ] **Step 3: Update controller to pass the body**

In `src/controllers/ingestController.js`, replace `updatePostLastCount` with:

```js
async function updatePostLastCount(req, res, next) {
  try {
    const result = await ingestService.updatePostLastCount(req.params.fbPostId, req.body);
    return res.status(result.status).json(result.body);
  } catch (error) {
    return next(error);
  }
}
```

- [ ] **Step 4: Update service to accept both fields**

In `src/services/ingestService.js`, replace `updatePostLastCount` with:

```js
async function updatePostLastCount(fbPostId, body = {}) {
  const post = await Post.findOne({ where: { fb_post_id: fbPostId } });

  if (!post) {
    return { status: 404, body: { success: false, message: 'Post không tồn tại' } };
  }

  const updates = { updated_at: new Date() };

  if (body.last_count !== undefined) {
    updates.last_count = body.last_count;
  }

  if (body.is_blocked !== undefined) {
    updates.is_blocked = body.is_blocked;
  }

  await post.update(updates);

  return { status: 200, body: { success: true, data: presentPost(post) } };
}
```

- [ ] **Step 5: Run ingest tests to verify they pass**

Run:

```bash
npm test -- src/ingest-api.test.js --runInBand
```

Expected: PASS.

- [ ] **Step 6: Commit**

Only if this directory is a git repository. If not, skip commit and continue.

```bash
git add src/controllers/ingestController.js src/services/ingestService.js src/ingest-api.test.js
git commit -m "feat: update ingest post blocked status"
```

---

### Task 4: Run focused and full backend verification

**Files:**
- No code changes expected.

- [ ] **Step 1: Run focused model tests**

Run:

```bash
npm test -- src/post-models.test.js --runInBand
```

Expected: PASS.

- [ ] **Step 2: Run focused ingest API tests**

Run:

```bash
npm test -- src/ingest-api.test.js --runInBand
```

Expected: PASS.

- [ ] **Step 3: Run all backend tests**

Run from `comment-system-backend`:

```bash
npm test -- --runInBand
```

Expected: PASS.

- [ ] **Step 4: Final commit for verification changes**

Only if previous tasks were committed and new files remain unstaged. If this directory is not a git repository, skip commit.

```bash
git status --short
git add src/models/Post.js src/post-models.test.js src/controllers/ingestController.js src/services/ingestService.js src/ingest-api.test.js
git commit -m "test: verify ingest post blocking"
```

If `git status --short` shows no changes, do not create an empty commit.

---

## Self-Review

- Spec coverage: Task 1 covers model field/default. Task 2 covers list response and `is_blocked=true/false` filters. Task 3 covers patch update for `is_blocked` and preserving `last_count`. Task 4 covers verification.
- Placeholder scan: no TBD/TODO/fill-in placeholders remain.
- Type consistency: all code uses the exact field name `is_blocked`, route `/ingest/posts/:fbPostId`, and existing service/controller naming `updatePostLastCount` to minimize unrelated rename churn.
