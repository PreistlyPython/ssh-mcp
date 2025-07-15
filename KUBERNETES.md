# SSH-MCP Kubernetes Deployment Guide

**Author:** Andre (OptinampOut) with Claude Code assistance  
**Organization:** LYFTIUM-INC  
**Date:** July 15, 2025

## 📋 Overview

This guide provides comprehensive instructions for deploying SSH-MCP on Kubernetes with enterprise-grade features:

- **High Availability** - Multi-replica deployments with pod anti-affinity
- **Auto-scaling** - Horizontal Pod Autoscaler based on CPU, memory, and custom metrics
- **Persistent Storage** - Persistent volumes for data, logs, and backups
- **Monitoring Stack** - Prometheus, Grafana, and Alertmanager
- **Ingress Controller** - NGINX with SSL termination and rate limiting
- **Security** - RBAC, Pod Security Standards, and network policies

## 🚀 Quick Start

### Prerequisites

- Kubernetes cluster (v1.24+)
- kubectl configured
- Docker registry access (optional)
- Ingress controller (NGINX recommended)
- Storage class for persistent volumes

### 1. Deploy SSH-MCP

```bash
# Run automated deployment
./scripts/deploy-k8s.sh

# Or manually step by step
kubectl apply -f k8s/namespace.yaml
kubectl apply -f k8s/rbac.yaml
kubectl apply -f k8s/configmap.yaml
kubectl apply -f k8s/pvc.yaml
kubectl apply -f k8s/redis-deployment.yaml
kubectl apply -f k8s/ssh-mcp-deployment.yaml
kubectl apply -f k8s/monitoring-deployment.yaml
kubectl apply -f k8s/ingress.yaml
kubectl apply -f k8s/hpa.yaml
kubectl apply -f k8s/pdb.yaml
```

### 2. Access Services

```bash
# Port forward to access services locally
kubectl port-forward -n ssh-mcp svc/ssh-mcp-service 3001:3001
kubectl port-forward -n ssh-mcp svc/ssh-mcp-grafana 3000:3000
kubectl port-forward -n ssh-mcp svc/ssh-mcp-prometheus 9090:9090
```

- **SSH-MCP**: http://localhost:3001
- **Grafana**: http://localhost:3000 (admin/admin)
- **Prometheus**: http://localhost:9090

## 🏗️ Architecture

### Deployment Structure

```
ssh-mcp/
├── namespace.yaml           # Namespace isolation
├── rbac.yaml               # Security permissions
├── configmap.yaml          # Configuration files
├── secrets.yaml            # Sensitive data (template)
├── pvc.yaml                # Persistent storage
├── ssh-mcp-deployment.yaml # Main application
├── redis-deployment.yaml   # Cache layer
├── monitoring-deployment.yaml # Observability
├── ingress.yaml            # External access
├── hpa.yaml                # Auto-scaling
└── pdb.yaml                # High availability
```

### Resource Requirements

| Component | Replicas | CPU Request | Memory Request | CPU Limit | Memory Limit |
|-----------|----------|-------------|----------------|-----------|--------------|
| SSH-MCP   | 3-10     | 500m        | 512Mi          | 1000m     | 2Gi          |
| Redis     | 1-3      | 200m        | 256Mi          | 500m      | 512Mi        |
| Prometheus| 1        | 500m        | 512Mi          | 1000m     | 1Gi          |
| Grafana   | 1        | 200m        | 256Mi          | 500m      | 512Mi        |
| Alertmanager| 1      | 100m        | 128Mi          | 200m      | 256Mi        |

### Storage Requirements

| Volume | Size | Access Mode | Storage Class |
|--------|------|-------------|---------------|
| ssh-mcp-data | 5Gi | ReadWriteOnce | fast-ssd |
| ssh-mcp-logs | 2Gi | ReadWriteOnce | fast-ssd |
| ssh-mcp-backups | 10Gi | ReadWriteOnce | standard |
| redis-data | 2Gi | ReadWriteOnce | fast-ssd |
| prometheus-data | 10Gi | ReadWriteOnce | fast-ssd |
| grafana-data | 1Gi | ReadWriteOnce | fast-ssd |

## 🔧 Configuration

### Environment Variables

Edit `k8s/secrets.yaml` or create secrets manually:

