#!/bin/bash

# SSH-MCP Kubernetes Deployment Script
# Deploys SSH-MCP with full monitoring stack to Kubernetes
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
NAMESPACE="ssh-mcp"
DEPLOYMENT_ENV="${1:-production}"
BACKUP_DIR="./backups/k8s_$(date +%Y%m%d_%H%M%S)"

echo -e "${BLUE}🚀 SSH-MCP Kubernetes Deployment${NC}"
echo -e "${BLUE}============================================================${NC}"
echo -e "${YELLOW}Environment: ${DEPLOYMENT_ENV}${NC}"
echo -e "${YELLOW}Project: ${PROJECT_NAME}${NC}"
echo -e "${YELLOW}Namespace: ${NAMESPACE}${NC}"
echo -e "${YELLOW}Backup Directory: ${BACKUP_DIR}${NC}"
echo ""

# Function to check prerequisites
check_prerequisites() {
    echo -e "${YELLOW}📋 Checking prerequisites...${NC}"
    
    # Check kubectl
    if ! command -v kubectl &> /dev/null; then
        echo -e "${RED}❌ kubectl is not installed${NC}"
        exit 1
    fi
    
    # Check Docker
    if ! command -v docker &> /dev/null; then
        echo -e "${RED}❌ Docker is not installed${NC}"
        exit 1
    fi
    
    # Check Kubernetes cluster connection
    if ! kubectl cluster-info &> /dev/null; then
        echo -e "${RED}❌ Cannot connect to Kubernetes cluster${NC}"
        exit 1
    fi
    
    # Check if k8s directory exists
    if [[ ! -d "k8s" ]]; then
        echo -e "${RED}❌ k8s directory not found${NC}"
        exit 1
    fi
    
    # Check if .env file exists
    if [[ ! -f ".env" ]]; then
        echo -e "${YELLOW}⚠️  .env file not found. Please create it with your configuration${NC}"
        exit 1
    fi
    
    echo -e "${GREEN}✅ Prerequisites check passed${NC}"
}

# Function to backup existing resources
backup_existing_resources() {
    echo -e "${YELLOW}💾 Creating backup of existing resources...${NC}"
    
    mkdir -p "${BACKUP_DIR}"
    
    # Backup existing namespace resources if they exist
    if kubectl get namespace "${NAMESPACE}" &> /dev/null; then
        echo -e "${YELLOW}📦 Backing up existing resources...${NC}"
        
        # Export all resources from namespace
        kubectl get all -n "${NAMESPACE}" -o yaml > "${BACKUP_DIR}/all-resources.yaml"
        kubectl get configmaps -n "${NAMESPACE}" -o yaml > "${BACKUP_DIR}/configmaps.yaml"
        kubectl get secrets -n "${NAMESPACE}" -o yaml > "${BACKUP_DIR}/secrets.yaml"
        kubectl get pvc -n "${NAMESPACE}" -o yaml > "${BACKUP_DIR}/pvc.yaml"
        kubectl get ingress -n "${NAMESPACE}" -o yaml > "${BACKUP_DIR}/ingress.yaml"
        
        echo -e "${GREEN}✅ Backup completed: ${BACKUP_DIR}${NC}"
    else
        echo -e "${YELLOW}ℹ️  No existing resources to backup${NC}"
    fi
}

# Function to build and push Docker image
build_and_push_image() {
    echo -e "${YELLOW}🔨 Building and pushing Docker image...${NC}"
    
    # Build TypeScript
    echo -e "${YELLOW}  Building TypeScript...${NC}"
    npm run build
    
    # Build Docker image
    echo -e "${YELLOW}  Building Docker image...${NC}"
    docker build -t lyftium/ssh-mcp:latest .
    docker build -t lyftium/ssh-mcp:${DEPLOYMENT_ENV} .
    
    # Push to registry (uncomment if you have a registry)
    # echo -e "${YELLOW}  Pushing to registry...${NC}"
    # docker push lyftium/ssh-mcp:latest
    # docker push lyftium/ssh-mcp:${DEPLOYMENT_ENV}
    
    echo -e "${GREEN}✅ Docker image built successfully${NC}"
}

