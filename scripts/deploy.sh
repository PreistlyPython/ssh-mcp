#!/bin/bash

# SSH-MCP Production Deployment Script
# Deploys SSH-MCP with full monitoring stack
# 
# Author: Andre (OptinampOut) with Claude Code assistance
# Organization: LYFTIUM-INC
# Date: July 15, 2025

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
PROJECT_NAME="ssh-mcp"
DEPLOYMENT_ENV="${1:-production}"
BACKUP_DIR="./backups/$(date +%Y%m%d_%H%M%S)"

echo -e "${BLUE}🚀 SSH-MCP Production Deployment${NC}"
echo -e "${BLUE}============================================================${NC}"
echo -e "${YELLOW}Environment: ${DEPLOYMENT_ENV}${NC}"
echo -e "${YELLOW}Project: ${PROJECT_NAME}${NC}"
echo -e "${YELLOW}Backup Directory: ${BACKUP_DIR}${NC}"
echo ""

# Function to check prerequisites
check_prerequisites() {
    echo -e "${YELLOW}📋 Checking prerequisites...${NC}"
    
    # Check Docker
    if ! command -v docker &> /dev/null; then
        echo -e "${RED}❌ Docker is not installed${NC}"
        exit 1
    fi
    
    # Check Docker Compose
    if ! command -v docker-compose &> /dev/null; then
        echo -e "${RED}❌ Docker Compose is not installed${NC}"
        exit 1
    fi
    
    # Check if running as root
    if [[ $EUID -eq 0 ]]; then
        echo -e "${RED}❌ This script should not be run as root${NC}"
        exit 1
    fi
    
    # Check disk space (minimum 5GB)
    available_space=$(df . | awk 'NR==2 {print $4}')
    if [[ $available_space -lt 5242880 ]]; then
        echo -e "${RED}❌ Insufficient disk space. Need at least 5GB${NC}"
        exit 1
    fi
    
    # Check if .env file exists
    if [[ ! -f ".env" ]]; then
        echo -e "${YELLOW}⚠️  .env file not found. Creating from template...${NC}"
        if [[ -f ".env.example" ]]; then
            cp .env.example .env
            echo -e "${YELLOW}⚠️  Please edit .env file with your configuration${NC}"
            read -p "Press Enter to continue after editing .env file..."
        else
            echo -e "${RED}❌ .env.example file not found${NC}"
            exit 1
        fi
    fi
    
    echo -e "${GREEN}✅ Prerequisites check passed${NC}"
}

# Function to backup existing data
backup_existing_data() {
    echo -e "${YELLOW}💾 Creating backup of existing data...${NC}"
    
    mkdir -p "${BACKUP_DIR}"
    
    # Backup Docker volumes if they exist
    if docker volume ls | grep -q "${PROJECT_NAME}_"; then
        echo -e "${YELLOW}📦 Backing up Docker volumes...${NC}"
        
        # List of volumes to backup
        volumes=(
            "ssh_mcp_data"
            "ssh_mcp_logs"
            "ssh_mcp_backups"
            "ssh_mcp_compliance"
            "redis_data"
            "prometheus_data"
            "grafana_data"
            "alertmanager_data"
        )
        
        for volume in "${volumes[@]}"; do
            if docker volume ls | grep -q "$volume"; then
                echo -e "${YELLOW}  Backing up $volume...${NC}"
                docker run --rm \
                    -v "${volume}:/data" \
                    -v "$(pwd)/${BACKUP_DIR}:/backup" \
                    busybox \
                    tar czf "/backup/${volume}.tar.gz" -C /data .
            fi
        done
    fi
    
    # Backup configuration files
    echo -e "${YELLOW}📋 Backing up configuration files...${NC}"
    cp -r monitoring "${BACKUP_DIR}/"
    cp -r nginx "${BACKUP_DIR}/"
    cp .env "${BACKUP_DIR}/"
    cp docker-compose.yml "${BACKUP_DIR}/"
    cp redis.conf "${BACKUP_DIR}/"
    
    echo -e "${GREEN}✅ Backup completed: ${BACKUP_DIR}${NC}"
}

# Function to build application
build_application() {
    echo -e "${YELLOW}🔨 Building SSH-MCP application...${NC}"
    
    # Build TypeScript
    echo -e "${YELLOW}  Building TypeScript...${NC}"
    npm run build
    
    # Build Docker image
    echo -e "${YELLOW}  Building Docker image...${NC}"
    docker-compose build --no-cache ssh-mcp
    
    echo -e "${GREEN}✅ Application built successfully${NC}"
}

# Function to generate SSL certificates
generate_ssl_certificates() {
    echo -e "${YELLOW}🔒 Generating SSL certificates...${NC}"
    
    mkdir -p nginx/ssl
    
    if [[ ! -f "nginx/ssl/cert.pem" || ! -f "nginx/ssl/key.pem" ]]; then
        echo -e "${YELLOW}  Generating self-signed certificates...${NC}"
        openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
            -keyout nginx/ssl/key.pem \
            -out nginx/ssl/cert.pem \
            -subj "/C=US/ST=State/L=City/O=LYFTIUM-INC/CN=ssh-mcp.lyftium.com"
        
        echo -e "${YELLOW}⚠️  Self-signed certificates generated. For production, use proper certificates.${NC}"
    else
        echo -e "${GREEN}✅ SSL certificates already exist${NC}"
    fi
}

