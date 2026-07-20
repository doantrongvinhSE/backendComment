require('dotenv').config();

const { sequelize } = require('../models');

async function tableExists(tableName) {
  const [rows] = await sequelize.query(
    `SELECT COUNT(*) AS count FROM information_schema.TABLES
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = :tableName`,
    { replacements: { tableName } },
  );
  return Number(rows[0].count) > 0;
}

async function upgradeMaintenanceState() {
  if (sequelize.getDialect() !== 'mysql') {
    throw new Error('Script này chỉ chạy trên MySQL');
  }

  if (!(await tableExists('maintenance_states'))) {
    await sequelize.query(`
      CREATE TABLE maintenance_states (
        id INT UNSIGNED PRIMARY KEY,
        is_enabled TINYINT(1) NOT NULL DEFAULT 0,
        message TEXT NULL,
        updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('Đã tạo bảng maintenance_states');
  } else {
    console.log('Bảng maintenance_states đã tồn tại — bỏ qua');
  }

  await sequelize.query(
    'INSERT IGNORE INTO maintenance_states (id, is_enabled, message) VALUES (1, 0, NULL)',
  );
  console.log('Đã đảm bảo dòng cấu hình bảo trì mặc định (id=1)');

  console.log('Nâng cấp maintenance_states hoàn tất');
}

upgradeMaintenanceState()
  .then(async () => {
    await sequelize.close();
  })
  .catch(async (error) => {
    console.error(error.message);
    await sequelize.close();
    process.exit(1);
  });
