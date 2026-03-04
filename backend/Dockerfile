# Backend Dockerfile - Multi-stage build
# Stage 1: Build the application
FROM node:20-alpine AS builder

# Install build dependencies for better-sqlite3
RUN apk add --no-cache python3 make g++

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install all dependencies (including devDependencies for TypeScript compiler)
RUN npm ci && npm cache clean --force

# Copy source code
COPY . .

# Build TypeScript to JavaScript
RUN npm run build

# Copy SQL schema files to dist (TypeScript compiler doesn't copy non-TS files)
RUN cp -r src/db/*.sql dist/db/ 2>/dev/null || true

# Stage 2: Production image
FROM node:20-alpine

# Install runtime dependencies for better-sqlite3
RUN apk add --no-cache python3 make g++

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install production dependencies only
RUN npm ci --omit=dev && npm cache clean --force

# Copy built application from builder stage
COPY --from=builder /app/dist ./dist

# Create data directory
RUN mkdir -p /app/data

# Default database path (persisted via volume mount)
ENV DB_PATH=/app/data/monitor.db

# Expose port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3000/api/services || exit 1

# Start the application
CMD ["node", "dist/app.js"]
