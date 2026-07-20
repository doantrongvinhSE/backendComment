const express = require('express');
const authMiddleware = require('../middlewares/authMiddleware');
const requireModule = require('../middlewares/moduleMiddleware');
const orderController = require('../controllers/orderController');

const router = express.Router();

router.use(authMiddleware);

// Tạo đơn luôn cho phép, kể cả khi employee không có quyền module 'orders' —
// employee chốt đơn từ comment không cần quyền xem/sửa/xoá toàn bộ danh sách đơn của đại lý.
router.post('/', orderController.createOrder);

router.use(requireModule('orders'));

router.get('/', orderController.listOrders);
router.get('/export/excel', orderController.exportOrdersExcel);
router.get('/:orderId', orderController.getOrder);
router.patch('/:orderId', orderController.updateOrder);
router.delete('/:orderId', orderController.deleteOrder);

module.exports = router;
