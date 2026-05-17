function invalidPaginationResponse() {
  return { status: 400, body: { success: false, message: 'Tham số phân trang không hợp lệ' } };
}

function parsePositiveInteger(value) {
  if (value === undefined) return null;

  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

function getPagination(query = {}) {
  const page = query.page === undefined ? 1 : parsePositiveInteger(query.page);
  const limit = query.limit === undefined ? 20 : parsePositiveInteger(query.limit);

  if (!page || !limit) {
    return { error: invalidPaginationResponse() };
  }

  return {
    page,
    limit,
    offset: (page - 1) * limit,
  };
}

function paginationMeta(page, limit, total) {
  return {
    page,
    limit,
    total,
    total_pages: Math.ceil(total / limit),
  };
}

module.exports = {
  getPagination,
  paginationMeta,
};
