const orderService = require('../services/orderService');

async function createOrder(req, res, next) {
  try {
    const result = await orderService.createOrder(req.user.id, req.body);
    return res.status(result.status).json(result.body);
  } catch (error) {
    return next(error);
  }
}

async function listOrders(req, res, next) {
  try {
    const result = await orderService.listOrders(req.user.id, req.query);
    return res.status(result.status).json(result.body);
  } catch (error) {
    return next(error);
  }
}

async function getOrder(req, res, next) {
  try {
    const result = await orderService.getOrder(req.user.id, req.params.orderId);
    return res.status(result.status).json(result.body);
  } catch (error) {
    return next(error);
  }
}

async function updateOrder(req, res, next) {
  try {
    const result = await orderService.updateOrder(req.user.id, req.params.orderId, req.body);
    return res.status(result.status).json(result.body);
  } catch (error) {
    return next(error);
  }
}

async function deleteOrder(req, res, next) {
  try {
    const result = await orderService.deleteOrder(req.user.id, req.params.orderId);
    return res.status(result.status).json(result.body);
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
};
