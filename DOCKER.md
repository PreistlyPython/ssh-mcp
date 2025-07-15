# SSH-MCP Docker Deployment Guide

**Author:** Andre (OptinampOut) with Claude Code assistance  
**Organization:** LYFTIUM-INC  
**Date:** July 15, 2025

## 📋 Overview

This guide provides comprehensive instructions for deploying SSH-MCP using Docker containers in production environments. The deployment includes:

- **SSH-MCP Application** - Main server with AI intelligence
- **Redis** - High-performance caching layer
- **Prometheus** - Metrics collection and monitoring
- **Grafana** - Visualization dashboards
- **Alertmanager** - Alert routing and notifications
- **Nginx** - Reverse proxy and load balancing
- **Node Exporter** - System metrics collection
- **Redis Exporter** - Redis metrics collection

## 🚀 Quick Start

### Prerequisites

- Docker 20.10+ and Docker Compose 2.0+
- Minimum 4GB RAM and 10GB disk space
- Linux/macOS system (Windows with WSL2)

### 1. Clone and Setup

```bash
# Clone repository (if not already done)
git clone https://github.com/LYFTIUM-INC/ssh-mcp.git
cd ssh-mcp

# Create environment file
cp .env.example .env
# Edit .env with your configuration
nano .env
```

### 2. Deploy

```bash
# Run automated deployment
./scripts/deploy.sh

# Or manually
docker-compose up -d
```

### 3. Access Services

- **SSH-MCP**: http://localhost:3001
- **Grafana**: http://localhost:3000 (admin/admin)
- **Prometheus**: http://localhost:9090
- **Alertmanager**: http://localhost:9093

## 🔧 Configuration

### Environment Variables

Edit `.env` file with your configuration:

```bash
# Server Configurations
JOEDREAMZ_HOST=your-server.com
JOEDREAMZ_USERNAME=your-username
JOEDREAMZ_PASSWORD=your-password

# Redis Configuration
REDIS_PASSWORD=your-redis-password

# Monitoring
GRAFANA_PASSWORD=your-grafana-password

# AI Services
CONTEXT7_API_KEY=your-context7-key
GITHUB_TOKEN=your-github-token
```

### SSL Certificates

Place your SSL certificates in `nginx/ssl/`:

```bash
# For production, use proper certificates
nginx/ssl/cert.pem
nginx/ssl/key.pem

# Self-signed certificates are generated automatically
```

## 🐳 Services

### SSH-MCP Application

```yaml
# Resource limits
deploy:
  resources:
    limits:
      memory: 2G
      cpus: '1.0'
    reservations:
      memory: 512M
      cpus: '0.5'
```

**Ports:**
- 3001: Main application
- 3002: Metrics endpoint

**Health Check:**
- Endpoint: `/health`
- Interval: 30s
- Timeout: 10s

### Redis Cache

```yaml
# Configuration
command: >
  redis-server /etc/redis/redis.conf
  --requirepass ${REDIS_PASSWORD}
  --appendonly yes
  --maxmemory 256mb
  --maxmemory-policy allkeys-lru
```

**Features:**
- Persistent storage with AOF
- Memory optimization
- Security configuration

### Prometheus

```yaml
# Retention and storage
command:
  - '--storage.tsdb.retention.time=15d'
  - '--storage.tsdb.path=/prometheus'
  - '--web.enable-lifecycle'
```

**Targets:**
- SSH-MCP application
- Node Exporter
- Redis Exporter
- Self-monitoring

### Grafana

```yaml
# Pre-configured dashboard
environment:
  - GF_DASHBOARDS_DEFAULT_HOME_DASHBOARD_PATH=/etc/grafana/provisioning/dashboards/ssh-mcp.json
```

**Features:**
- Pre-built SSH-MCP dashboard
- Prometheus data source
- Alert notifications

### Nginx Reverse Proxy

```yaml
# SSL termination and load balancing
ports:
  - "80:80"   # HTTP (redirects to HTTPS)
  - "443:443" # HTTPS
```

**Features:**
- SSL termination
- Rate limiting
- Security headers
- Subdomain routing

## 📊 Monitoring

### Metrics Available

- **SSH Connections**: Active, success rate, duration
- **Commands**: Execution rate, latency, errors
- **Cache**: Hit rate, operations, size
- **Security**: Violations, authentication failures
- **System**: CPU, memory, disk usage
- **Workflows**: Agentic execution metrics

### Alerts Configured

- SSH connection failures
- High command latency
- Cache performance issues
- System resource alerts
- Security violations

### Dashboard Panels

1. **Connection Overview**
2. **Command Performance**
3. **Cache Metrics**
4. **System Resources**
5. **Security Events**
6. **Agentic Workflows**

## 🔒 Security

### Network Security

```yaml
# Isolated network
networks:
  ssh-mcp-network:
    driver: bridge
    ipam:
      driver: default
      config:
        - subnet: 172.20.0.0/16
```

