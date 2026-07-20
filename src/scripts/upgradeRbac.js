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

async function constraintExists(constraintName) {
  const [rows] = await sequelize.query(
    `SELECT COUNT(*) AS count FROM information_schema.TABLE_CONSTRAINTS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'users' AND CONSTRAINT_NAME = :constraintName`,
    { replacements: { constraintName } },
  );
  return Number(rows[0].count) > 0;
}

async function indexExists(indexName) {
  const [rows] = await sequelize.query(
    `SELECT COUNT(*) AS count FROM information_schema.STATISTICS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'users' AND INDEX_NAME = :indexName`,
    { replacements: { indexName } },
  );
  return Number(rows[0].count) > 0;
}

async function upgradeRbac() {
  if (sequelize.getDialect() !== 'mysql') {
    throw new Error('Script này chỉ chạy trên MySQL');
  }

  await sequelize.query(
    "ALTER TABLE users MODIFY role ENUM('ADMIN','USER','EMPLOYEE') NOT NULL DEFAULT 'USER'",
  );
  console.log("Đã cập nhật ENUM role (thêm 'EMPLOYEE')");

  if (!(await columnExists('parent_user_id'))) {
    await sequelize.query('ALTER TABLE users ADD COLUMN parent_user_id INT UNSIGNED NULL');
    console.log('Đã thêm cột parent_user_id');
  } else {
    console.log('Cột parent_user_id đã tồn tại — bỏ qua');
  }

  if (!(await columnExists('permissions'))) {
    await sequelize.query('ALTER TABLE users ADD COLUMN permissions JSON NULL');
    console.log('Đã thêm cột permissions');
  } else {
    console.log('Cột permissions đã tồn tại — bỏ qua');
  }

  if (!(await constraintExists('fk_users_parent_user'))) {
    await sequelize.query(
      `ALTER TABLE users ADD CONSTRAINT fk_users_parent_user
       FOREIGN KEY (parent_user_id) REFERENCES users(id)
       ON DELETE RESTRICT ON UPDATE RESTRICT`,
    );
    console.log('Đã thêm FK fk_users_parent_user');
  } else {
    console.log('FK fk_users_parent_user đã tồn tại — bỏ qua');
  }

  if (!(await indexExists('idx_users_parent_user_id'))) {
    await sequelize.query('ALTER TABLE users ADD INDEX idx_users_parent_user_id (parent_user_id)');
    console.log('Đã thêm index idx_users_parent_user_id');
  } else {
    console.log('Index idx_users_parent_user_id đã tồn tại — bỏ qua');
  }

  console.log('Nâng cấp RBAC hoàn tất');
}

upgradeRbac()
  .then(async () => {
    await sequelize.close();
  })
  .catch(async (error) => {
    console.error(error.message);
    await sequelize.close();
    process.exit(1);
  });
