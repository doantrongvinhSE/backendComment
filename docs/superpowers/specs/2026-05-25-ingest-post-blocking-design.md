# Thiết kế chặn post chung cho ingest

## Mục tiêu

Thêm trạng thái `is_blocked` vào post chung trong bảng `posts` để luồng ingest/crawler có thể lấy danh sách post bị chặn và cập nhật trạng thái chặn mà không cần auth.

## Phạm vi

- Thêm field `is_blocked` kiểu boolean vào model `Post`, mặc định `false`.
- Mở rộng API ingest hiện có, không thêm auth.
- Không thay đổi API `/me/posts` của user thường.
- Không thay đổi logic ingest comment ngoài việc post có thêm trạng thái để crawler đọc/cập nhật.

## API

### `GET /ingest/posts`

Response mỗi post có thêm `is_blocked`.

Query hỗ trợ thêm:

- `is_blocked=true`: chỉ trả post chung đang bị chặn.
- `is_blocked=false`: chỉ trả post chung chưa bị chặn.
- Không truyền `is_blocked`: trả tất cả post như hiện tại.

Pagination `offset`, `limit` giữ nguyên.

### `PATCH /ingest/posts/:fbPostId`

Body nhận một hoặc cả hai field:

- `last_count`: cập nhật số lượng cuối như hiện tại.
- `is_blocked`: cập nhật trạng thái chặn của post chung.

Nếu `fbPostId` không tồn tại, trả `404` với message hiện tại `Post không tồn tại`.

## Dữ liệu trả về

Presenter ingest post trả:

- `id`
- `fb_post_id`
- `last_count`
- `is_blocked`
- `created_at`
- `updated_at`

## Kiểm thử

Bổ sung test cho:

- Model `Post` có `is_blocked` mặc định `false`.
- `GET /ingest/posts` trả `is_blocked`.
- `GET /ingest/posts?is_blocked=true` chỉ trả post bị chặn.
- `PATCH /ingest/posts/:fbPostId` cập nhật `is_blocked`.
- `PATCH /ingest/posts/:fbPostId` vẫn cập nhật `last_count` như cũ.
