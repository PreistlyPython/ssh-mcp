# SSH-MCP Monitoring Stack

**Generated for LYFTIUM-INC SSH-MCP project**  
**Author:** Andre (OptinampOut) with Claude Code assistance  
**Date:** July 15, 2025

## 📊 Overview

The SSH-MCP monitoring stack provides comprehensive observability for your SSH-MCP deployment using industry-standard open-source tools:

- **Prometheus** - Metrics collection and storage
- **Grafana** - Visualization and dashboards
- **Node Exporter** - System metrics collection
- **Redis Exporter** - Redis metrics collection
- **Alertmanager** - Alert routing and notification

## 🚀 Quick Start

### Prerequisites

- Docker and Docker Compose installed
- SSH-MCP application running
- Ports 3000, 6379, 9090, 9093, 9100, 9121 available

### 1. Start the Monitoring Stack

```bash
# Run the setup script
./scripts/setup-monitoring.sh

# Or manually with Docker Compose
docker-compose -f docker-compose.monitoring.yml up -d
```

### 2. Access Dashboards

- **Grafana Dashboard**: http://localhost:3000
  - Username: `admin`
  - Password: `admin`
  - Default dashboard: SSH-MCP System Dashboard

- **Prometheus**: http://localhost:9090
  - Query interface and target status

- **Alertmanager**: http://localhost:9093
  - Alert routing and silence management

## 📈 Metrics Collected

### SSH Connection Metrics
- `ssh_connections_total` - Total SSH connections
- `ssh_connection_failures_total` - Failed connections
- `ssh_active_connections` - Current active connections
- `ssh_connection_duration_seconds` - Connection establishment time

### SSH Command Metrics
- `ssh_commands_total` - Total commands executed
- `ssh_command_duration_seconds` - Command execution time
- `ssh_command_timeouts_total` - Command timeouts
- `ssh_command_errors_total` - Command errors

### Cache Metrics
- `cache_hit_rate` - Cache hit rate percentage
- `cache_operations_total` - Total cache operations
- `cache_size_bytes` - Current cache size
- `cache_operation_duration_seconds` - Cache operation latency

### Security Metrics
- `security_violations_total` - Security violations
- `authentication_failures_total` - Authentication failures
- `authentication_successes_total` - Successful authentications
- `mfa_challenges_total` - MFA challenges

### Agentic Workflow Metrics
- `agentic_workflow_executions_total` - Workflow executions
- `agentic_workflow_failures_total` - Workflow failures
- `agentic_workflow_duration_seconds` - Workflow execution time
- `agentic_workflow_active_count` - Active workflows

### System Metrics
- `system_cpu_usage_percent` - CPU usage
- `system_memory_usage_percent` - Memory usage
- `system_disk_usage_percent` - Disk usage
- `application_uptime_seconds` - Application uptime

## 🔔 Alerting

### Alert Rules

The following alerts are configured:

**Critical Alerts:**
- SSH-MCP server down
- SSH connection pool overflow
- High disk usage (>90%)
- Security violations

**Warning Alerts:**
- High SSH connection failure rate
- High SSH command latency
- High CPU/memory usage
- Low cache hit rate

### Alert Configuration

Edit `monitoring/alertmanager.yml` to configure:

1. **Email Notifications**
   ```yaml
   global:
     smtp_smarthost: 'your-smtp-server:587'
     smtp_from: 'alerts@yourcompany.com'
     smtp_auth_username: 'alerts@yourcompany.com'
     smtp_auth_password: 'your-password'
   ```

2. **Slack Notifications**
   ```yaml
   slack_configs:
     - api_url: 'https://hooks.slack.com/services/YOUR/SLACK/WEBHOOK'
       channel: '#ssh-mcp-alerts'
   ```

## 📊 Dashboard Guide

### SSH-MCP System Dashboard

The main dashboard provides:

1. **Connection Overview**
   - Active connections count
   - Connection success rate
   - Connection failure rate over time

