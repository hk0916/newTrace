import { pgTable, varchar, timestamp } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

// public 스키마: 전체 공용 테이블 (회사/사용자 등록 정보)

export const companies = pgTable('companies', {
  id: varchar('id', { length: 50 }).primaryKey(),
  name: varchar('name', { length: 255 }).notNull(),
  dashboardMapId: varchar('dashboard_map_id', { length: 50 }),
  timezone: varchar('timezone', { length: 50 }).default('browser').notNull(),
  locationMode: varchar('location_mode', { length: 20 }).default('realtime').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const users = pgTable('users', {
  id: varchar('id', { length: 50 }).primaryKey(),
  email: varchar('email', { length: 255 }).notNull().unique(),
  name: varchar('name', { length: 255 }),
  password: varchar('password', { length: 255 }),
  companyId: varchar('company_id', { length: 50 }).references(() => companies.id),
  role: varchar('role', { length: 50 }).default('user').notNull(),
  locale: varchar('locale', { length: 10 }).default('ko').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const companiesRelations = relations(companies, ({ many }) => ({
  users: many(users),
}));

export const usersRelations = relations(users, ({ one }) => ({
  company: one(companies, {
    fields: [users.companyId],
    references: [companies.id],
  }),
}));
