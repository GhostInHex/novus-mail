import { drizzle } from "drizzle-orm/postgres-js";
import type { Sql } from "postgres";

import * as schema from "@/server/db/schema";

export function createDrizzleDb(client: Sql) {
  return drizzle(client, { schema });
}

export type AppDrizzleDatabase = ReturnType<typeof createDrizzleDb>;
export { schema };
