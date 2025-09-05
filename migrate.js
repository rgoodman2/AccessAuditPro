// Simple database migration script
import { db } from './server/db.js';
import { reportSettings, scans, users } from './shared/schema.js';

async function migrate() {
  try {
    console.log('Creating tables if they don\'t exist...');
    
    // Create users table (if it doesn't exist)
    await db.execute(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        username TEXT NOT NULL UNIQUE,
        password TEXT NOT NULL
      );
    `);
    
    // Create scans table (if it doesn't exist)
    await db.execute(`
      CREATE TABLE IF NOT EXISTS scans (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL,
        url TEXT NOT NULL,
        status TEXT NOT NULL,
        report_url TEXT,
        screenshot TEXT,
        created_at TIMESTAMP NOT NULL DEFAULT NOW()
      );
    `);
    
    // Create report_settings table (if it doesn't exist)
    await db.execute(`
      CREATE TABLE IF NOT EXISTS report_settings (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL UNIQUE,
        company_name TEXT,
        company_logo TEXT,
        contact_email TEXT,
        contact_phone TEXT,
        website_url TEXT,
        colors JSONB,
        created_at TIMESTAMP NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMP NOT NULL DEFAULT NOW()
      );
    `);
    
    console.log('Migration completed successfully.');
  } catch (error) {
    console.error('Migration failed:', error);
  } finally {
    process.exit(0);
  }
}

migrate();