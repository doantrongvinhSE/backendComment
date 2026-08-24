const { getPool } = require('../config/mysqlPool');

// Trần số dòng trả về mỗi request, tránh bị lạm dụng (DoS/scraping) khi client
// truyền limit rất lớn. Địa chỉ dùng lazy-load theo cấp (tỉnh/huyện/xã) nên 100
// là dư sức cho mọi cấp.
const MAX_ADDRESS_LIMIT = 100;

function toEpochMs(value) {
  if (value === null || value === undefined) return null;
  const date = value instanceof Date ? value : new Date(value);
  return date.getTime();
}

function mapRow(row) {
  return {
    created_at: toEpochMs(row.created_at),
    updated_at: toEpochMs(row.updated_at),
    id: String(row.id),
    name: row.name,
    parent_id: row.parent_id === null ? null : String(row.parent_id),
    keysearch: row.keysearch || '',
    keysearch_normal: row.keysearch_normal || '',
    ghn_id: row.ghn_id || '',
  };
}

async function list(req, res, next) {
  try {
    let where = {};
    if (req.query.where) {
      try {
        where = JSON.parse(req.query.where);
      } catch (err) {
        return res.status(400).json({ message: 'Invalid where param' });
      }
    }

    const limit = Math.max(1, Math.min(MAX_ADDRESS_LIMIT, parseInt(req.query.limit, 10) || MAX_ADDRESS_LIMIT));

    let sql = 'SELECT * FROM locations WHERE ';
    const params = [];

    if (Object.prototype.hasOwnProperty.call(where, 'parent_id')) {
      if (where.parent_id === null) {
        sql += 'parent_id IS NULL';
      } else {
        sql += 'parent_id = ?';
        params.push(where.parent_id);
      }
    } else {
      sql += '1 = 1';
    }

    sql += ' ORDER BY name ASC LIMIT ?';
    params.push(limit);

    const pool = getPool();
    const [rows] = await pool.query(sql, params);

    res.json(rows.map(mapRow));
  } catch (err) {
    next(err);
  }
}

module.exports = { list };
