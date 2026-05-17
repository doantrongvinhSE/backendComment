describe('database config', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.resetModules();
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  test('đọc cấu hình MySQL từ DATABASE_URL trong .env', () => {
    process.env.NODE_ENV = 'development';
    process.env.DATABASE_URL = 'mysql://root:vvv2002tb@localhost:3306/comment_system';
    delete process.env.DB_NAME;
    delete process.env.DB_USER;
    delete process.env.DB_PASSWORD;

    const sequelize = require('./config/database');

    expect(sequelize.getDialect()).toBe('mysql');
    expect(sequelize.config.database).toBe('comment_system');
    expect(sequelize.config.username).toBe('root');
    expect(sequelize.config.password).toBe('vvv2002tb');
    expect(sequelize.config.host).toBe('localhost');
    expect(sequelize.config.port).toBe('3306');

    return sequelize.close();
  });
});
