const { Saler } = require('../models');

function presentSaler(saler) {
  return {
    id: saler.id,
    name_saler: saler.name_saler,
    username_saler: saler.username_saler,
  };
}

async function listSalers(userId) {
  const salers = await Saler.findAll({
    where: { user_id: userId },
    order: [['id', 'ASC']],
  });

  return {
    status: 200,
    body: {
      success: true,
      data: { salers: salers.map(presentSaler) },
    },
  };
}

module.exports = {
  listSalers,
};
