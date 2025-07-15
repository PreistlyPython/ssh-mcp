# SSH-MCP Docker Container
# Multi-stage build for production-ready SSH-MCP deployment
# 
# Author: Andre (OptinampOut) with Claude Code assistance
# Organization: LYFTIUM-INC
# Date: July 15, 2025

# Build stage
FROM node:18-alpine AS builder

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./
COPY tsconfig.json ./

# Install dependencies
RUN npm ci --only=production

# Copy source code
COPY src/ ./src/

# Build the application
RUN npm run build

# Production stage
FROM node:18-alpine AS production

# Install system dependencies for SSH operations
RUN apk add --no-cache \
    openssh-client \
    bash \
    curl \
    ca-certificates \
    tzdata \
    && rm -rf /var/cache/apk/*

# Create non-root user
RUN addgroup -g 1001 -S sshuser && \
    adduser -S sshuser -u 1001 -G sshuser

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install only production dependencies
RUN npm ci --only=production && \
    npm cache clean --force

# Copy built application from builder stage
COPY --from=builder /app/build ./build

# Create necessary directories
RUN mkdir -p /app/data/memory \
    /app/data/cache \
    /app/logs \
    /app/backups \
    /app/compliance \
    && chown -R sshuser:sshuser /app

# Copy configuration files
COPY .env.example ./.env.example
COPY monitoring/ ./monitoring/

# Health check script
RUN echo '#!/bin/bash' > /usr/local/bin/healthcheck.sh && \
    echo 'curl -f http://localhost:3001/health || exit 1' >> /usr/local/bin/healthcheck.sh && \
    chmod +x /usr/local/bin/healthcheck.sh

# Switch to non-root user
USER sshuser

# Expose ports
EXPOSE 3001 3002

# Environment variables
ENV NODE_ENV=production
ENV LOG_LEVEL=info
ENV REDIS_HOST=redis
ENV PROMETHEUS_PORT=3001
ENV MONITORING_ENABLED=true
ENV SSH_MEMORY_PERSISTENCE=true
ENV SSH_MEMORY_DATA_DIR=/app/data/memory
ENV LOG_FILE_PATH=/app/logs/ssh-mcp.log
ENV AUDIT_LOG_PATH=/app/logs/audit.log
ENV COMPLIANCE_REPORT_PATH=/app/compliance
ENV BACKUP_PATH=/app/backups

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD /usr/local/bin/healthcheck.sh

# Start the application
CMD ["node", "build/index.js"]

# Labels
LABEL \
    org.opencontainers.image.title="SSH-MCP Server" \
    org.opencontainers.image.description="Enterprise-grade SSH MCP server with AI intelligence" \
    org.opencontainers.image.authors="Andre (OptinampOut)" \
    org.opencontainers.image.vendor="LYFTIUM-INC" \
    org.opencontainers.image.version="1.0.0" \
    org.opencontainers.image.url="https://github.com/LYFTIUM-INC/ssh-mcp" \
    org.opencontainers.image.documentation="https://github.com/LYFTIUM-INC/ssh-mcp/blob/main/README.md" \
    org.opencontainers.image.source="https://github.com/LYFTIUM-INC/ssh-mcp.git"