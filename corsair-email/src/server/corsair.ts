import { Pool } from "pg";
import { createCorsair } from "corsair";
import { gmail } from "@corsair-dev/gmail";
import { googlecalendar } from "@corsair-dev/googlecalendar";

const pool = new Pool({
	connectionString: process.env.DATABASE_URL,
});

export const corsair = createCorsair({
	database: pool,
	kek: process.env.CORSAIR_KEK!, // <-- Add this line to satisfy the TypeScript definition
	plugins: [gmail(), googlecalendar()],
});

export async function getCorsair() {
	return corsair;
}
