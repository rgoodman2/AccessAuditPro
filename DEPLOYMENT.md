# AccessScan Deployment Guide

This document provides instructions for deploying the AccessScan web accessibility audit application to a production environment.

## Prerequisites

- Docker and Docker Compose installed on your server
- A domain name pointing to your server (optional but recommended)
- PostgreSQL database (can be hosted on the same server or externally)

## Environment Variables

Create a `.env` file in the root of the project with the following variables:

```
# Database connection
DATABASE_URL=postgresql://username:password@host:port/database
PGUSER=username
PGPASSWORD=password
PGHOST=host
PGPORT=port
PGDATABASE=database

# Session configuration
SESSION_SECRET=your_secure_random_string

# Server configuration
NODE_ENV=production
PORT=5000
```

## Deployment Steps

### 1. Clone the Repository

```bash
git clone <repository-url>
cd <repository-directory>
```

### 2. Build and Start the Docker Container

```bash
docker build -t accessscan .
docker run -d -p 5000:5000 --env-file .env --name accessscan accessscan
```

Alternatively, if you have a Docker Compose file:

```bash
docker-compose up -d
```

### 3. Set Up a Reverse Proxy (Optional but Recommended)

For production deployments, we recommend using Nginx or similar as a reverse proxy with SSL/TLS enabled.

Example Nginx configuration:

```nginx
server {
    listen 80;
    server_name yourdomain.com;
    
    # Redirect to HTTPS
    location / {
        return 301 https://$host$request_uri;
    }
}

server {
    listen 443 ssl;
    server_name yourdomain.com;
    
    ssl_certificate /path/to/fullchain.pem;
    ssl_certificate_key /path/to/privkey.pem;
    
    location / {
        proxy_pass http://localhost:5000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

### 4. Database Migration

The application will automatically create the necessary database tables on first run. No manual migration is required.

## Scaling Considerations

For high-traffic deployments:

1. **Load Balancing**: Use a load balancer to distribute traffic across multiple instances.
2. **Database Scaling**: Consider using a managed PostgreSQL service or a replicated database setup.
3. **Memory/CPU**: Increase container resources for higher performance with concurrent scans.

## Monitoring

Consider setting up monitoring using tools like:

- Prometheus and Grafana for metrics
- ELK Stack for logging
- Uptime checks to ensure the service is available

## Troubleshooting

Common issues and solutions:

1. **Database Connection Issues**: Verify your DATABASE_URL and connectivity.
2. **Memory Issues**: If you're scanning large websites, you may need to increase the container memory limit.
3. **Missing Reports Directory**: Ensure the reports directory exists and is writable.

## Security Considerations

1. Always use HTTPS in production
2. Keep your SESSION_SECRET secure and unique
3. Regularly update dependencies with `npm audit fix`
4. Consider implementing rate limiting for the scan API endpoint

## Additional Resources

If you need further assistance or would like to report issues, please create a GitHub issue or contact the maintenance team.