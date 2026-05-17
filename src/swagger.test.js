const request = require('supertest');

process.env.NODE_ENV = 'test';

const app = require('./app');

test('GET /api-docs.json trả OpenAPI spec cho frontend', async () => {
  const response = await request(app)
    .get('/api-docs.json')
    .expect(200);

  expect(response.body.openapi).toBe('3.0.0');
  expect(response.body.paths).toHaveProperty('/auth/login');
  expect(response.body.paths).toHaveProperty('/auth/logout-other-devices');
  expect(response.body.paths).toHaveProperty('/auth/password');
  expect(response.body.paths).toHaveProperty('/me/posts');
  expect(response.body.paths).toHaveProperty('/me/orders');
  expect(response.body.paths).toHaveProperty('/realtime/docs');
  expect(response.body.paths['/realtime/docs'].get.tags).toEqual(['Realtime']);
  expect(response.body.components.securitySchemes).toHaveProperty('bearerAuth');
  expect(response.body.paths['/me'].get.security).toEqual([{ bearerAuth: [] }]);
  expect(response.body.paths['/me'].get.parameters).toEqual(expect.arrayContaining([
    expect.objectContaining({
      name: 'Authorization',
      in: 'header',
      required: true,
    }),
  ]));
  expect(response.body.paths).toHaveProperty('/me/comments/count-today');
  expect(response.body.paths['/ingest/posts'].get.parameters).toEqual(expect.arrayContaining([
    expect.objectContaining({ name: 'offset', in: 'query' }),
    expect.objectContaining({ name: 'limit', in: 'query' }),
  ]));
  expect(response.body.paths['/me/comments'].get.parameters).toEqual(expect.arrayContaining([
    expect.objectContaining({
      name: 'search',
      in: 'query',
    }),
    expect.objectContaining({
      name: 'phone',
      in: 'query',
    }),
  ]));
  expect(response.body.paths['/me/posts/{userPostId}/comments'].get.parameters).not.toEqual(expect.arrayContaining([
    expect.objectContaining({
      name: 'search',
      in: 'query',
    }),
  ]));
  expect(response.body.components.schemas.Comment.properties.status.enum).toEqual(['normal', 'fail', 'success', 'is_calling']);
  expect(response.body.paths['/me/comments/{commentId}/status'].patch.requestBody.content['application/json'].schema.properties.status.enum).toEqual(['normal', 'fail', 'success', 'is_calling']);
});

test('GET /api-docs/ trả Swagger UI HTML', async () => {
  const response = await request(app)
    .get('/api-docs/')
    .expect(200);

  expect(response.text).toContain('Swagger UI');
});

test('GET /realtime/docs trả docs realtime events', async () => {
  const response = await request(app)
    .get('/realtime/docs')
    .expect(200);

  expect(response.body.connect.url).toBe('ws://localhost:3000?token=<session_token>');
  expect(response.body.events['comment.created'].payload.comment.post_title).toBe('Bài livestream áo thun');
  expect(response.body.events['comment.created'].payload.comment.post_original_link).toBe('https://www.facebook.com/reel/123456789');
  expect(response.body.events['post.stats_updated']).toBeDefined();
  expect(response.body.events['order.deleted']).toBeDefined();
});