# Function to deploy services
deploy_services() {
    echo -e "${YELLOW}🚀 Deploying services...${NC}"
    
    # Stop existing services
    echo -e "${YELLOW}  Stopping existing services...${NC}"
    docker-compose down
    
    # Remove unused images and volumes
    echo -e "${YELLOW}  Cleaning up unused resources...${NC}"
    docker system prune -f
    
    # Start services
    echo -e "${YELLOW}  Starting services...${NC}"
    docker-compose up -d
    
    echo -e "${GREEN}✅ Services deployed${NC}"
}

# Function to wait for services
wait_for_services() {
    echo -e "${YELLOW}⏳ Waiting for services to be ready...${NC}"
    
    services=(
        "redis:6379"
        "ssh-mcp:3001"
        "prometheus:9090"
        "grafana:3000"
        "alertmanager:9093"
    )
    
    for service in "${services[@]}"; do
        IFS=':' read -r name port <<< "$service"
        echo -e "${YELLOW}  Waiting for $name on port $port...${NC}"
        
        timeout=120
        while ! nc -z localhost "$port" && [[ $timeout -gt 0 ]]; do
            sleep 2
            ((timeout-=2))
        done
        
        if [[ $timeout -le 0 ]]; then
            echo -e "${RED}❌ $name failed to start${NC}"
            docker-compose logs "$name"
            exit 1
        else
            echo -e "${GREEN}✅ $name is ready${NC}"
        fi
    done
}

# Function to run health checks
run_health_checks() {
    echo -e "${YELLOW}🩺 Running health checks...${NC}"
    
    # Check SSH-MCP health
    if curl -s -f http://localhost:3001/health &> /dev/null; then
        echo -e "${GREEN}✅ SSH-MCP is healthy${NC}"
    else
        echo -e "${RED}❌ SSH-MCP health check failed${NC}"
        docker-compose logs ssh-mcp
        exit 1
    fi
    
    # Check Prometheus
    if curl -s -f http://localhost:9090/-/healthy &> /dev/null; then
        echo -e "${GREEN}✅ Prometheus is healthy${NC}"
    else
        echo -e "${RED}❌ Prometheus health check failed${NC}"
        docker-compose logs prometheus
        exit 1
    fi
    
    # Check Grafana
    if curl -s -f http://localhost:3000/api/health &> /dev/null; then
        echo -e "${GREEN}✅ Grafana is healthy${NC}"
    else
        echo -e "${RED}❌ Grafana health check failed${NC}"
        docker-compose logs grafana
        exit 1
    fi
    
    # Check Redis
    if redis-cli -h localhost -p 6379 ping &> /dev/null; then
        echo -e "${GREEN}✅ Redis is healthy${NC}"
    else
        echo -e "${RED}❌ Redis health check failed${NC}"
        docker-compose logs redis
        exit 1
    fi
    
    echo -e "${GREEN}✅ All health checks passed${NC}"
}

# Function to show deployment summary
show_deployment_summary() {
    echo ""
    echo -e "${GREEN}🎉 Deployment completed successfully!${NC}"
    echo -e "${GREEN}============================================================${NC}"
    echo ""
    echo -e "${BLUE}📊 Access your services:${NC}"
    echo -e "${YELLOW}  SSH-MCP Application: http://localhost:3001${NC}"
    echo -e "${YELLOW}  Grafana Dashboard: http://localhost:3000${NC}"
    echo -e "${YELLOW}  Prometheus: http://localhost:9090${NC}"
    echo -e "${YELLOW}  Alertmanager: http://localhost:9093${NC}"
    echo ""
    echo -e "${BLUE}🔐 Default credentials:${NC}"
    echo -e "${YELLOW}  Grafana: admin/admin${NC}"
    echo ""
    echo -e "${BLUE}🔧 Useful commands:${NC}"
    echo -e "${YELLOW}  View logs: docker-compose logs -f [service]${NC}"
    echo -e "${YELLOW}  Restart service: docker-compose restart [service]${NC}"
    echo -e "${YELLOW}  Stop all: docker-compose down${NC}"
    echo -e "${YELLOW}  Update service: docker-compose up -d [service]${NC}"
    echo ""
    echo -e "${BLUE}💾 Backup location: ${BACKUP_DIR}${NC}"
    echo ""
    echo -e "${GREEN}🚀 SSH-MCP is ready for production use!${NC}"
}

# Function to handle errors
handle_error() {
    echo -e "${RED}❌ Deployment failed!${NC}"
    echo -e "${RED}============================================================${NC}"
    echo -e "${YELLOW}📋 Troubleshooting steps:${NC}"
    echo -e "${YELLOW}  1. Check Docker logs: docker-compose logs${NC}"
    echo -e "${YELLOW}  2. Check system resources: df -h && free -h${NC}"
    echo -e "${YELLOW}  3. Verify configuration: cat .env${NC}"
    echo -e "${YELLOW}  4. Restore from backup: ${BACKUP_DIR}${NC}"
    echo ""
    echo -e "${YELLOW}🆘 For support, contact: andre@optinampout.com${NC}"
    exit 1
}

# Main deployment flow
main() {
    trap handle_error ERR
    
    check_prerequisites
    backup_existing_data
    build_application
    generate_ssl_certificates
    deploy_services
    wait_for_services
    run_health_checks
    show_deployment_summary
}

# Run main function
main "$@"