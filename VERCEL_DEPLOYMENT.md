# Vercel Deployment Guide

## Prerequisites
1. GitHub account with your code repository
2. Vercel account (linked to GitHub)
3. Database setup (Vercel Postgres or external)

## Step 1: Push Code to GitHub
1. Create a new repository on GitHub
2. Push your current code to the repository:
   ```bash
   git init
   git add .
   git commit -m "Initial commit"
   git remote add origin https://github.com/yourusername/accessibility-scanner.git
   git push -u origin main
   ```

## Step 2: Deploy to Vercel
1. Go to [vercel.com](https://vercel.com) and sign in
2. Click "New Project"
3. Import your GitHub repository
4. Vercel will auto-detect the framework settings
5. Click "Deploy"

## Step 3: Set Up Database
### Option A: Vercel Postgres (Recommended)
1. In your Vercel project dashboard, go to "Storage"
2. Click "Create Database" → "Postgres"
3. This will automatically set POSTGRES_URL environment variable

### Option B: External Database
1. Use your existing database provider
2. Add DATABASE_URL to environment variables in Vercel

## Step 4: Configure Environment Variables
In Vercel project settings → Environment Variables, add:
- `SESSION_SECRET` (generate a random string)
- `NODE_ENV` = `production`
- Database URL (automatically set if using Vercel Postgres)

## Step 5: Run Database Migration
After deployment, run the migration:
1. Go to Vercel project → Functions tab
2. Or use Vercel CLI: `vercel env pull` then `npm run db:push`

## Step 6: Test Your Application
Your app will be available at: `https://your-project-name.vercel.app`

## Features That Will Work on Vercel:
✅ External website scanning (no network restrictions)
✅ Lighthouse integration
✅ PDF report generation
✅ User authentication
✅ Database persistence
✅ Real Shopify site scanning

## Next Steps:
- Test scanning external Shopify websites
- Connect to your existing Shopify store
- Set up custom domain if desired