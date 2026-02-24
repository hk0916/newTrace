import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as publicSchema from './schema-public';

let _db: ReturnType<typeof drizzle> | null = null;

function getDb() {
  if (!_db) {
    const connectionString = process.env.DATABASE_URL!;
    const client = postgres(connectionString, {
      max: 10,
      idle_timeout: 10,
      connect_timeout: 10,
      connection: {
        TimeZone: 'UTC',
      },
    });
    _db = drizzle(client, { schema: publicSchema });
  }
  return _db;
}

export const db = new Proxy({} as ReturnType<typeof drizzle>, {
  get(_, prop) {
    return (getDb() as unknown as Record<string | symbol, unknown>)[prop];
  },
});

// public 스키마 테이블 직접 export (companies, users)
export * from './schema-public';

// 회사별 스키마 팩토리 export
export { getCompanyTables } from './schema-company';
export type { CompanyTables } from './schema-company';