2. **Command Performance**
   - Command execution rate
   - Command latency percentiles
   - Command timeout rate

3. **Cache Performance**
   - Cache hit rate
   - Cache operations per second
   - Cache size and memory usage

4. **System Resources**
   - CPU usage
   - Memory usage
   - Disk usage

5. **Security Monitoring**
   - Security violations
   - Authentication failures
   - MFA challenges

6. **Agentic Workflows**
   - Workflow execution rate
   - Workflow failure rate
   - Workflow duration percentiles

## 🛠️ Configuration

### Prometheus Configuration

Edit `monitoring/prometheus.yml` to:

- Add new scrape targets
- Adjust scrape intervals
- Configure remote write endpoints
- Add recording rules

### Grafana Configuration

- Import additional dashboards
- Configure data sources
- Set up user permissions
- Configure notification channels

### Alert Rules

Edit `monitoring/alert_rules.yml` to:

- Add new alert rules
- Modify thresholds
- Change alert severity
- Add new labels

## 📋 Troubleshooting

### Common Issues

1. **Prometheus can't scrape SSH-MCP metrics**
   - Ensure SSH-MCP is running on port 3001
   - Check firewall settings
   - Verify metrics endpoint: `curl http://localhost:3001/metrics`

2. **Grafana dashboard shows no data**
   - Check Prometheus data source configuration
   - Verify Prometheus is collecting metrics
   - Check time range in dashboard

3. **Alerts not firing**
   - Check alert rule syntax
   - Verify Prometheus is evaluating rules
   - Check Alertmanager configuration

4. **Redis metrics missing**
   - Ensure Redis server is running
   - Check Redis Exporter connection
   - Verify Redis Exporter configuration

### Debugging Commands

```bash
# Check container status
docker-compose -f docker-compose.monitoring.yml ps

# View logs
docker-compose -f docker-compose.monitoring.yml logs prometheus
docker-compose -f docker-compose.monitoring.yml logs grafana
docker-compose -f docker-compose.monitoring.yml logs alertmanager

# Check metrics endpoints
curl http://localhost:9090/api/v1/targets
curl http://localhost:3001/metrics
curl http://localhost:9100/metrics
curl http://localhost:9121/metrics

# Test alert rules
curl -X POST http://localhost:9090/-/reload
```

## 🔧 Maintenance

### Regular Tasks

1. **Update Dashboards**
   - Review and update dashboard queries
   - Add new panels for new metrics
   - Remove obsolete visualizations

2. **Tune Alert Rules**
   - Adjust thresholds based on baseline
   - Add new alerts for new features
   - Remove noisy alerts

3. **Monitor Storage**
   - Check Prometheus storage usage
   - Configure retention policies
   - Set up long-term storage if needed

4. **Security Updates**
   - Update container images regularly
   - Review access controls
   - Rotate service passwords

### Backup

```bash
# Backup Prometheus data
docker run --rm -v ssh-mcp_prometheus_data:/data -v $(pwd):/backup busybox tar czf /backup/prometheus-backup.tar.gz /data

# Backup Grafana data
docker run --rm -v ssh-mcp_grafana_data:/data -v $(pwd):/backup busybox tar czf /backup/grafana-backup.tar.gz /data
```

## 📚 Additional Resources

- [Prometheus Documentation](https://prometheus.io/docs/)
- [Grafana Documentation](https://grafana.com/docs/)
- [Node Exporter Guide](https://github.com/prometheus/node_exporter)
- [Redis Exporter Guide](https://github.com/oliver006/redis_exporter)
- [Alertmanager Guide](https://prometheus.io/docs/alerting/latest/alertmanager/)

## 🆘 Support

For issues with the monitoring stack:

1. Check the troubleshooting section
2. Review container logs
3. Verify configuration files
4. Contact: andre@optinampout.com

---

**This monitoring stack provides enterprise-grade observability for SSH-MCP deployments, ensuring optimal performance and reliability.**