### Access Control

```nginx
# Restricted access to monitoring
location /metrics {
  allow 127.0.0.1;
  allow 172.20.0.0/16;
  deny all;
}
```

### Container Security

- Non-root user execution
- Read-only file systems where possible
- Minimal base images (Alpine Linux)
- Security scanning integration

## 📁 Volume Management

### Persistent Volumes

```yaml
volumes:
  ssh_mcp_data:      # Application data
  ssh_mcp_logs:      # Application logs
  ssh_mcp_backups:   # Backup files
  ssh_mcp_compliance: # Compliance reports
  redis_data:        # Redis persistence
  prometheus_data:   # Metrics storage
  grafana_data:      # Dashboard config
```

### Backup Strategy

```bash
# Automated backup
docker run --rm \
  -v ssh_mcp_data:/data \
  -v $(pwd)/backups:/backup \
  busybox tar czf /backup/ssh-mcp-$(date +%Y%m%d).tar.gz /data
```

## 🛠️ Operations

### Starting Services

```bash
# Start all services
docker-compose up -d

# Start specific service
docker-compose up -d ssh-mcp

# Build and start
docker-compose up -d --build
```

### Monitoring Services

```bash
# View logs
docker-compose logs -f ssh-mcp
docker-compose logs -f --tail=100 prometheus

# Check status
docker-compose ps
docker-compose top

# Resource usage
docker stats
```

### Scaling Services

```bash
# Scale SSH-MCP instances
docker-compose up -d --scale ssh-mcp=3

# Update configuration
docker-compose up -d --force-recreate
```

### Maintenance

```bash
# Update images
docker-compose pull
docker-compose up -d

# Clean up
docker system prune -f
docker volume prune -f

# Restart services
docker-compose restart
```

## 🔄 Updates

### Rolling Updates

```bash
# Update specific service
docker-compose pull ssh-mcp
docker-compose up -d ssh-mcp

# Zero-downtime update
docker-compose up -d --no-deps ssh-mcp
```

### Database Migration

```bash
# Backup before update
./scripts/backup.sh

# Update and migrate
docker-compose up -d
```

## 🐛 Troubleshooting

### Common Issues

1. **Service Won't Start**
   ```bash
   # Check logs
   docker-compose logs ssh-mcp
   
   # Check configuration
   docker-compose config
   
   # Verify resources
   docker system df
   ```

2. **Network Issues**
   ```bash
   # Check network
   docker network ls
   docker network inspect ssh-mcp_ssh-mcp-network
   
   # Test connectivity
   docker-compose exec ssh-mcp ping redis
   ```

3. **Volume Problems**
   ```bash
   # Check volumes
   docker volume ls
   docker volume inspect ssh_mcp_data
   
   # Fix permissions
   docker-compose exec ssh-mcp chown -R sshuser:sshuser /app/data
   ```

4. **Memory Issues**
   ```bash
   # Check memory usage
   docker stats
   
   # Adjust limits
   # Edit docker-compose.yml resources section
   ```

### Health Checks

```bash
# Check application health
curl -f http://localhost:3001/health

# Check Prometheus targets
curl -s http://localhost:9090/api/v1/targets | jq .

# Check Redis
redis-cli -h localhost -p 6379 ping
```

### Performance Tuning

```bash
# Monitor resource usage
docker stats

# Adjust Redis memory
# Edit redis.conf: maxmemory 512mb

# Tune Prometheus retention
# Edit prometheus.yml: --storage.tsdb.retention.time=30d
```

## 📚 Best Practices

### Production Deployment

1. **Use proper SSL certificates**
2. **Configure monitoring alerts**
3. **Set up log rotation**
4. **Implement backup strategy**
5. **Use secrets management**
6. **Regular security updates**

### Development Environment

```bash
# Development override
docker-compose -f docker-compose.yml -f docker-compose.dev.yml up -d

# Local development
docker-compose -f docker-compose.dev.yml up -d
```

### CI/CD Integration

```yaml
# GitHub Actions example
- name: Deploy SSH-MCP
  run: |
    docker-compose pull
    docker-compose up -d
    docker-compose exec -T ssh-mcp npm test
```

## 🆘 Support

### Getting Help

1. **Check logs**: `docker-compose logs -f`
2. **Review configuration**: `docker-compose config`
3. **Consult documentation**: [SSH-MCP Docs](https://github.com/LYFTIUM-INC/ssh-mcp)
4. **Contact support**: andre@optinampout.com

### Useful Commands

```bash
# Complete service info
docker-compose ps --services
docker-compose images
docker-compose config --services

# Network debugging
docker-compose exec ssh-mcp netstat -tlnp
docker-compose exec ssh-mcp nslookup redis

# Resource monitoring
docker-compose exec ssh-mcp top
docker-compose exec ssh-mcp df -h
```

---

**This Docker deployment provides enterprise-grade reliability, monitoring, and security for SSH-MCP in production environments.**