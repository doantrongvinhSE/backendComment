function toPublicUser(user) {
  return {
    id: user.id,
    username: user.username,
    name: user.name,
    role: user.role,
    parent_user_id: user.parent_user_id ?? null,
    permissions: user.role === 'EMPLOYEE' ? (user.permissions || {}) : null,
    post_limit: user.post_limit,
    is_active: user.is_active,
    created_at: user.created_at,
    updated_at: user.updated_at,
  };
}

module.exports = { toPublicUser };
