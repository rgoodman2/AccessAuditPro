import { users, scans, type User, type InsertUser, type Scan, type InsertScan } from "@shared/schema";
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
    const [newScan] = await db
      .insert(scans)
      .values({
        ...scan,
        userId,
        status: "pending",
      })
      .returning();
    return newScan;
  }

  async getUserScans(userId: number): Promise<Scan[]> {
    return await db.select().from(scans).where(eq(scans.userId, userId));
  }

  async updateScanStatus(scanId: number, status: string, reportUrl?: string): Promise<void> {
    await db
      .update(scans)
      .set({ status, reportUrl })
      .where(eq(scans.id, scanId));
  }
}

export const storage = new DatabaseStorage();