# Function to create namespace and secrets
create_namespace_and_secrets() {
    echo -e "${YELLOW}🔧 Creating namespace and secrets...${NC}"
    
    # Apply namespace
    kubectl apply -f k8s/namespace.yaml
    
    # Create secrets from .env file
    echo -e "${YELLOW}  Creating secrets from .env file...${NC}"
    
    # Source .env file
    set -a
    source .env
    set +a
    
    # Create SSH-MCP secrets
    kubectl create secret generic ssh-mcp-secrets \
        --namespace="${NAMESPACE}" \
        --from-literal=redis-password="${REDIS_PASSWORD:-change-this-redis-password}" \
        --from-literal=joedreamz-host="${JOEDREAMZ_HOST:-}" \
        --from-literal=joedreamz-username="${JOEDREAMZ_USERNAME:-}" \
        --from-literal=joedreamz-password="${JOEDREAMZ_PASSWORD:-}" \
        --from-literal=optinampout-host="${OPTINAMPOUT_HOST:-}" \
        --from-literal=optinampout-username="${OPTINAMPOUT_USERNAME:-}" \
        --from-literal=optinampout-password="${OPTINAMPOUT_PASSWORD:-}" \
        --from-literal=my-server-host="${MY_SERVER_HOST:-}" \
        --from-literal=my-server-username="${MY_SERVER_USERNAME:-}" \
        --from-literal=my-server-password="${MY_SERVER_PASSWORD:-}" \
        --from-literal=context7-api-key="${CONTEXT7_API_KEY:-}" \
        --from-literal=github-token="${GITHUB_TOKEN:-}" \
        --from-literal=grafana-admin-password="${GRAFANA_PASSWORD:-admin}" \
        --dry-run=client -o yaml | kubectl apply -f -
    
    echo -e "${GREEN}✅ Namespace and secrets created${NC}"
}

# Function to deploy core resources
deploy_core_resources() {
    echo -e "${YELLOW}🚀 Deploying core resources...${NC}"
    
    # Apply in specific order
    kubectl apply -f k8s/rbac.yaml
    kubectl apply -f k8s/configmap.yaml
    kubectl apply -f k8s/pvc.yaml
    kubectl apply -f k8s/pdb.yaml
    
    echo -e "${GREEN}✅ Core resources deployed${NC}"
}

# Function to deploy applications
deploy_applications() {
    echo -e "${YELLOW}🚀 Deploying applications...${NC}"
    
    # Deploy Redis first (dependency)
    kubectl apply -f k8s/redis-deployment.yaml
    
    # Wait for Redis to be ready
    echo -e "${YELLOW}  Waiting for Redis to be ready...${NC}"
    kubectl wait --for=condition=available --timeout=300s deployment/ssh-mcp-redis -n "${NAMESPACE}"
    
    # Deploy SSH-MCP application
    kubectl apply -f k8s/ssh-mcp-deployment.yaml
    
    # Deploy monitoring stack
    kubectl apply -f k8s/monitoring-deployment.yaml
    
    echo -e "${GREEN}✅ Applications deployed${NC}"
}

# Function to configure autoscaling
configure_autoscaling() {
    echo -e "${YELLOW}⚖️  Configuring autoscaling...${NC}"
    
    # Check if metrics server is available
    if kubectl get apiservice v1beta1.metrics.k8s.io -o jsonpath='{.status.conditions[?(@.type=="Available")].status}' | grep -q "True"; then
        kubectl apply -f k8s/hpa.yaml
        echo -e "${GREEN}✅ Autoscaling configured${NC}"
    else
        echo -e "${YELLOW}⚠️  Metrics server not available. Skipping HPA configuration${NC}"
    fi
}

# Function to configure ingress
configure_ingress() {
    echo -e "${YELLOW}🌐 Configuring ingress...${NC}"
    
    # Check if ingress controller is available
    if kubectl get ingressclass nginx &> /dev/null; then
        kubectl apply -f k8s/ingress.yaml
        echo -e "${GREEN}✅ Ingress configured${NC}"
    else
        echo -e "${YELLOW}⚠️  Nginx ingress controller not found. Skipping ingress configuration${NC}"
        echo -e "${YELLOW}    You can install it with: kubectl apply -f https://raw.githubusercontent.com/kubernetes/ingress-nginx/controller-v1.8.2/deploy/static/provider/cloud/deploy.yaml${NC}"
    fi
}

# Function to wait for deployments
wait_for_deployments() {
    echo -e "${YELLOW}⏳ Waiting for deployments to be ready...${NC}"
    
    deployments=(
        "ssh-mcp-redis"
        "ssh-mcp"
        "ssh-mcp-prometheus"
        "ssh-mcp-grafana"
        "ssh-mcp-alertmanager"
    )
    
    for deployment in "${deployments[@]}"; do
        echo -e "${YELLOW}  Waiting for ${deployment}...${NC}"
        kubectl wait --for=condition=available --timeout=300s deployment/"${deployment}" -n "${NAMESPACE}"
        echo -e "${GREEN}✅ ${deployment} is ready${NC}"
    done
}