```bash
kubectl create secret generic ssh-mcp-secrets \
  --namespace=ssh-mcp \
  --from-literal=redis-password="your-redis-password" \
  --from-literal=joedreamz-host="your-server.com" \
  --from-literal=joedreamz-username="your-username" \
  --from-literal=joedreamz-password="your-password" \
  --from-literal=context7-api-key="your-api-key" \
  --from-literal=github-token="your-github-token" \
  --from-literal=grafana-admin-password="your-grafana-password"
```

### ConfigMaps

Key configuration files stored in ConfigMaps:

- **Redis Configuration**: `redis.conf`
- **Prometheus Configuration**: `prometheus.yml`
- **Alert Rules**: `alert_rules.yml`
- **Grafana Configuration**: `grafana.ini`
- **Alertmanager Configuration**: `alertmanager.yml`

### Ingress Configuration

```yaml
# Custom domains
spec:
  rules:
  - host: ssh-mcp.your-domain.com
    http:
      paths:
      - path: /
        pathType: Prefix
        backend:
          service:
            name: ssh-mcp-service
            port:
              number: 3001
```

## 🔄 Scaling

### Horizontal Pod Autoscaler (HPA)

```yaml
# Custom metrics scaling
metrics:
- type: Resource
  resource:
    name: cpu
    target:
      type: Utilization
      averageUtilization: 70
- type: Pods
  pods:
    metric:
      name: ssh_active_connections
    target:
      type: AverageValue
      averageValue: "30"
```

### Manual Scaling

```bash
# Scale SSH-MCP deployment
kubectl scale deployment/ssh-mcp -n ssh-mcp --replicas=5

# Scale Redis deployment
kubectl scale deployment/ssh-mcp-redis -n ssh-mcp --replicas=2
```

### Vertical Pod Autoscaler (VPA)

```yaml
apiVersion: autoscaling.k8s.io/v1
kind: VerticalPodAutoscaler
metadata:
  name: ssh-mcp-vpa
  namespace: ssh-mcp
spec:
  targetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: ssh-mcp
  updatePolicy:
    updateMode: "Auto"
```

## 🔒 Security

### RBAC Configuration

```yaml
# Service account with minimal permissions
apiVersion: rbac.authorization.k8s.io/v1
kind: Role
metadata:
  name: ssh-mcp-role
rules:
- apiGroups: [""]
  resources: ["pods", "services", "endpoints"]
  verbs: ["get", "list", "watch"]
```

### Pod Security Standards

```yaml
# Security context for all containers
securityContext:
  allowPrivilegeEscalation: false
  readOnlyRootFilesystem: true
  runAsNonRoot: true
  runAsUser: 1001
  capabilities:
    drop:
    - ALL
```

### Network Policies

```yaml
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: ssh-mcp-network-policy
  namespace: ssh-mcp
spec:
  podSelector:
    matchLabels:
      app: ssh-mcp
  policyTypes:
  - Ingress
  - Egress
  ingress:
  - from:
    - namespaceSelector:
        matchLabels:
          name: ingress-nginx
    ports:
    - protocol: TCP
      port: 3001
```

## 📊 Monitoring

### Prometheus Metrics

Available metrics endpoints:
- SSH-MCP: `/metrics` on port 3001
- Redis Exporter: `/metrics` on port 9121
- Custom application metrics

### Grafana Dashboards

Pre-configured dashboards:
- SSH-MCP System Overview
- Redis Performance
- Kubernetes Cluster Metrics
- Application Performance

### Alerting Rules

Key alerts configured:
- High SSH connection failure rate
- SSH-MCP server down
- High resource usage
- Cache performance issues

## 🔄 Operations

### Deployment Management

```bash
# Rolling update
kubectl set image deployment/ssh-mcp -n ssh-mcp ssh-mcp=lyftium/ssh-mcp:new-version

# Rollback
kubectl rollout undo deployment/ssh-mcp -n ssh-mcp

# Check rollout status
kubectl rollout status deployment/ssh-mcp -n ssh-mcp
```

### Backup and Recovery

```bash
# Backup persistent volumes
kubectl get pvc -n ssh-mcp -o yaml > backup-pvc.yaml

# Create volume snapshots
kubectl create -f - <<EOF
apiVersion: snapshot.storage.k8s.io/v1
kind: VolumeSnapshot
metadata:
  name: ssh-mcp-data-snapshot
  namespace: ssh-mcp
spec:
  source:
    persistentVolumeClaimName: ssh-mcp-data
EOF
```

