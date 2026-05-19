const express = require('express');
const cors = require('cors');
const swaggerUi = require('swagger-ui-express');
const authRoutes = require('./routes/authRoutes');
const adminRoutes = require('./routes/adminRoutes');
const postRoutes = require('./routes/postRoutes');
const commentRoutes = require('./routes/commentRoutes');
const orderRoutes = require('./routes/orderRoutes');
const salerRoutes = require('./routes/salerRoutes');
const ingestRoutes = require('./routes/ingestRoutes');
const commentController = require('./controllers/commentController');
const authController = require('./controllers/authController');
const authMiddleware = require('./middlewares/authMiddleware');
const openApiSpec = require('./docs/openapi');

const app = express();

app.use(cors());
app.use(express.json({ limit: '10mb' }));

app.get('/health', (req, res) => {
  res.json({
    success: true,
    message: 'Backend is running',
    time: new Date().toISOString(),
  });
});

app.get('/api-docs.json', (req, res) => {
  res.json(openApiSpec);
});
app.get('/realtime/docs', (req, res) => {
  res.json(openApiSpec.components.schemas.RealtimeDocs.example);
});
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(openApiSpec));

app.use('/auth', authRoutes);
app.use('/ingest', ingestRoutes);
app.get('/me', authMiddleware, authController.me);
app.use('/me/comments', commentRoutes);
app.use('/me/orders', orderRoutes);
app.use('/me/salers', salerRoutes);
app.get('/me/posts/:userPostId/comments', authMiddleware, commentController.listCommentsByUserPost);
app.use('/me/posts', postRoutes);
app.use('/admin', adminRoutes);

app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: 'API not found',
  });
});

app.use((error, req, res, next) => {
  res.status(500).json({
    success: false,
    message: error.message || 'Lỗi server',
  });
});

module.exports = app;
