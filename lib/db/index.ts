import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema';

let _db: ReturnType<typeof drizzle> | null = null;

function getDb() {
  if (!_db) {
    const connectionString = process.env.DATABASE_URL!;
    const client = postgres(connectionString, {
      max: 3,
      idle_timeout: 10,
      connect_timeout: 10,
      connection: {
        TimeZone: 'UTC', // defaultNow() 등 DB 함수가 UTC 기준으로 동작하도록
      },
    });
    _db = drizzle(client, { schema });
  }
  return _db;
}

export const db = new Proxy({} as ReturnType<typeof drizzle>, {
  get(_, prop) {
    return (getDb() as unknown as Record<string | symbol, unknown>)[prop];
  },
});
