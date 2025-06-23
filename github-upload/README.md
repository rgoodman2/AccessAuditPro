# AccessAuditPro

A professional web accessibility audit application that helps ensure websites meet WCAG 2.1 compliance standards.

## Features

- Comprehensive accessibility scanning using axe-core
- Detailed PDF reports with screenshots
- Customizable branding options
- User authentication and scan history
- Professional dashboard interface

## Tech Stack

- **Frontend**: React 18 with TypeScript, Tailwind CSS
- **Backend**: Node.js with Express, PostgreSQL
- **Scanning**: Axe-core, Lighthouse CLI integration
- **Reports**: PDFKit for professional PDF generation

## Deployment

This application is configured for Railway deployment with PostgreSQL database support.

## Setup

1. Install dependencies: `npm install`
2. Set up database with DATABASE_URL environment variable
3. Run development server: `npm run dev`
4. Build for production: `npm run build`

## Environment Variables

- `DATABASE_URL` - PostgreSQL connection string
- `SESSION_SECRET` - Secret for session management
- `NODE_ENV` - Environment (development/production)