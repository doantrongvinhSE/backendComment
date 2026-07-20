const orderService = require('../services/orderService');
const { buildOrdersExcelBuffer } = require('../utils/orderExcelExport');

async function createOrder(req, res, next) {
  try {
    const result = await orderService.createOrder(req.ownerId, req.body);
    return res.status(result.status).json(result.body);
  } catch (error) {
    return next(error);
  }
}

async function listOrders(req, res, next) {
  try {
    const result = await orderService.listOrders(req.ownerId, req.query);
    return res.status(result.status).json(result.body);
  } catch (error) {
    return next(error);
  }
}

async function getOrder(req, res, next) {
  try {
    const result = await orderService.getOrder(req.ownerId, req.params.orderId);
    return res.status(result.status).json(result.body);
  } catch (error) {
    return next(error);
  }
}

async function updateOrder(req, res, next) {
  try {
    const result = await orderService.updateOrder(req.ownerId, req.params.orderId, req.body);
    return res.status(result.status).json(result.body);
  } catch (error) {
    return next(error);
  }
}

async function deleteOrder(req, res, next) {
  try {
    const result = await orderService.deleteOrder(req.ownerId, req.params.orderId);
    return res.status(result.status).json(result.body);
  } catch (error) {
    return next(error);
  }
}

async function exportOrdersExcel(req, res, next) {
  try {
    const orders = await orderService.listOrdersForExport(req.ownerId);
    const buffer = await buildOrdersExcelBuffer(orders);
    const fileName = `don-hang-${Date.now()}.xlsx`;

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
    return res.send(buffer);
  } catch (error) {
    return next(error);
  }
}

module.exports = {
  createOrder,
  listOrders,
  getOrder,
  updateOrder,
  deleteOrder,
  exportOrdersExcel,
};
