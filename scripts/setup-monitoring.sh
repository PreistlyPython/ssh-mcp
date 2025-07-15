#!/bin/bash

# SSH-MCP Monitoring Setup Script
# Sets up Prometheus, Grafana, and monitoring infrastructure
# 
# Author: Andre (OptinampOut) with Claude Code assistance
# Organization: LYFTIUM-INC
# Date: July 15, 2025

set -e

echo "🚀 Setting up SSH-MCP Monitoring Stack"
echo "============================================================"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check if Docker is installed
if ! command -v docker &> /dev/null; then
    echo -e "${RED}❌ Docker is not installed. Please install Docker first.${NC}"
    exit 1
fi

# Check if Docker Compose is installed
if ! command -v docker-compose &> /dev/null; then
    echo -e "${RED}❌ Docker Compose is not installed. Please install Docker Compose first.${NC}"
    exit 1
fi

echo -e "${GREEN}✅ Docker and Docker Compose are available${NC}"

# Create monitoring directory if it doesn't exist
mkdir -p monitoring

# Check if configuration files exist
echo -e "${YELLOW}📋 Checking configuration files...${NC}"

if [ ! -f "monitoring/prometheus.yml" ]; then
    echo -e "${RED}❌ prometheus.yml not found${NC}"
    exit 1
fi

if [ ! -f "monitoring/alert_rules.yml" ]; then
    echo -e "${RED}❌ alert_rules.yml not found${NC}"
    exit 1
fi

if [ ! -f "monitoring/grafana-dashboard.json" ]; then
    echo -e "${RED}❌ grafana-dashboard.json not found${NC}"
    exit 1
fi

if [ ! -f "monitoring/alertmanager.yml" ]; then
    echo -e "${RED}❌ alertmanager.yml not found${NC}"
    exit 1
fi

echo -e "${GREEN}✅ All configuration files found${NC}"

# Stop any existing containers
echo -e "${YELLOW}🛑 Stopping existing monitoring containers...${NC}"
docker-compose -f docker-compose.monitoring.yml down

# Pull latest images
echo -e "${YELLOW}📦 Pulling latest Docker images...${NC}"
docker-compose -f docker-compose.monitoring.yml pull

# Start the monitoring stack
echo -e "${YELLOW}🚀 Starting monitoring stack...${NC}"
docker-compose -f docker-compose.monitoring.yml up -d

# Wait for services to be ready
echo -e "${YELLOW}⏳ Waiting for services to be ready...${NC}"
sleep 10

# Check service health
echo -e "${YELLOW}🩺 Checking service health...${NC}"

# Check Prometheus
if curl -s http://localhost:9090/-/healthy &> /dev/null; then
    echo -e "${GREEN}✅ Prometheus is healthy${NC}"
else
    echo -e "${RED}❌ Prometheus is not responding${NC}"
fi

# Check Grafana
if curl -s http://localhost:3000/api/health &> /dev/null; then
    echo -e "${GREEN}✅ Grafana is healthy${NC}"
else
    echo -e "${RED}❌ Grafana is not responding${NC}"
fi

# Check Node Exporter
if curl -s http://localhost:9100/metrics &> /dev/null; then
    echo -e "${GREEN}✅ Node Exporter is healthy${NC}"
else
    echo -e "${RED}❌ Node Exporter is not responding${NC}"
fi

# Check Redis
if redis-cli -h localhost -p 6379 ping &> /dev/null; then
    echo -e "${GREEN}✅ Redis is healthy${NC}"
else
    echo -e "${RED}❌ Redis is not responding${NC}"
fi

# Check Redis Exporter
if curl -s http://localhost:9121/metrics &> /dev/null; then
    echo -e "${GREEN}✅ Redis Exporter is healthy${NC}"
else
    echo -e "${RED}❌ Redis Exporter is not responding${NC}"
fi

# Check Alertmanager
if curl -s http://localhost:9093/-/healthy &> /dev/null; then
    echo -e "${GREEN}✅ Alertmanager is healthy${NC}"
else
    echo -e "${RED}❌ Alertmanager is not responding${NC}"
fi

echo ""
echo -e "${GREEN}🎉 Monitoring stack setup complete!${NC}"
echo ""
echo "📊 Access your monitoring dashboards:"
echo "   - Prometheus: http://localhost:9090"
echo "   - Grafana: http://localhost:3000 (admin/admin)"
echo "   - Alertmanager: http://localhost:9093"
echo ""
echo "📈 System metrics:"
echo "   - Node Exporter: http://localhost:9100/metrics"
echo "   - Redis Exporter: http://localhost:9121/metrics"
echo ""
echo "🔧 To view logs:"
echo "   docker-compose -f docker-compose.monitoring.yml logs -f [service_name]"
echo ""
echo "🛑 To stop the monitoring stack:"
echo "   docker-compose -f docker-compose.monitoring.yml down"
echo ""
echo "📝 Configuration files:"
echo "   - Prometheus: monitoring/prometheus.yml"
echo "   - Grafana: monitoring/grafana-dashboard.json"
echo "   - Alertmanager: monitoring/alertmanager.yml"
echo "   - Alert Rules: monitoring/alert_rules.yml"
echo ""
echo -e "${YELLOW}⚠️  Remember to configure your email settings in alertmanager.yml${NC}"
echo -e "${YELLOW}⚠️  Remember to configure your Slack webhook in alertmanager.yml${NC}"
echo ""
echo "============================================================"
echo -e "${GREEN}🚀 SSH-MCP Monitoring Stack is ready!${NC}"