### Log Management

```bash
# View application logs
kubectl logs -n ssh-mcp deployment/ssh-mcp -f

# View logs from all containers
kubectl logs -n ssh-mcp -l app=ssh-mcp --all-containers=true

# Export logs
kubectl logs -n ssh-mcp deployment/ssh-mcp --since=1h > ssh-mcp-logs.txt
```

## 🐛 Troubleshooting

### Common Issues

1. **Pods Not Starting**
   ```bash
   # Check pod status
   kubectl get pods -n ssh-mcp
   
   # Describe pod for events
   kubectl describe pod -n ssh-mcp <pod-name>
   
   # Check logs
   kubectl logs -n ssh-mcp <pod-name>
   ```

2. **Persistent Volume Issues**
   ```bash
   # Check PVC status
   kubectl get pvc -n ssh-mcp
   
   # Check storage class
   kubectl get storageclass
   
   # Check volume bindings
   kubectl get pv
   ```

3. **Ingress Not Working**
   ```bash
   # Check ingress controller
   kubectl get pods -n ingress-nginx
   
   # Check ingress rules
   kubectl describe ingress -n ssh-mcp
   
   # Check service endpoints
   kubectl get endpoints -n ssh-mcp
   ```

4. **Resource Constraints**
   ```bash
   # Check resource usage
   kubectl top pods -n ssh-mcp
   
   # Check node resources
   kubectl top nodes
   
   # Check resource quotas
   kubectl describe resourcequota -n ssh-mcp
   ```

### Debugging Commands

```bash
# Interactive debugging
kubectl exec -it -n ssh-mcp deployment/ssh-mcp -- /bin/bash

# Port forwarding for debugging
kubectl port-forward -n ssh-mcp pod/<pod-name> 3001:3001

# Check cluster events
kubectl get events -n ssh-mcp --sort-by=.metadata.creationTimestamp

# Check resource usage
kubectl describe nodes
```

## 📚 Best Practices

### Production Deployment

1. **Use proper storage classes** for persistent volumes
2. **Configure resource limits** and requests
3. **Set up proper ingress** with SSL certificates
4. **Enable monitoring** and alerting
5. **Configure backup strategies**
6. **Use network policies** for security
7. **Regular security updates**

### Development Environment

```bash
# Development namespace
kubectl create namespace ssh-mcp-dev

# Reduced resource requirements
# Lower replica counts
# Relaxed security policies
```

### CI/CD Integration

```yaml
# GitHub Actions example
- name: Deploy to Kubernetes
  run: |
    kubectl set image deployment/ssh-mcp -n ssh-mcp ssh-mcp=lyftium/ssh-mcp:${{ github.sha }}
    kubectl rollout status deployment/ssh-mcp -n ssh-mcp
```

## 🔮 Advanced Features

### Multi-Cluster Deployment

```bash
# Deploy across multiple clusters
kubectl config use-context cluster-1
./scripts/deploy-k8s.sh

kubectl config use-context cluster-2
./scripts/deploy-k8s.sh
```

### GitOps Integration

```yaml
# ArgoCD Application
apiVersion: argoproj.io/v1alpha1
kind: Application
metadata:
  name: ssh-mcp
spec:
  source:
    repoURL: https://github.com/LYFTIUM-INC/ssh-mcp
    path: k8s
    targetRevision: HEAD
  destination:
    server: https://kubernetes.default.svc
    namespace: ssh-mcp
```

### Service Mesh Integration

```yaml
# Istio sidecar injection
metadata:
  annotations:
    sidecar.istio.io/inject: "true"
```

## 🆘 Support

### Getting Help

1. **Check documentation**: This guide and inline comments
2. **Review logs**: Application and Kubernetes events
3. **Consult troubleshooting**: Common issues section
4. **Contact support**: andre@optinampout.com

### Useful Resources

- [Kubernetes Documentation](https://kubernetes.io/docs/)
- [NGINX Ingress Controller](https://kubernetes.github.io/ingress-nginx/)
- [Prometheus Operator](https://github.com/prometheus-operator/prometheus-operator)
- [Grafana Dashboards](https://grafana.com/grafana/dashboards/)

---

**This Kubernetes deployment provides enterprise-grade reliability, scalability, and monitoring for SSH-MCP in production environments.**