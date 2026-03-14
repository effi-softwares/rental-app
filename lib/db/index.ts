import { neonConfig, Pool } from "@neondatabase/serverless"
import { drizzle } from "drizzle-orm/neon-serverless"
import ws from "ws"

const databaseUrl = process.env.DATABASE_URL

if (!databaseUrl) {
	throw new Error("DATABASE_URL is not set")
}

neonConfig.webSocketConstructor = ws

const pool = new Pool({
	connectionString: databaseUrl,
})

export const db = drizzle({ client: pool })

export type Database = typeof db
