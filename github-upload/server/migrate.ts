import { pool, db } from './db';
import { sql } from 'drizzle-orm';

async function migrate() {
  console.log('Starting database migration...');
  
  try {
    // Check if screenshot column exists in scans table
    const checkScreenshotQuery = await db.execute(sql`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'scans' AND column_name = 'screenshot'
    `);
    
    // If screenshot column doesn't exist, add it
    if (checkScreenshotQuery.length === 0) {
      console.log('Adding screenshot column to scans table...');
      await db.execute(sql`
        ALTER TABLE scans
        ADD COLUMN screenshot TEXT
      `);
      console.log('Screenshot column added successfully');
    } else {
      console.log('Screenshot column already exists');
    }
    
    // Check if report_settings table exists
    const checkReportSettingsQuery = await db.execute(sql`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_name = 'report_settings'
    `);
    
    // If report_settings table doesn't exist, create it
    if (checkReportSettingsQuery.length === 0) {
      console.log('Creating report_settings table...');
      await db.execute(sql`
        CREATE TABLE report_settings (
          id SERIAL PRIMARY KEY,
          user_id INTEGER NOT NULL UNIQUE REFERENCES users(id),
          company_name TEXT,
          company_logo TEXT,
          contact_email TEXT,
          contact_phone TEXT,
          website_url TEXT,
          colors JSONB,
          created_at TIMESTAMP NOT NULL DEFAULT NOW(),
          updated_at TIMESTAMP NOT NULL DEFAULT NOW()
        )
      `);
      console.log('Report settings table created successfully');
    } else {
      console.log('Report settings table already exists');
    }
    
    console.log('Migration completed successfully');
  } catch (error) {
    console.error('Migration failed:', error);
  } finally {
    await pool.end();
  }
}

migrate().catch(console.error);