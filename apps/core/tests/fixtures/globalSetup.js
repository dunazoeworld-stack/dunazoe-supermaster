module.exports = async function globalSetup() {
  process.env.NODE_ENV = "test";
  process.env.JWT_SECRET = "test_jwt_secret_minimum_32_characters_ok";
  process.env.REFRESH_SECRET = "test_refresh_secret_32_characters_ok";
  process.env.INTERNAL_SECRET = "test_internal_secret_32_characters_ok";
  process.env.LOG_LEVEL = "error";
  console.log("\n🧪 DUNAZOE OS — Test Suite Starting");
};
