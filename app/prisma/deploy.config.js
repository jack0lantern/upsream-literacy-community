const path = require("path");

// Minimal config for `prisma migrate deploy` in production.
// Reads DATABASE_URL directly from the environment.
module.exports = {
  schema: path.join(__dirname, "schema.prisma"),
  datasource: { url: process.env.DATABASE_URL },
};
