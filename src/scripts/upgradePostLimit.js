require('dotenv').config();

const { sequelize } = require('../models');

async function columnExists(columnName) {
  const [rows] = await sequelize.query(
    `SELECT COUNT(*) AS count FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'users' AND COLUMN_NAME = :columnName`,
    { replacements: { columnName } },
  );
  return Number(rows[0].count) > 0;
}

async function upgradePostLimit() {
  if (sequelize.getDialect() !== 'mysql') {
    throw new Error('Script này chỉ chạy trên MySQL');
  }

  if (!(await columnExists('post_limit'))) {
    await sequelize.query(
      'ALTER TABLE users ADD COLUMN post_limit INT UNSIGNED NOT NULL DEFAULT 100',
    );
    console.log('Đã thêm cột post_limit');
  } else {
    console.log('Cột post_limit đã tồn tại — bỏ qua');
  }

  console.log('Nâng cấp post_limit hoàn tất');
}

upgradePostLimit()
  .then(async () => {
    await sequelize.close();
  })
  .catch(async (error) => {
    console.error(error.message);
    await sequelize.close();
    process.exit(1);
  });
