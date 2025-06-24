# AccessScan - Web Accessibility Scanner

## Overview

AccessScan is a professional web accessibility audit application that helps ensure websites meet WCAG 2.1 compliance standards. The application provides comprehensive accessibility scanning, detailed reporting, and customizable branding options for professional use.

## System Architecture

### Frontend Architecture
- **Framework**: React 18 with TypeScript
- **Build Tool**: Vite for fast development and optimized builds
- **Routing**: Wouter for lightweight client-side routing
- **State Management**: TanStack React Query for server state management
- **UI Components**: Custom component library built on Radix UI primitives
- **Styling**: Tailwind CSS with professional theme configuration
- **Form Handling**: React Hook Form with Zod validation

### Backend Architecture
- **Runtime**: Node.js 20 with Express.js server
- **Language**: TypeScript with ES modules
- **Authentication**: Passport.js with local strategy using session-based auth
- **Session Storage**: PostgreSQL-backed session store
- **API Design**: RESTful endpoints with JSON responses

### Data Storage Solutions
- **Primary Database**: PostgreSQL with Drizzle ORM
- **Schema Management**: Drizzle Kit for migrations and schema management
- **Session Storage**: PostgreSQL sessions via connect-pg-simple
- **File Storage**: Local filesystem for reports and screenshots (reports/ directory)

## Key Components

### Authentication System
- Local username/password authentication with bcrypt-style password hashing
- Session-based authentication with secure session management
- Protected routes using higher-order components
- Automatic redirect handling for authenticated/unauthenticated users

### Scanning Engine
- **Primary Scanner**: Axe-core integration with JSDOM for accessibility testing
- **Backup Scanner**: Lighthouse CLI integration for broader compatibility
- **Test Environment**: Local test pages for development and restricted environments
- **Puppeteer Integration**: For screenshot capture and advanced DOM manipulation
- **Fallback Strategy**: Multiple scanning approaches to handle different deployment environments

### Report Generation
- **PDF Generation**: PDFKit for creating professional accessibility reports
- **Customization**: Branded reports with company logos, colors, and contact information
- **Report Types**: Basic accessibility reports and detailed Lighthouse reports
- **File Management**: Automatic report file organization and cleanup

### Database Schema
- **Users Table**: User authentication and profile data
- **Scans Table**: Scan history, status tracking, and report URLs
- **Report Settings Table**: Customizable branding and company information per user

## Data Flow

1. **User Authentication**: Login/register → Session creation → Protected route access
2. **Scan Initiation**: URL submission → Scan creation in database → Asynchronous processing
3. **Scanning Process**: URL validation → Accessibility testing → Screenshot capture → Report generation
4. **Report Delivery**: PDF creation → File storage → Database update → User notification
5. **Report Access**: Scan list retrieval → Report download/viewing

## External Dependencies

### Core Libraries
- **Database**: @neondatabase/serverless, drizzle-orm, pg
- **Authentication**: passport, passport-local, express-session
- **Scanning**: axe-core, lighthouse, jsdom, puppeteer
- **PDF Generation**: pdfkit, canvas
- **Frontend**: react, @tanstack/react-query, @radix-ui/*
- **Validation**: zod, @hookform/resolvers

### Development Dependencies
- **Build Tools**: vite, esbuild, tsx
- **TypeScript**: Full TypeScript support across frontend and backend
- **Styling**: tailwindcss, @replit/vite-plugin-shadcn-theme-json

## Deployment Strategy

### Production Deployment
- **Docker**: Multi-stage build with Node.js 20 slim base image
- **Dependencies**: System packages for Canvas, Puppeteer, and Chromium
- **Environment**: Configurable via environment variables
- **Ports**: Application runs on port 5000

### Platform Support
- **Replit**: Configured for Replit deployment with PostgreSQL module
- **Vercel**: Serverless deployment configuration with Vercel Postgres
- **Docker**: Container-based deployment for any Docker-compatible platform
- **Cloud Run**: Google Cloud Run deployment support

### Environment Configuration
- Database connection via DATABASE_URL or POSTGRES_URL
- Session secret configuration
- Node environment settings
- Port configuration (default 5000)

### Build Process
1. Frontend build via Vite (client → dist/public)
2. Backend build via esbuild (server → dist/index.js)
3. Static asset serving from built frontend
4. Database migration on deployment

## Recent Changes
- June 24, 2025: Fixed database connection issues for Railway deployment:
  - Replaced @neondatabase/serverless with standard pg client
  - Updated Drizzle configuration from neon-serverless to node-postgres
  - Removed WebSocket configuration causing 502 registration errors
  - Added SSL configuration for production database connections
  - Fixed "users" table constraint issue by adding missing username unique constraint
- June 23, 2025: Successfully deployed to Railway after resolving:
  - Added health check endpoint at root path for Railway monitoring
  - Fixed start command in railway.json (removed NODE_ENV prefix)
  - Updated port configuration to use Railway's assigned PORT
  - Fixed environment detection for production static file serving

## Changelog
- June 19, 2025. Initial setup

## User Preferences

Preferred communication style: Simple, everyday language.