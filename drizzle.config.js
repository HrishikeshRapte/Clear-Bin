export default {
    dialect: "postgresql",
    schema: "./utils/db/schema.ts",
    out: "./drizzle",
    dbCredentials: {
      url: process.env.DATABASE_URL,
      connectionString: process.env.DATABASE_URL,
    },
  };






// require('dotenv').config();

// /** @type {import('drizzle-kit').Config} */
// module.exports = {
//     schema: './utils/db/schema.ts',
//     out: './drizzle',
//     dialect: 'postgresql',
//     dbCredentials: {
//       url: process.env.DATABASE_URL,
//       connectionString: process.env.DATABASE_URL,
//     },
    
// };
