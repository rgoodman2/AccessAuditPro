import { execSync } from 'child_process';

try {
  console.log('Running database migration...');
  execSync('npx drizzle-kit push --force', { 
    stdio: 'inherit',
    env: { ...process.env, FORCE_COLOR: '0' }
  });
  console.log('Database migration completed successfully.');
} catch (error) {
  console.error('Database migration failed:', error.message);
  process.exit(1);
}