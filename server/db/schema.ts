import { relations } from "drizzle-orm";
import {
  bigint,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  varchar,
} from "drizzle-orm/pg-core";

export const actionStatusEnum = pgEnum("action_status", [
  "pending",
  "completed",
  "failed",
]);
export const coverageTypeEnum = pgEnum("coverage_type", ["full", "percent"]);
export const recurrenceEnum = pgEnum("recurrence", [
  "one_time_per_user",
  "per_request",
]);

export const sponsors = pgTable("sponsors", {
  id: text("id").primaryKey(),
  walletAddress: varchar("wallet_address", { length: 255 }).notNull().unique(),
  balance: bigint("balance", { mode: "bigint" }).notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const actions = pgTable("actions", {
  id: text("id").primaryKey(),
  sponsorId: text("sponsor_id")
    .notNull()
    .references(() => sponsors.id, { onDelete: "cascade" }),
  pluginId: varchar("plugin_id", { length: 100 }).notNull(),
  config: jsonb("config").notNull().$type<Record<string, any>>(),
  coverageType: coverageTypeEnum("coverage_type").notNull(),
  coveragePercent: bigint("coverage_percent", { mode: "number" }),
  recurrence: recurrenceEnum("recurrence").notNull(),
  max_redemption_price: bigint("max_redemption_price", {
    mode: "bigint",
  }).notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const redemptions = pgTable("redemptions", {
  id: text("id").primaryKey(),
  actionId: text("action_id")
    .notNull()
    .references(() => actions.id, { onDelete: "cascade" }),
  userId: varchar("user_id", { length: 255 }).notNull(),
  resourceId: varchar("resource_id", { length: 500 }).notNull(),
  instanceId: varchar("instance_id", { length: 255 }).notNull(),
  status: actionStatusEnum("status").notNull().default("pending"),
  sponsored_amount: bigint("sponsored_amount", { mode: "bigint" }).notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  completedAt: timestamp("completed_at"),
});

export const sponsorsRelations = relations(sponsors, ({ many }) => ({
  actions: many(actions),
}));

export const actionsRelations = relations(actions, ({ one, many }) => ({
  sponsor: one(sponsors, {
    fields: [actions.sponsorId],
    references: [sponsors.id],
  }),
  redemptions: many(redemptions),
}));

export const redemptionsRelations = relations(redemptions, ({ one }) => ({
  action: one(actions, {
    fields: [redemptions.actionId],
    references: [actions.id],
  }),
}));
