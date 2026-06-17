import "dotenv/config";
import postgres from "postgres";

function getDatabaseUrl() {
  const databaseUrl = process.env.DATABASE_URL?.trim();
  if (!databaseUrl) {
    console.error("Error: DATABASE_URL is missing from your environment configuration.");
    process.exit(1);
  }

  return databaseUrl;
}

async function clearOldKeys() {
  console.log("Connecting to database to reset Corsair keys...");

  const sql = postgres(getDatabaseUrl(), { max: 1 });

  try {
    await sql`TRUNCATE TABLE corsair_integrations CASCADE;`;
    await sql`TRUNCATE TABLE corsair_accounts CASCADE;`;
    await sql.end();

    console.log("Success! Mismatched database state wiped out completely.");
    process.exit(0);
  } catch (error) {
    await sql.end().catch(() => undefined);
    console.error("Failed to clear tables:", error);
    process.exit(1);
  }
}

clearOldKeys();
