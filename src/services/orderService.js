const { Op } = require('sequelize');
const { Order } = require('../models');
const { getPagination, paginationMeta } = require('../utils/pagination');
const realtimeService = require('./realtimeService');

const ORDER_STATUSES = ['pending', 'completed', 'cancelled'];
const ORDER_FIELDS = [
  'product_name',
  'customer_name',
  'avatar_customer',
  'phone',
  'address',
  'staff',
  'total_price',
  'status',
  'note',
];

function notFoundResponse() {
  return { status: 404, body: { success: false, message: 'Đơn hàng không tồn tại' } };
}

function invalidStatusResponse() {
  return { status: 400, body: { success: false, message: 'Trạng thái không hợp lệ' } };
}

function presentOrder(order) {
  return {
    id: order.id,
    product_name: order.product_name,
    customer_name: order.customer_name,
    avatar_customer: order.avatar_customer,
    phone: order.phone,
    address: order.address,
    staff: order.staff,
    total_price: order.total_price,
    status: order.status,
    note: order.note,
    created_at: order.created_at,
    updated_at: order.updated_at,
  };
}

function pickOrderFields(body) {
  return ORDER_FIELDS.reduce((fields, field) => {
    if (body[field] !== undefined) {
      fields[field] = body[field];
    }
    return fields;
  }, {});
}

function hasInvalidStatus(status) {
  return status !== undefined && !ORDER_STATUSES.includes(status);
}

function buildOrderFilters(userId, query = {}) {
  const where = { user_id: userId };

  if (query.search) {
    where[Op.or] = [
      { customer_name: { [Op.like]: `%${query.search}%` } },
      { product_name: { [Op.like]: `%${query.search}%` } },
      { phone: { [Op.like]: `%${query.search}%` } },
      { address: { [Op.like]: `%${query.search}%` } },
    ];
  }

  return where;
}

async function createOrder(userId, body) {
  if (hasInvalidStatus(body.status)) {
    return invalidStatusResponse();
  }

  const order = await Order.create({
    user_id: userId,
    product_name: body.product_name,
    customer_name: body.customer_name,
    avatar_customer: body.avatar_customer || null,
    phone: body.phone,
    address: body.address,
    staff: body.staff === undefined ? null : body.staff,
    total_price: body.total_price === undefined ? null : body.total_price,
    status: body.status || 'pending',
    note: body.note || null,
  });

  const data = presentOrder(order);
  realtimeService.emitToRoom(`user:${userId}`, 'order.created', { order: data });

  return { status: 201, body: { success: true, data } };
}

async function listOrders(userId, query) {
  const pagination = getPagination(query);

  if (pagination.error) {
    return pagination.error;
  }

  const where = buildOrderFilters(userId, query);
  const total = await Order.count({ where });
  const orders = await Order.findAll({
    where,
    order: [['created_at', 'DESC']],
    limit: pagination.limit,
    offset: pagination.offset,
  });

  return {
    status: 200,
    body: {
      success: true,
      data: { orders: orders.map(presentOrder) },
      pagination: paginationMeta(pagination.page, pagination.limit, total),
    },
  };
}

async function getOrder(userId, orderId) {
  const order = await Order.findOne({ where: { id: orderId, user_id: userId } });

  if (!order) {
    return notFoundResponse();
  }

  return { status: 200, body: { success: true, data: presentOrder(order) } };
}

async function updateOrder(userId, orderId, body) {
  if (hasInvalidStatus(body.status)) {
    return invalidStatusResponse();
  }

  const order = await Order.findOne({ where: { id: orderId, user_id: userId } });

  if (!order) {
    return notFoundResponse();
  }

  await order.update({ ...pickOrderFields(body), updated_at: new Date() });

  const data = presentOrder(order);
  realtimeService.emitToRoom(`user:${userId}`, 'order.updated', { order: data });

  return { status: 200, body: { success: true, data } };
}

async function deleteOrder(userId, orderId) {
  const order = await Order.findOne({ where: { id: orderId, user_id: userId } });

  if (!order) {
    return notFoundResponse();
  }

  await order.destroy();
  realtimeService.emitToRoom(`user:${userId}`, 'order.deleted', { order: { id: order.id } });

  return { status: 200, body: { success: true } };
}

module.exports = {
  createOrder,
  listOrders,
  getOrder,
  updateOrder,
  deleteOrder,
};
