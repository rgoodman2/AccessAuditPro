import { users, scans, reportSettings, type User, type InsertUser, type Scan, type InsertScan, type ReportSettings, type InsertReportSettings } from "@shared/schema";
import { db } from "./db";
import { eq } from "drizzle-orm";
import session from "express-session";
import connectPg from "connect-pg-simple";
import { pool } from "./db";

const PostgresSessionStore = connectPg(session);

export interface IStorage {
  getUser(id: number): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  createScan(userId: number, scan: InsertScan): Promise<Scan>;
  getUserScans(userId: number): Promise<Scan[]>;
  updateScanStatus(scanId: number, status: string, reportUrl?: string): Promise<void>;
  getReportSettings(userId: number): Promise<ReportSettings | undefined>;
  saveReportSettings(userId: number, settings: InsertReportSettings): Promise<ReportSettings>;
  sessionStore: session.Store;
}

export class DatabaseStorage implements IStorage {
  sessionStore: session.Store;

  constructor() {
    this.sessionStore = new PostgresSessionStore({
      pool,
      createTableIfMissing: true,
    });
  }

  async getUser(id: number): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.username, username));
    return user;
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const [user] = await db.insert(users).values(insertUser).returning();
    return user;
  }

  async createScan(userId: number, scan: InsertScan): Promise<Scan> {
    // Explicitly define what columns to insert to avoid schema mismatch
    const [newScan] = await db
      .insert(scans)
      .values({
        url: scan.url,
        userId,
        status: "pending",
      })
      .returning({
        id: scans.id,
        userId: scans.userId,
        url: scans.url,
        status: scans.status,
        reportUrl: scans.reportUrl,
        createdAt: scans.createdAt
      });
    return newScan;
  }

  async getUserScans(userId: number): Promise<Scan[]> {
    // Temporarily handle the missing screenshot column by selecting explicit columns
    return await db.select({
      id: scans.id,
      userId: scans.userId,
      url: scans.url,
      status: scans.status,
      reportUrl: scans.reportUrl,
      createdAt: scans.createdAt
    }).from(scans).where(eq(scans.userId, userId));
  }

  async updateScanStatus(scanId: number, status: string, reportUrl?: string): Promise<void> {
    await db
      .update(scans)
      .set({ status, reportUrl })
      .where(eq(scans.id, scanId));
  }
  
  async getReportSettings(userId: number): Promise<ReportSettings | undefined> {
    const [settings] = await db
      .select()
      .from(reportSettings)
      .where(eq(reportSettings.userId, userId));
    
    return settings;
  }
  
  async saveReportSettings(userId: number, settings: InsertReportSettings): Promise<ReportSettings> {
    // Check if settings already exist for this user
    const existingSettings = await this.getReportSettings(userId);
    
    if (existingSettings) {
      // Update existing settings
      const [updated] = await db
        .update(reportSettings)
        .set({
          ...settings,
          updatedAt: new Date()
        })
        .where(eq(reportSettings.userId, userId))
        .returning();
      
      return updated;
    } else {
      // Create new settings
      const [newSettings] = await db
        .insert(reportSettings)
        .values({
          ...settings,
          userId
        })
        .returning();
      
      return newSettings;
    }
  }
}

export const storage = new DatabaseStorage();