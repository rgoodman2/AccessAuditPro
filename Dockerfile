FROM node:20-slim

WORKDIR /app

# Install dependencies for canvas
RUN apt-get update && apt-get install -y \
    build-essential \
    libcairo2-dev \
    libpango1.0-dev \
    libjpeg-dev \
    libgif-dev \
    librsvg2-dev \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy all files
COPY . .

# Build the application
RUN npm run build

# Create reports directory
RUN mkdir -p reports && chmod 755 reports

# Expose the port the app runs on
EXPOSE 5000

# Start the application
CMD ["npm", "start"]