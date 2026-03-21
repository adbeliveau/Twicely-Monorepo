import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error('DATABASE_URL environment variable is not set');
}

const client = postgres(connectionString, {
  connect_timeout: 30,
  idle_timeout: 20,
  max_lifetime: 60 * 30,
  max: 20,
});

export const db = drizzle(client);
