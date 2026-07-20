require('dotenv').config();

const { sequelize } = require('../models');

async function columnExists(columnName) {
  const [rows] = await sequelize.query(
    `SELECT COUNT(*) AS count FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'user_comments' AND COLUMN_NAME = :columnName`,
    { replacements: { columnName } },
  );
  return Number(rows[0].count) > 0;
}

const NEW_COLUMNS = [
  ['order_customer_name', 'VARCHAR(255) NULL'],
  ['order_phone', 'VARCHAR(50) NULL'],
  ['order_address', 'VARCHAR(255) NULL'],
  ['order_cod', 'INT NULL'],
  ['order_note', 'TEXT NULL'],
];

async function upgradeCommentOrderInfo() {
  if (sequelize.getDialect() !== 'mysql') {
    throw new Error('Script này chỉ chạy trên MySQL');
  }

  for (const [columnName, definition] of NEW_COLUMNS) {
    if (await columnExists(columnName)) {
      console.log(`Cột ${columnName} đã tồn tại — bỏ qua`);
      continue;
    }

    await sequelize.query(`ALTER TABLE user_comments ADD COLUMN ${columnName} ${definition}`);
    console.log(`Đã thêm cột ${columnName}`);
  }

  console.log('Nâng cấp thông tin đơn trên comment hoàn tất');
}

upgradeCommentOrderInfo()
  .then(async () => {
    await sequelize.close();
  })
  .catch(async (error) => {
    console.error(error.message);
    await sequelize.close();
    process.exit(1);
  });
