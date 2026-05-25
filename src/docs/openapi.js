const paginationParameters = [
  { name: 'page', in: 'query', schema: { type: 'integer', minimum: 1, default: 1 } },
  { name: 'limit', in: 'query', schema: { type: 'integer', minimum: 1, default: 20 } },
];

const authErrorResponses = {
  401: { description: 'Chưa đăng nhập hoặc token không hợp lệ' },
};

const authorizationHeader = {
  name: 'Authorization',
  in: 'header',
  required: true,
  schema: { type: 'string', example: 'Bearer session_token' },
};

function bearerOperation(tags, summary, extra = {}) {
  return {
    tags,
    summary,
    security: [{ bearerAuth: [] }],
    ...extra,
  };
}

const openApiSpec = {
  openapi: '3.0.0',
  info: {
    title: 'Comment System Backend API',
    version: '1.0.0',
    description: 'API quản lý user, post Facebook, comment, order, crawler ingest và realtime WebSocket.',
  },
  servers: [
    {
      url: 'http://localhost:3000',
      description: 'Local development',
    },
  ],
  tags: [
    { name: 'Health' },
    { name: 'Auth' },
    { name: 'Admin' },
    { name: 'Posts' },
    { name: 'Comments' },
    { name: 'Orders' },
    { name: 'Salers' },
    { name: 'Ingest' },
    { name: 'Realtime' },
  ],
  components: {
    securitySchemes: {
      bearerAuth: {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'session token',
      },
    },
    schemas: {
      ErrorResponse: {
        type: 'object',
        properties: {
          success: { type: 'boolean', example: false },
          message: { type: 'string', example: 'API not found' },
        },
      },
      Pagination: {
        type: 'object',
        properties: {
          page: { type: 'integer', example: 1 },
          limit: { type: 'integer', example: 20 },
          total: { type: 'integer', example: 42 },
          total_pages: { type: 'integer', example: 3 },
        },
      },
      User: {
        type: 'object',
        properties: {
          id: { type: 'integer', example: 1 },
          username: { type: 'string', example: 'user1' },
          name: { type: 'string', example: 'Nguyễn Văn A' },
          role: { type: 'string', enum: ['ADMIN', 'USER'], example: 'USER' },
          is_active: { type: 'boolean', example: true },
          created_at: { type: 'string', format: 'date-time' },
          updated_at: { type: 'string', format: 'date-time' },
        },
      },
      Post: {
        type: 'object',
        properties: {
          id: { type: 'integer', description: 'user_posts.id frontend dùng', example: 12 },
          title: { type: 'string', example: 'Bài livestream áo thun' },
          original_link: { type: 'string', example: 'https://www.facebook.com/reel/123456789' },
          today_comment_count: { type: 'integer', example: 8 },
          phone_today: { type: 'integer', example: 4 },
          created_at: { type: 'string', format: 'date-time' },
          updated_at: { type: 'string', format: 'date-time' },
        },
      },
      IngestPost: {
        type: 'object',
        properties: {
          id: { type: 'integer', example: 1 },
          fb_post_id: { type: 'string', example: '123456789' },
          last_count: { type: 'integer', example: 120 },
          is_blocked: { type: 'boolean', example: false },
          created_at: { type: 'string', format: 'date-time' },
          updated_at: { type: 'string', format: 'date-time' },
        },
      },
      Comment: {
        type: 'object',
        properties: {
          id: { type: 'string', example: 'comment_facebook_id' },
          post_title: { type: 'string', example: 'Bài livestream áo thun' },
          post_original_link: { type: 'string', example: 'https://www.facebook.com/reel/123456789' },
          uid: { type: 'string', example: '61586189634759' },
          fb_name: { type: 'string', example: 'Nguyen Van A' },
          avatar_user: { type: 'string', nullable: true, example: 'https://example.com/avatar.jpg' },
          content: { type: 'string', example: 'chốt 1 đơn' },
          phone: { type: 'string', nullable: true, example: '0987654321' },
          timestamp: { type: 'string', format: 'date-time' },
          status: { type: 'string', enum: ['normal', 'fail', 'success', 'is_calling'], example: 'normal' },
        },
      },
      Saler: {
        type: 'object',
        properties: {
          id: { type: 'integer', example: 1 },
          name_saler: { type: 'string', example: 'Nguyễn A' },
          username_saler: { type: 'string', example: 'nguyena' },
        },
      },
      Order: {
        type: 'object',
        properties: {
          id: { type: 'integer', example: 1 },
          product_name: { type: 'string', example: 'Áo thun' },
          customer_name: { type: 'string', example: 'Nguyễn Văn A' },
          avatar_customer: { type: 'string', nullable: true, example: 'https://example.com/avatar.jpg' },
          phone: { type: 'string', example: '0900000000' },
          address: { type: 'string', example: 'Hà Nội' },
          staff: { type: 'string', nullable: true, example: 'Nhân viên A' },
          total_price: { type: 'number', nullable: true, example: 150000 },
          status: { type: 'string', enum: ['pending', 'completed', 'cancelled'], example: 'pending' },
          note: { type: 'string', nullable: true, example: 'Giao buổi sáng' },
          created_at: { type: 'string', format: 'date-time' },
          updated_at: { type: 'string', format: 'date-time' },
        },
      },
      RealtimeMessage: {
        type: 'object',
        properties: {
          event: {
            type: 'string',
            enum: [
              'comment.created',
              'comment.status_updated',
              'post.created',
              'post.updated',
              'post.deleted',
              'post.stats_updated',
              'order.created',
              'order.updated',
              'order.deleted',
            ],
          },
          payload: { type: 'object' },
        },
      },
      RealtimeDocs: {
        type: 'object',
        example: {
          connect: {
            url: 'ws://localhost:3000?token=<session_token>',
            room: 'user:{userId}',
            message_shape: { event: 'event.name', payload: {} },
          },
          events: {
            'comment.created': {
              payload: {
                comment: {
                  id: 'comment_facebook_id',
                  user_post_id: 12,
                  post_id: 5,
                  post_title: 'Bài livestream áo thun',
                  post_original_link: 'https://www.facebook.com/reel/123456789',
                  uid: '61586189634759',
                  fb_name: 'Nguyen Van A',
                  avatar_user: 'https://example.com/avatar.jpg',
                  content: 'chốt 1 đơn',
                  phone: '0987654321',
                  timestamp: '2026-05-16T10:00:00.000Z',
                  status: 'normal',
                },
              },
            },
            'comment.status_updated': {
              payload: {
                comment: {
                  id: 'comment_facebook_id',
                  user_post_id: 12,
                  post_title: 'Bài livestream áo thun',
                  post_original_link: 'https://www.facebook.com/reel/123456789',
                  status: 'is_calling',
                },
              },
            },
            'post.created': { payload: { post: { id: 12, title: 'Bài livestream áo thun', original_link: 'https://www.facebook.com/reel/123456789', today_comment_count: 0, phone_today: 0 } } },
            'post.updated': { payload: { post: { id: 12, title: 'Bài livestream áo thun mới', original_link: 'https://www.facebook.com/reel/987654321', today_comment_count: 5, phone_today: 3 } } },
            'post.deleted': { payload: { post: { id: 12 } } },
            'post.stats_updated': { payload: { post: { id: 12, today_comment_count: 6, phone_today: 4 } } },
            'order.created': { payload: { order: { id: 1, product_name: 'Áo thun', customer_name: 'Nguyễn Văn A', phone: '0900000000', address: 'Hà Nội', staff: 'Nhân viên A', total_price: 150000, status: 'pending', note: 'Giao buổi sáng' } } },
            'order.updated': { payload: { order: { id: 1, product_name: 'Áo thun', customer_name: 'Nguyễn Văn A', phone: '0900000000', address: 'Hà Nội', staff: 'Nhân viên B', total_price: 150000, status: 'completed', note: 'Đã giao' } } },
            'order.deleted': { payload: { order: { id: 1 } } },
          },
        },
      },
    },
  },
  paths: {
    '/health': {
      get: {
        tags: ['Health'],
        summary: 'Kiểm tra backend còn chạy',
        responses: { 200: { description: 'Backend đang chạy' } },
      },
    },
    '/api-docs.json': {
      get: {
        tags: ['Health'],
        summary: 'Lấy OpenAPI JSON spec',
        responses: { 200: { description: 'OpenAPI spec' } },
      },
    },
    '/realtime/docs': {
      get: {
        tags: ['Realtime'],
        summary: 'Tài liệu WebSocket realtime events',
        description: 'Endpoint HTTP chỉ để đọc docs realtime trong Swagger. Kết nối thật dùng ws://localhost:3000?token=<session_token>.',
        responses: {
          200: {
            description: 'Danh sách realtime events và payload mẫu',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/RealtimeDocs' },
              },
            },
          },
        },
      },
    },
    '/auth/login': {
      post: {
        tags: ['Auth'],
        summary: 'Đăng nhập và lấy session token',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['username', 'password'],
                properties: {
                  username: { type: 'string', example: 'user1' },
                  password: { type: 'string', example: 'password123' },
                  deviceName: { type: 'string', example: 'Chrome Windows' },
                },
              },
            },
          },
        },
        responses: { 200: { description: 'Đăng nhập thành công' }, 401: { description: 'Sai tài khoản hoặc mật khẩu' } },
      },
    },
    '/auth/logout': {
      post: bearerOperation(['Auth'], 'Đăng xuất session hiện tại', { responses: { 200: { description: 'Đăng xuất thành công' }, ...authErrorResponses } }),
    },
    '/auth/logout-other-devices': {
      post: bearerOperation(['Auth'], 'Đăng xuất tất cả thiết bị khác, giữ session hiện tại', {
        responses: {
          200: { description: 'Các session khác đã bị đăng xuất' },
          ...authErrorResponses,
        },
      }),
    },
    '/auth/password': {
      patch: bearerOperation(['Auth'], 'User đổi mật khẩu bằng mật khẩu cũ', {
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['currentPassword', 'newPassword'],
                properties: {
                  currentPassword: { type: 'string', example: 'oldpass123' },
                  newPassword: { type: 'string', example: 'newpass123' },
                },
              },
            },
          },
        },
        responses: { 200: { description: 'Đổi mật khẩu thành công' }, 400: { description: 'Mật khẩu cũ không đúng hoặc thiếu input' }, ...authErrorResponses },
      }),
    },
    '/me': {
      get: bearerOperation(['Auth'], 'Lấy thông tin user hiện tại', {
        parameters: [authorizationHeader],
        responses: { 200: { description: 'Thông tin user' }, ...authErrorResponses },
      }),
    },
    '/admin/users': {
      post: bearerOperation(['Admin'], 'Admin tạo user', {
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['username', 'password', 'name'],
                properties: {
                  username: { type: 'string' },
                  password: { type: 'string' },
                  name: { type: 'string' },
                  role: { type: 'string', enum: ['ADMIN', 'USER'], default: 'USER' },
                },
              },
            },
          },
        },
        responses: { 201: { description: 'User đã tạo' }, 403: { description: 'Không phải admin' } },
      }),
      get: bearerOperation(['Admin'], 'Admin lấy danh sách user', { responses: { 200: { description: 'Danh sách user' } } }),
    },
    '/admin/users/{id}/password': {
      patch: bearerOperation(['Admin'], 'Admin đổi mật khẩu user', {
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'integer' } }],
        requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', required: ['password'], properties: { password: { type: 'string' } } } } } },
        responses: { 200: { description: 'Đã đổi mật khẩu' }, 404: { description: 'User không tồn tại' } },
      }),
    },
    '/admin/users/{id}/disable': {
      patch: bearerOperation(['Admin'], 'Admin khóa user', {
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'integer' } }],
        responses: { 200: { description: 'User đã bị khóa' }, 404: { description: 'User không tồn tại' } },
      }),
    },
    '/admin/users/{id}/enable': {
      patch: bearerOperation(['Admin'], 'Admin mở khóa user', {
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'integer' } }],
        responses: { 200: { description: 'User đã được mở khóa' }, 404: { description: 'User không tồn tại' } },
      }),
    },
    '/me/posts': {
      post: bearerOperation(['Posts'], 'Tạo bài theo dõi cho user', {
        requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', required: ['title', 'originalLink'], properties: { title: { type: 'string' }, originalLink: { type: 'string' } } } } } },
        responses: { 201: { description: 'Post đã tạo' }, 400: { description: 'Input không hợp lệ' } },
      }),
      get: bearerOperation(['Posts'], 'Lấy danh sách post của user', {
        parameters: [
          ...paginationParameters,
          { name: 'title_search', in: 'query', schema: { type: 'string' } },
          { name: 'search', in: 'query', schema: { type: 'string' } },
          { name: 'created_from', in: 'query', schema: { type: 'string', format: 'date-time' } },
          { name: 'created_to', in: 'query', schema: { type: 'string', format: 'date-time' } },
          { name: 'sort_by', in: 'query', schema: { type: 'string', enum: ['created_at', 'updated_at', 'title', 'today_comment_count', 'phone_today'] } },
          { name: 'sort_order', in: 'query', schema: { type: 'string', enum: ['asc', 'desc'] } },
        ],
        responses: { 200: { description: 'Danh sách post' }, 400: { description: 'Tham số không hợp lệ' } },
      }),
    },
    '/me/posts/commented-count-today': {
      get: bearerOperation(['Posts'], 'Đếm số bài đang theo dõi có comment hôm nay', {
        responses: { 200: { description: 'Số bài có comment hôm nay' } },
      }),
    },
    '/me/posts/{userPostId}': {
      get: bearerOperation(['Posts'], 'Lấy chi tiết post của user', {
        parameters: [{ name: 'userPostId', in: 'path', required: true, schema: { type: 'integer' } }],
        responses: { 200: { description: 'Chi tiết post' }, 404: { description: 'Post không tồn tại' } },
      }),
      patch: bearerOperation(['Posts'], 'Cập nhật post của user', {
        parameters: [{ name: 'userPostId', in: 'path', required: true, schema: { type: 'integer' } }],
        requestBody: { content: { 'application/json': { schema: { type: 'object', properties: { title: { type: 'string' }, original_link: { type: 'string' } } } } } },
        responses: { 200: { description: 'Post đã cập nhật' }, 400: { description: 'Input không hợp lệ' }, 404: { description: 'Post không tồn tại' } },
      }),
      delete: bearerOperation(['Posts'], 'Xóa post khỏi tài khoản user', {
        parameters: [{ name: 'userPostId', in: 'path', required: true, schema: { type: 'integer' } }],
        responses: { 200: { description: 'Post đã xóa' }, 404: { description: 'Post không tồn tại' } },
      }),
    },
    '/me/posts/{userPostId}/comments': {
      get: bearerOperation(['Comments'], 'Lấy comments của một post user đang theo dõi', {
        parameters: [{ name: 'userPostId', in: 'path', required: true, schema: { type: 'integer' } }, ...paginationParameters],
        responses: { 200: { description: 'Danh sách comment' }, 404: { description: 'Post không tồn tại' } },
      }),
    },
    '/me/comments': {
      get: bearerOperation(['Comments'], 'Lấy tất cả comments thuộc post user đang theo dõi', {
        parameters: [...paginationParameters, { name: 'search', in: 'query', schema: { type: 'string' }, description: 'Tìm theo số điện thoại comment' }, { name: 'phone', in: 'query', schema: { type: 'boolean' }, description: 'true để chỉ lấy comments có số điện thoại khác null và khác rỗng' }],
        responses: { 200: { description: 'Danh sách comment' } },
      }),
    },
    '/me/comments/count-today': {
      get: bearerOperation(['Comments'], 'Đếm comments hôm nay của user', {
        responses: { 200: { description: 'Số comments hôm nay' } },
      }),
    },
    '/me/comments/{commentId}/status': {
      patch: bearerOperation(['Comments'], 'Cập nhật status comment riêng cho user', {
        parameters: [{ name: 'commentId', in: 'path', required: true, schema: { type: 'string' } }],
        requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', required: ['status'], properties: { status: { type: 'string', enum: ['normal', 'fail', 'success', 'is_calling'] } } } } } },
        responses: { 200: { description: 'Status đã cập nhật' }, 400: { description: 'Status không hợp lệ' }, 404: { description: 'Comment không tồn tại' } },
      }),
    },
    '/me/salers': {
      get: bearerOperation(['Salers'], 'Lấy danh sách saler của user', {
        responses: { 200: { description: 'Danh sách saler' } },
      }),
    },
    '/me/orders': {
      post: bearerOperation(['Orders'], 'Tạo order cho user', {
        requestBody: { required: true, content: { 'application/json': { schema: { $ref: '#/components/schemas/Order' } } } },
        responses: { 201: { description: 'Order đã tạo' }, 400: { description: 'Input không hợp lệ' } },
      }),
      get: bearerOperation(['Orders'], 'Lấy danh sách order của user', {
        parameters: [...paginationParameters, { name: 'search', in: 'query', schema: { type: 'string' }, description: 'Tìm theo tên khách, sản phẩm, số điện thoại, địa chỉ' }],
        responses: { 200: { description: 'Danh sách order' } },
      }),
    },
    '/me/orders/{orderId}': {
      get: bearerOperation(['Orders'], 'Lấy chi tiết order', {
        parameters: [{ name: 'orderId', in: 'path', required: true, schema: { type: 'integer' } }],
        responses: { 200: { description: 'Chi tiết order' }, 404: { description: 'Order không tồn tại' } },
      }),
      patch: bearerOperation(['Orders'], 'Cập nhật order', {
        parameters: [{ name: 'orderId', in: 'path', required: true, schema: { type: 'integer' } }],
        requestBody: { content: { 'application/json': { schema: { $ref: '#/components/schemas/Order' } } } },
        responses: { 200: { description: 'Order đã cập nhật' }, 400: { description: 'Input không hợp lệ' }, 404: { description: 'Order không tồn tại' } },
      }),
      delete: bearerOperation(['Orders'], 'Xóa order', {
        parameters: [{ name: 'orderId', in: 'path', required: true, schema: { type: 'integer' } }],
        responses: { 200: { description: 'Order đã xóa' }, 404: { description: 'Order không tồn tại' } },
      }),
    },
    '/ingest/posts': {
      get: {
        tags: ['Ingest'],
        summary: 'Crawler lấy danh sách post gốc',
        parameters: [
          { name: 'offset', in: 'query', schema: { type: 'integer', minimum: 0, default: 0 } },
          { name: 'limit', in: 'query', schema: { type: 'integer', minimum: 1, default: 100 } },
          { name: 'is_blocked', in: 'query', schema: { type: 'boolean' } },
        ],
        responses: {
          200: {
            description: 'Danh sách post gốc',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: { type: 'boolean', example: true },
                    data: {
                      type: 'object',
                      properties: {
                        posts: { type: 'array', items: { $ref: '#/components/schemas/IngestPost' } },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
    '/ingest/posts/{fbPostId}': {
      patch: {
        tags: ['Ingest'],
        summary: 'Crawler cập nhật post gốc',
        parameters: [{ name: 'fbPostId', in: 'path', required: true, schema: { type: 'string' } }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  last_count: { type: 'integer', example: 120 },
                  is_blocked: { type: 'boolean', example: true },
                },
              },
            },
          },
        },
        responses: {
          200: { description: 'Post gốc đã cập nhật', content: { 'application/json': { schema: { $ref: '#/components/schemas/IngestPost' } } } },
          404: { description: 'Post không tồn tại' },
        },
      },
      delete: {
        tags: ['Ingest'],
        summary: 'Crawler xoá cứng post gốc',
        parameters: [{ name: 'fbPostId', in: 'path', required: true, schema: { type: 'string' } }],
        responses: {
          200: { description: 'Post gốc đã xoá' },
          404: { description: 'Post không tồn tại' },
        },
      },
    },
    '/ingest/comments/bulk': {
      post: {
        tags: ['Ingest'],
        summary: 'Crawler ingest bulk comments',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['fb_post_id', 'comments'],
                properties: {
                  fb_post_id: { type: 'string', example: '123456789' },
                  last_count: { type: 'integer', deprecated: true, example: 100 },
                  comments: {
                    type: 'array',
                    items: {
                      type: 'object',
                      required: ['id', 'uid', 'fb_name', 'content', 'timestamp'],
                      properties: {
                        id: { type: 'string', example: 'comment_1' },
                        uid: { type: 'string', example: 'uid_1' },
                        fb_name: { type: 'string', example: 'Khách 1' },
                        avatar_user: { type: 'string', nullable: true, example: 'https://example.com/avatar.jpg' },
                        content: { type: 'string', example: 'chốt 1 đơn' },
                        phone: { type: 'string', nullable: true, example: '0900000001' },
                        timestamp: { type: 'string', format: 'date-time' },
                      },
                    },
                  },
                },
              },
            },
          },
        },
        responses: { 200: { description: 'Kết quả ingest bulk' }, 404: { description: 'Post không tồn tại' }, 409: { description: 'Comment đã tồn tại' } },
      },
    },
  },
};

module.exports = openApiSpec;
