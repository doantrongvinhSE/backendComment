# Thiết kế xoá post chung qua ingest

## Mục tiêu

Thêm API không auth để xoá cứng post chung theo `fb_post_id` trong namespace ingest.

## API

### `DELETE /ingest/posts/:fbPostId`

- Không yêu cầu auth.
- Tìm post chung theo `fb_post_id`.
- Nếu không tồn tại, trả `404`:

```json
{ "success": false, "message": "Post không tồn tại" }
```

- Nếu tồn tại, xoá cứng post và trả `200`:

```json
{ "success": true }
```

## Hành vi dữ liệu

Xoá post chung sẽ xoá luôn `user_posts` và `comments` liên quan theo quan hệ cascade hiện có trên model `Post`.

## Kiểm thử

- `DELETE /ingest/posts/:fbPostId` xoá post tồn tại.
- Xoá post sẽ xoá cascade `UserPost` và `Comment` liên quan.
- API trả `404` nếu `fb_post_id` không tồn tại.
