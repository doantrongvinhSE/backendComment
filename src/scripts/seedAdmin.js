require('dotenv').config();

const bcrypt = require('bcrypt');
const { sequelize, User } = require('../models');

async function seedAdmin() {
  const username = process.env.ADMIN_USERNAME;
  const password = process.env.ADMIN_PASSWORD;
  const name = process.env.ADMIN_NAME || 'Admin';

  if (!username || !password) {
    throw new Error('Thiếu ADMIN_USERNAME hoặc ADMIN_PASSWORD trong .env');
  }

  await sequelize.sync();

  const passwordHash = await bcrypt.hash(password, 10);
  const [admin, created] = await User.findOrCreate({
    where: { username },
    defaults: {
      username,
      password_hash: passwordHash,
      name,
      role: 'ADMIN',
      is_active: true,
    },
  });

  if (!created) {
    await admin.update({
      password_hash: passwordHash,
      name,
      role: 'ADMIN',
      is_active: true,
      updated_at: new Date(),
    });
  }

  console.log(created ? 'Đã tạo admin' : 'Đã cập nhật admin');
}

seedAdmin()
  .then(async () => {
    await sequelize.close();
  })
  .catch(async (error) => {
    console.error(error.message);
    await sequelize.close();
    process.exit(1);
  });
