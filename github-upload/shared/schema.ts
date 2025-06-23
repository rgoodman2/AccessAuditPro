import { pgTable, text, serial, integer, timestamp, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
});

export const scans = pgTable("scans", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),
  url: text("url").notNull(),
  status: text("status").notNull(), // pending, completed, failed
  reportUrl: text("report_url"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  // Screenshot is handled in the code, not in the database schema
});

// New table for report settings
export const reportSettings = pgTable("report_settings", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().unique(),
  companyName: text("company_name"),
  companyLogo: text("company_logo"), // URL or Base64 encoded image
  contactEmail: text("contact_email"),
  contactPhone: text("contact_phone"),
  websiteUrl: text("website_url"),
  colors: jsonb("colors"), // JSON object with theme colors
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertUserSchema = createInsertSchema(users).pick({
  username: true,
  password: true,
});

export const insertScanSchema = createInsertSchema(scans).pick({
  url: true,
});

export const reportSettingsSchema = createInsertSchema(reportSettings)
  .omit({ id: true, userId: true, createdAt: true, updatedAt: true })
  .extend({
    colors: z.object({
      primary: z.string().optional(),
      secondary: z.string().optional(),
      accent: z.string().optional(),
      textPrimary: z.string().optional(),
      textSecondary: z.string().optional(),
      background: z.string().optional(),
    }).optional(),
  });

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;
// Define custom Scan type to handle schema changes
export interface Scan {
  id: number;
  userId: number;
  url: string;
  status: string;
  reportUrl: string | null;
  createdAt: Date;
  // Screenshot is handled outside the database
}
export type InsertScan = z.infer<typeof insertScanSchema>;
export type ReportSettings = typeof reportSettings.$inferSelect;
export type InsertReportSettings = z.infer<typeof reportSettingsSchema>;