# Function to run health checks
run_health_checks() {
    echo -e "${YELLOW}🩺 Running health checks...${NC}"
    
    # Check pod status
    echo -e "${YELLOW}  Checking pod status...${NC}"
    kubectl get pods -n "${NAMESPACE}"
    
    # Check services
    echo -e "${YELLOW}  Checking services...${NC}"
    kubectl get services -n "${NAMESPACE}"
    
    # Check ingress
    echo -e "${YELLOW}  Checking ingress...${NC}"
    kubectl get ingress -n "${NAMESPACE}"
    
    # Port forward for local testing
    echo -e "${YELLOW}  Testing application health...${NC}"
    kubectl port-forward -n "${NAMESPACE}" svc/ssh-mcp-service 3001:3001 &
    PORT_FORWARD_PID=$!
    sleep 5
    
    if curl -s -f http://localhost:3001/health &> /dev/null; then
        echo -e "${GREEN}✅ SSH-MCP health check passed${NC}"
    else
        echo -e "${RED}❌ SSH-MCP health check failed${NC}"
        kubectl logs -n "${NAMESPACE}" deployment/ssh-mcp --tail=50
    fi
    
    kill $PORT_FORWARD_PID 2>/dev/null || true
    
    echo -e "${GREEN}✅ Health checks completed${NC}"
}

# Function to show deployment summary
show_deployment_summary() {
    echo ""
    echo -e "${GREEN}🎉 Kubernetes deployment completed successfully!${NC}"
    echo -e "${GREEN}============================================================${NC}"
    echo ""
    echo -e "${BLUE}📊 Deployment Status:${NC}"
    kubectl get all -n "${NAMESPACE}"
    echo ""
    echo -e "${BLUE}🔗 Access your services:${NC}"
    
    # Get ingress URLs
    if kubectl get ingress -n "${NAMESPACE}" &> /dev/null; then
        echo -e "${YELLOW}  SSH-MCP: https://ssh-mcp.lyftium.com${NC}"
        echo -e "${YELLOW}  Grafana: https://grafana.lyftium.com${NC}"
        echo -e "${YELLOW}  Prometheus: https://prometheus.lyftium.com${NC}"
        echo -e "${YELLOW}  Alertmanager: https://alertmanager.lyftium.com${NC}"
    else
        echo -e "${YELLOW}  Use port-forward to access services:${NC}"
        echo -e "${YELLOW}    kubectl port-forward -n ${NAMESPACE} svc/ssh-mcp-service 3001:3001${NC}"
        echo -e "${YELLOW}    kubectl port-forward -n ${NAMESPACE} svc/ssh-mcp-grafana 3000:3000${NC}"
        echo -e "${YELLOW}    kubectl port-forward -n ${NAMESPACE} svc/ssh-mcp-prometheus 9090:9090${NC}"
    fi
    
    echo ""
    echo -e "${BLUE}🔧 Useful commands:${NC}"
    echo -e "${YELLOW}  View logs: kubectl logs -n ${NAMESPACE} deployment/ssh-mcp -f${NC}"
    echo -e "${YELLOW}  Scale deployment: kubectl scale deployment/ssh-mcp -n ${NAMESPACE} --replicas=5${NC}"
    echo -e "${YELLOW}  Get pods: kubectl get pods -n ${NAMESPACE}${NC}"
    echo -e "${YELLOW}  Describe pod: kubectl describe pod -n ${NAMESPACE} [pod-name]${NC}"
    echo -e "${YELLOW}  Delete deployment: kubectl delete namespace ${NAMESPACE}${NC}"
    echo ""
    echo -e "${BLUE}💾 Backup location: ${BACKUP_DIR}${NC}"
    echo ""
    echo -e "${GREEN}🚀 SSH-MCP is ready for production use on Kubernetes!${NC}"
}

# Function to handle errors
handle_error() {
    echo -e "${RED}❌ Kubernetes deployment failed!${NC}"
    echo -e "${RED}============================================================${NC}"
    echo -e "${YELLOW}📋 Troubleshooting steps:${NC}"
    echo -e "${YELLOW}  1. Check pod status: kubectl get pods -n ${NAMESPACE}${NC}"
    echo -e "${YELLOW}  2. Check pod logs: kubectl logs -n ${NAMESPACE} [pod-name]${NC}"
    echo -e "${YELLOW}  3. Check events: kubectl get events -n ${NAMESPACE}${NC}"
    echo -e "${YELLOW}  4. Check resource usage: kubectl top pods -n ${NAMESPACE}${NC}"
    echo -e "${YELLOW}  5. Restore from backup: ${BACKUP_DIR}${NC}"
    echo ""
    echo -e "${YELLOW}🆘 For support, contact: andre@optinampout.com${NC}"
    exit 1
}

# Main deployment flow
main() {
    trap handle_error ERR
    
    check_prerequisites
    backup_existing_resources
    build_and_push_image
    create_namespace_and_secrets
    deploy_core_resources
    deploy_applications
    configure_autoscaling
    configure_ingress
    wait_for_deployments
    run_health_checks
    show_deployment_summary
}

# Run main function
main "$@"