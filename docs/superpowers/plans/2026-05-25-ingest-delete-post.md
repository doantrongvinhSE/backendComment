# Ingest Delete Post Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Thêm API không auth `DELETE /ingest/posts/:fbPostId` để xoá cứng post chung theo `fb_post_id`.

**Architecture:** Route ingest gọi controller mới, controller chuyển `fbPostId` sang service, service tìm `Post` theo `fb_post_id` rồi `destroy()`. Cascade xoá `UserPost` và `Comment` dựa trên association hiện có của model `Post`.

**Tech Stack:** Node.js, Express, Sequelize, Jest, Supertest.

---

## File Structure

- Modify: `src/routes/ingestRoutes.js` — đăng ký route `DELETE /posts/:fbPostId` không auth.
- Modify: `src/controllers/ingestController.js` — thêm controller `deletePost`.
- Modify: `src/services/ingestService.js` — thêm service `deletePostByFbPostId`.
- Modify: `src/ingest-api.test.js` — thêm test xoá thành công, cascade, và 404.

---

### Task 1: Thêm test API xoá post ingest

**Files:**
- Modify: `src/ingest-api.test.js`

- [ ] **Step 1: Write failing tests**

Add these tests after the existing `PATCH /ingest/posts/:fbPostId trả 404 khi post gốc không tồn tại` test in `src/ingest-api.test.js`:

```js
test('DELETE /ingest/posts/:fbPostId xoá cứng post gốc', async () => {
  await Post.create({ fb_post_id: 'fb_delete_post', last_count: 5 });

  const response = await request(app)
    .delete('/ingest/posts/fb_delete_post')
    .expect(200);

  expect(response.body).toEqual({ success: true });
  expect(await Post.findOne({ where: { fb_post_id: 'fb_delete_post' } })).toBeNull();
});

test('DELETE /ingest/posts/:fbPostId xoá cascade user_posts và comments liên quan', async () => {
  const post = await Post.create({ fb_post_id: 'fb_delete_cascade', last_count: 5 });
  const user = await User.create({ username: 'delete_cascade_user', password_hash: 'hash', name: 'Delete Cascade User', role: 'USER' });
  await UserPost.create({ user_id: user.id, post_id: post.id, title: 'Bài xoá cascade' });
  await Comment.create({
    id: 'delete_cascade_comment',
    uid: 'uid_delete_cascade',
    timestamp: new Date('2026-05-14T10:00:00.000Z'),
    post_id: post.id,
  });

  await request(app)
    .delete('/ingest/posts/fb_delete_cascade')
    .expect(200);

  expect(await Post.findByPk(post.id)).toBeNull();
  expect(await UserPost.count({ where: { post_id: post.id } })).toBe(0);
  expect(await Comment.count({ where: { post_id: post.id } })).toBe(0);
});

test('DELETE /ingest/posts/:fbPostId trả 404 khi post gốc không tồn tại', async () => {
  const response = await request(app)
    .delete('/ingest/posts/missing_delete_post')
    .expect(404);

  expect(response.body).toEqual({
    success: false,
    message: 'Post không tồn tại',
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run:

```bash
npm --prefix "c:\Users\MR DOAN\Documents\PRO\comment-system-backend" test -- src/ingest-api.test.js --runInBand
```

Expected: FAIL with 404 route not found for the new DELETE tests.

---

### Task 2: Implement delete route, controller, and service

**Files:**
- Modify: `src/routes/ingestRoutes.js`
- Modify: `src/controllers/ingestController.js`
- Modify: `src/services/ingestService.js`

- [ ] **Step 1: Add route**

In `src/routes/ingestRoutes.js`, insert this route after the PATCH route:

```js
router.delete('/posts/:fbPostId', ingestController.deletePost);
```

The route block should be:

```js
router.get('/posts', ingestController.listPosts);
router.patch('/posts/:fbPostId', ingestController.updatePostLastCount);
router.delete('/posts/:fbPostId', ingestController.deletePost);
router.post('/comments/bulk', ingestController.ingestCommentsBulk);
```

- [ ] **Step 2: Add controller**

In `src/controllers/ingestController.js`, add this function after `updatePostLastCount`:

```js
async function deletePost(req, res, next) {
  try {
    const result = await ingestService.deletePostByFbPostId(req.params.fbPostId);
    return res.status(result.status).json(result.body);
  } catch (error) {
    return next(error);
  }
}
```

Then export it:

```js
module.exports = {
  ingestCommentsBulk,
  listPosts,
  updatePostLastCount,
  deletePost,
};
```

- [ ] **Step 3: Add service**

In `src/services/ingestService.js`, add this function after `updatePostLastCount`:

```js
async function deletePostByFbPostId(fbPostId) {
  const post = await Post.findOne({ where: { fb_post_id: fbPostId } });

  if (!post) {
    return { status: 404, body: { success: false, message: 'Post không tồn tại' } };
  }

  await post.destroy();

  return { status: 200, body: { success: true } };
}
```

Then export it:

```js
module.exports = {
  ingestCommentsBulk,
  listPostsForIngest,
  updatePostLastCount,
  deletePostByFbPostId,
};
```

- [ ] **Step 4: Run ingest tests to verify they pass**

Run:

```bash
npm --prefix "c:\Users\MR DOAN\Documents\PRO\comment-system-backend" test -- src/ingest-api.test.js --runInBand
```

Expected: PASS.

---

### Task 3: Verify backend

**Files:**
- No code changes expected.

- [ ] **Step 1: Run focused ingest API tests**

Run:

```bash
npm --prefix "c:\Users\MR DOAN\Documents\PRO\comment-system-backend" test -- src/ingest-api.test.js --runInBand
```

Expected: PASS.

- [ ] **Step 2: Run full backend tests**

Run:

```bash
npm --prefix "c:\Users\MR DOAN\Documents\PRO\comment-system-backend" test -- --runInBand
```

Expected: PASS.

---

## Self-Review

- Spec coverage: Task 1 tests success, cascade, and 404. Task 2 implements route/controller/service. Task 3 verifies focused and full tests.
- Placeholder scan: no TBD/TODO/fill-in placeholders remain.
- Type consistency: route uses `fbPostId`, service uses `deletePostByFbPostId`, response messages match existing ingest API.
