# Public Posts Vietnam Today Filter Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Update `GET /public/posts` so it only returns rows whose `posts.stats_date` equals today's date in Vietnam timezone while keeping the default `today_comment_count_gt` threshold at `3`.

**Architecture:** Keep the existing public route/controller/service shape unchanged. Update only the raw SQL in `postService.listPublicPosts()` to add a `stats_date` replacement computed with the existing `todayDateKey()` helper. Cover the behavior with the existing public API integration test.

**Tech Stack:** Node.js, Express, Sequelize raw SQL, Jest, Supertest, SQLite in test.

## Global Constraints

- Always answer and write comments in Vietnamese if comments are needed.
- Keep `GET /public/posts` public; do not add auth middleware.
- Do not change `/me/*` logic.
- Keep default `today_comment_count_gt` as `3`.
- Use Vietnam timezone date logic via existing `todayDateKey()` / `vietnamDateKey()` helper, not database `CURDATE()`.
- Use TDD: update the test first, watch it fail, then update production code.

---

### Task 1: Filter public posts by Vietnam today

**Files:**
- Modify: `src/public-posts-api.test.js`
- Modify: `src/services/postService.js`
- No changes required: `src/routes/publicPostRoutes.js`, `src/controllers/postController.js`, `src/app.js`

**Interfaces:**
- Consumes: `todayDateKey(date?: Date): string` already exported from `src/services/postService.js`.
- Produces: `listPublicPosts(query?: object)` still returns `{ status, body }` with `body.data.posts` containing `today_comment_count`, `title`, `original_link`.

- [ ] **Step 1: Write the failing test**

Update `src/public-posts-api.test.js` first test so seeded posts include `stats_date`, and add one stale post with high comments that must not be returned:

```js
const today = new Date();
const staleDate = new Date(today);
staleDate.setDate(staleDate.getDate() - 1);
const lowPost = await Post.create({ fb_post_id: 'public_low', last_count: 0, today_comment_count: 3, stats_date: today });
const highPost = await Post.create({ fb_post_id: 'public_high', last_count: 0, today_comment_count: 8, stats_date: today });
const mediumPost = await Post.create({ fb_post_id: 'public_medium', last_count: 0, today_comment_count: 5, stats_date: today });
const stalePost = await Post.create({ fb_post_id: 'public_stale', last_count: 0, today_comment_count: 99, stats_date: staleDate });
```

Add a `UserPost` row for `stalePost` and keep the expected response unchanged, so the test proves stale rows are excluded.

- [ ] **Step 2: Run test to verify it fails**

Run:

```powershell
npm --prefix "C:\Users\MR DOAN\Documents\PRO\comment-system-backend" test -- src/public-posts-api.test.js
```

Expected: FAIL because the stale post with `today_comment_count: 99` is returned before the valid today posts.

- [ ] **Step 3: Write minimal implementation**

In `src/services/postService.js`, update `listPublicPosts()` query from:

```sql
WHERE p.today_comment_count > :todayCommentCountGt
```

to:

```sql
WHERE p.stats_date = :todayDate
  AND p.today_comment_count > :todayCommentCountGt
```

and update replacements from:

```js
replacements: { todayCommentCountGt },
```

to:

```js
replacements: { todayCommentCountGt, todayDate: todayDateKey() },
```

- [ ] **Step 4: Run target tests**

Run:

```powershell
npm --prefix "C:\Users\MR DOAN\Documents\PRO\comment-system-backend" test -- src/public-posts-api.test.js
npm --prefix "C:\Users\MR DOAN\Documents\PRO\comment-system-backend" test -- src/swagger.test.js
```

Expected: both pass.

- [ ] **Step 5: Run full backend test suite**

Run:

```powershell
npm --prefix "C:\Users\MR DOAN\Documents\PRO\comment-system-backend" test
```

Expected: all test suites pass.

- [ ] **Step 6: Final review**

Confirm:
- `GET /public/posts` remains mounted without auth middleware.
- `today_comment_count_gt` default remains `3`.
- SQL uses parameter replacement for both threshold and date.
- No unrelated logic was changed.
