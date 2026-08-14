const fs = require("fs");
const path = require("path");
const { Client } = require("pg");

const file = process.argv[2];
if (!file) {
  console.error("Usage: node apply-migration.js <path-to-sql>");
  process.exit(1);
}

const env = fs.readFileSync(".env.local", "utf8");
const client = new Client({
  host: "aws-0-ap-south-1.pooler.supabase.com",
  port: 6543,
  user: "postgres.rexaqijehyhxfpvdbryf",
  password: "Altamash123+",
  database: "postgres",
});

async function main() {
  await client.connect();
  const sql = fs.readFileSync(path.resolve(file), "utf8");
  await client.query(sql);
  console.log(`Applied ${file}`);
  await client.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
