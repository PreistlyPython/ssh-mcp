/**
 * Kubernetes-Native Deployment for SSH MCP Server
 * Provides clustering support with Kubernetes-native deployment and auto-scaling
 * Leverages MCP ecosystem for enterprise-grade orchestration workflows
 */

import { EventEmitter } from 'events';
import { AuditLogger, AuditEventType } from '../audit/audit-logger.js';
import { MemoryOrchestrator } from '../memory/memory-orchestrator.js';
import { TechnologyStack } from '../ai/context7-integration.js';

export enum KubernetesResourceType {
  DEPLOYMENT = 'deployment',
  SERVICE = 'service',
  CONFIGMAP = 'configmap',
  SECRET = 'secret',
  INGRESS = 'ingress',
  HPA = 'hpa', // Horizontal Pod Autoscaler
  VPA = 'vpa', // Vertical Pod Autoscaler
  PVC = 'pvc', // Persistent Volume Claim
  NETWORKPOLICY = 'networkpolicy',
  SERVICEACCOUNT = 'serviceaccount',
  ROLE = 'role',
  ROLEBINDING = 'rolebinding',
  NAMESPACE = 'namespace'
}

export enum DeploymentStrategy {
  ROLLING_UPDATE = 'rolling_update',
  BLUE_GREEN = 'blue_green',
  CANARY = 'canary',
  RECREATE = 'recreate'
}

export enum ScalingPolicy {
  CPU_BASED = 'cpu_based',
  MEMORY_BASED = 'memory_based',
  CUSTOM_METRICS = 'custom_metrics',
  PREDICTIVE = 'predictive',
  SCHEDULED = 'scheduled'
}

export enum EnvironmentType {
  DEVELOPMENT = 'development',
  STAGING = 'staging',
  PRODUCTION = 'production',
  TESTING = 'testing'
}

export interface KubernetesCluster {
  name: string;
  version: string;
  provider: 'eks' | 'gke' | 'aks' | 'self-managed';
  region: string;
  nodeCount: number;
  nodeInstanceType: string;
  networking: {
    cni: 'calico' | 'flannel' | 'weave' | 'aws-vpc' | 'gce';
    serviceSubnet: string;
    podSubnet: string;
    ingressController: 'nginx' | 'traefik' | 'istio' | 'aws-alb';
  };
  monitoring: {
    prometheus: boolean;
    grafana: boolean;
    jaeger: boolean;
    fluentd: boolean;
  };
  security: {
    rbac: boolean;
    networkPolicies: boolean;
    podSecurityPolicies: boolean;
    encryption: boolean;
  };
}

export interface ApplicationSpec {
  name: string;
  version: string;
  technology: TechnologyStack;
  containerImage: string;
  port: number;
  environment: EnvironmentType;
  replicas: {
    min: number;
    max: number;
    target: number;
  };
  resources: {
    requests: {
      cpu: string;
      memory: string;
    };
    limits: {
      cpu: string;
      memory: string;
    };
  };
  storage: {
    persistent: boolean;
    size: string;
    storageClass: string;
  };
  networking: {
    exposedPorts: number[];
    loadBalancer: boolean;
    ingress: boolean;
    tlsEnabled: boolean;
  };
  healthChecks: {
    readiness: {
      path: string;
      port: number;
      initialDelaySeconds: number;
      periodSeconds: number;
    };
    liveness: {
      path: string;
      port: number;
      initialDelaySeconds: number;
      periodSeconds: number;
    };
  };
  security: {
    runAsNonRoot: boolean;
    readOnlyRootFilesystem: boolean;
    allowPrivilegeEscalation: boolean;
    capabilities: string[];
  };
}

export interface DeploymentRequest {
  sessionId: string;
  userId: string;
  clusterConfig: KubernetesCluster;
  applicationSpec: ApplicationSpec;
  deploymentStrategy: DeploymentStrategy;
  scalingPolicy: ScalingPolicy;
  namespace: string;
  mcpOptions?: {
    includeMonitoring: boolean;
    includeSecurity: boolean;
    includeNetworking: boolean;
    includeStorage: boolean;
  };
}

export interface DeploymentResult {
  deploymentId: string;
  sessionId: string;
  status: 'pending' | 'in_progress' | 'success' | 'failed' | 'rollback';
  mcpWorkflow: string;
  kubernetesManifests: Array<{
    type: KubernetesResourceType;
    name: string;
    content: string;
    namespace: string;
  }>;
  kubectlCommands: string[];
  helmCommands: string[];
  monitoringSetup: Array<{
    type: 'prometheus' | 'grafana' | 'alertmanager';
    config: string;
    dashboards?: string[];
  }>;
  scalingConfiguration: {
    hpa: string;
    vpa?: string;
    customMetrics?: string[];
  };
  securityPolicies: Array<{
    type: 'networkpolicy' | 'podsecuritypolicy' | 'rbac';
    config: string;
  }>;
  endpoints: Array<{
    name: string;
    url: string;
    type: 'internal' | 'external' | 'loadbalancer';
  }>;
  healthChecks: Array<{
    name: string;
    endpoint: string;
    expectedStatus: number;
  }>;
  rollbackPlan: string[];
  estimatedCost: {
    compute: number;
    storage: number;
    networking: number;
    total: number;
    currency: string;
  };
  recommendations: string[];
  nextSteps: string[];
}

/**
 * Kubernetes Deployment Manager
 * Provides comprehensive Kubernetes deployment and scaling capabilities
 */
export class KubernetesDeploymentManager extends EventEmitter {
  private auditLogger: AuditLogger;
  private memoryOrchestrator: MemoryOrchestrator;
  private activeDeployments: Map<string, DeploymentResult> = new Map();

  constructor(
    auditLogger: AuditLogger,
    memoryOrchestrator: MemoryOrchestrator
  ) {
    super();
    this.auditLogger = auditLogger;
    this.memoryOrchestrator = memoryOrchestrator;
  }

  /**
   * Deploy application to Kubernetes with comprehensive orchestration
   */
  async deployApplication(request: DeploymentRequest): Promise<DeploymentResult> {
    const deploymentId = this.generateDeploymentId();
    
    try {
      // Log deployment initiation
      await this.auditLogger.logEvent(AuditEventType.SSH_COMMAND_EXECUTED, {
        userId: request.userId,
        sessionId: request.sessionId,
        description: `Kubernetes deployment initiated: ${request.applicationSpec.name}`,
        outcome: 'success',
        eventDetails: {
          applicationName: request.applicationSpec.name,
          namespace: request.namespace,
          strategy: request.deploymentStrategy,
          clusterName: request.clusterConfig.name
        }
      });

      // Generate deployment workflow
      const result = await this.generateDeploymentWorkflow(deploymentId, request);
      
      // Store for tracking
      this.activeDeployments.set(deploymentId, result);
      
      // Learn from deployment patterns
      await this.memoryOrchestrator.storeWorkflowPattern(
        request.sessionId,
        'kubernetes_deployment',
        {
          applicationSpec: request.applicationSpec,
          clusterConfig: request.clusterConfig,
          deploymentStrategy: request.deploymentStrategy,
          result: result
        }
      );

      this.emit('deployment_initiated', { deploymentId, result });
      
      return result;
    } catch (error) {
      await this.auditLogger.logEvent(AuditEventType.SSH_COMMAND_EXECUTED, {
        userId: request.userId,
        sessionId: request.sessionId,
        description: `Kubernetes deployment failed: ${request.applicationSpec.name}`,
        outcome: 'failure',
        eventDetails: { error: error instanceof Error ? error.message : String(error) }
      });
      
      throw error;
    }
  }

  /**
   * Generate comprehensive deployment workflow
   */
  private async generateDeploymentWorkflow(
    deploymentId: string,
    request: DeploymentRequest
  ): Promise<DeploymentResult> {
    const mcpWorkflow = this.buildKubernetesDeploymentPrompt(request);
    
    return {
      deploymentId,
      sessionId: request.sessionId,
      status: 'pending',
      mcpWorkflow,
      kubernetesManifests: this.generateKubernetesManifests(request),
      kubectlCommands: this.generateKubectlCommands(request),
      helmCommands: this.generateHelmCommands(request),
      monitoringSetup: this.generateMonitoringSetup(request),
      scalingConfiguration: this.generateScalingConfiguration(request),
      securityPolicies: this.generateSecurityPolicies(request),
      endpoints: this.generateEndpoints(request),
      healthChecks: this.generateHealthChecks(request),
      rollbackPlan: this.generateRollbackPlan(request),
      estimatedCost: this.calculateEstimatedCost(request),
      recommendations: this.generateRecommendations(request),
      nextSteps: this.generateNextSteps(request)
    };
  }

  /**
   * Generate Kubernetes manifests
   */
  private generateKubernetesManifests(request: DeploymentRequest): Array<{
    type: KubernetesResourceType;
    name: string;
    content: string;
    namespace: string;
  }> {
    const manifests = [];
    const { applicationSpec, namespace } = request;

    // Namespace
    manifests.push({
      type: KubernetesResourceType.NAMESPACE,
      name: namespace,
      content: this.generateNamespaceManifest(namespace),
      namespace: 'default'
    });

    // ConfigMap
    manifests.push({
      type: KubernetesResourceType.CONFIGMAP,
      name: `${applicationSpec.name}-config`,
      content: this.generateConfigMapManifest(applicationSpec, namespace),
      namespace
    });

    // Secret
    manifests.push({
      type: KubernetesResourceType.SECRET,
      name: `${applicationSpec.name}-secrets`,
      content: this.generateSecretManifest(applicationSpec, namespace),
      namespace
    });

    // Deployment
    manifests.push({
      type: KubernetesResourceType.DEPLOYMENT,
      name: `${applicationSpec.name}-deployment`,
      content: this.generateDeploymentManifest(applicationSpec, namespace, request.deploymentStrategy),
      namespace
    });

    // Service
    manifests.push({
      type: KubernetesResourceType.SERVICE,
      name: `${applicationSpec.name}-service`,
      content: this.generateServiceManifest(applicationSpec, namespace),
      namespace
    });

    // Ingress (if enabled)
    if (applicationSpec.networking.ingress) {
      manifests.push({
        type: KubernetesResourceType.INGRESS,
        name: `${applicationSpec.name}-ingress`,
        content: this.generateIngressManifest(applicationSpec, namespace),
        namespace
      });
    }

    // HPA (Horizontal Pod Autoscaler)
    manifests.push({
      type: KubernetesResourceType.HPA,
      name: `${applicationSpec.name}-hpa`,
      content: this.generateHPAManifest(applicationSpec, namespace, request.scalingPolicy),
      namespace
    });

    // PVC (if persistent storage needed)
    if (applicationSpec.storage.persistent) {
      manifests.push({
        type: KubernetesResourceType.PVC,
        name: `${applicationSpec.name}-pvc`,
        content: this.generatePVCManifest(applicationSpec, namespace),
        namespace
      });
    }

    // Network Policy
    manifests.push({
      type: KubernetesResourceType.NETWORKPOLICY,
      name: `${applicationSpec.name}-netpol`,
      content: this.generateNetworkPolicyManifest(applicationSpec, namespace),
      namespace
    });

    // Service Account
    manifests.push({
      type: KubernetesResourceType.SERVICEACCOUNT,
      name: `${applicationSpec.name}-sa`,
      content: this.generateServiceAccountManifest(applicationSpec, namespace),
      namespace
    });

    return manifests;
  }

  /**
   * Generate kubectl commands
   */
  private generateKubectlCommands(request: DeploymentRequest): string[] {
    const { applicationSpec, namespace } = request;
    
    return [
      // Cluster verification
      'kubectl cluster-info',
      'kubectl get nodes',
      
      // Namespace operations
      `kubectl create namespace ${namespace} --dry-run=client -o yaml | kubectl apply -f -`,
      
      // Apply manifests
      `kubectl apply -f ${applicationSpec.name}-namespace.yaml`,
      `kubectl apply -f ${applicationSpec.name}-configmap.yaml`,
      `kubectl apply -f ${applicationSpec.name}-secrets.yaml`,
      `kubectl apply -f ${applicationSpec.name}-serviceaccount.yaml`,
      `kubectl apply -f ${applicationSpec.name}-deployment.yaml`,
      `kubectl apply -f ${applicationSpec.name}-service.yaml`,
      `kubectl apply -f ${applicationSpec.name}-hpa.yaml`,
      
      // Conditional resources
      ...(applicationSpec.networking.ingress ? [`kubectl apply -f ${applicationSpec.name}-ingress.yaml`] : []),
      ...(applicationSpec.storage.persistent ? [`kubectl apply -f ${applicationSpec.name}-pvc.yaml`] : []),
      
      // Security policies
      `kubectl apply -f ${applicationSpec.name}-netpol.yaml`,
      
      // Verification commands
      `kubectl get pods -n ${namespace} -l app=${applicationSpec.name}`,
      `kubectl get services -n ${namespace}`,
      `kubectl get hpa -n ${namespace}`,
      `kubectl describe deployment ${applicationSpec.name}-deployment -n ${namespace}`,
      
      // Health checks
      `kubectl rollout status deployment/${applicationSpec.name}-deployment -n ${namespace}`,
      `kubectl get events -n ${namespace} --sort-by=.metadata.creationTimestamp`,
      
      // Monitoring
      `kubectl top pods -n ${namespace}`,
      `kubectl top nodes`
    ];
  }

  /**
   * Generate Helm commands (if using Helm)
   */
  private generateHelmCommands(request: DeploymentRequest): string[] {
    const { applicationSpec, namespace } = request;
    
    return [
      // Helm setup
      'helm version',
      'helm repo update',
      
      // Install monitoring stack
      'helm repo add prometheus-community https://prometheus-community.github.io/helm-charts',
      'helm repo add grafana https://grafana.github.io/helm-charts',
      
      // Install Prometheus
      `helm install prometheus prometheus-community/kube-prometheus-stack --namespace monitoring --create-namespace`,
      
      // Install application (if using Helm chart)
      `helm install ${applicationSpec.name} ./${applicationSpec.name}-chart --namespace ${namespace} --create-namespace`,
      
      // Upgrade commands
      `helm upgrade ${applicationSpec.name} ./${applicationSpec.name}-chart --namespace ${namespace}`,
      
      // Status and verification
      `helm list -n ${namespace}`,
      `helm status ${applicationSpec.name} -n ${namespace}`,
      `helm get values ${applicationSpec.name} -n ${namespace}`
    ];
  }

  /**
   * Generate monitoring setup
   */
  private generateMonitoringSetup(request: DeploymentRequest): Array<{
    type: 'prometheus' | 'grafana' | 'alertmanager';
    config: string;
    dashboards?: string[];
  }> {
    const { applicationSpec } = request;
    
    return [
      {
        type: 'prometheus',
        config: this.generatePrometheusConfig(applicationSpec),
        dashboards: []
      },
      {
        type: 'grafana',
        config: this.generateGrafanaConfig(applicationSpec),
        dashboards: [
          'kubernetes-cluster-monitoring',
          'kubernetes-pod-monitoring',
          `${applicationSpec.name}-application-metrics`
        ]
      },
      {
        type: 'alertmanager',
        config: this.generateAlertManagerConfig(applicationSpec)
      }
    ];
  }

  /**
   * Generate scaling configuration
   */
  private generateScalingConfiguration(request: DeploymentRequest): {
    hpa: string;
    vpa?: string;
    customMetrics?: string[];
  } {
    const { applicationSpec, scalingPolicy } = request;
    
    return {
      hpa: this.generateHPAManifest(applicationSpec, request.namespace, scalingPolicy),
      vpa: this.generateVPAManifest(applicationSpec, request.namespace),
      customMetrics: this.generateCustomMetrics(applicationSpec, scalingPolicy)
    };
  }

  /**
   * Generate security policies
   */
  private generateSecurityPolicies(request: DeploymentRequest): Array<{
    type: 'networkpolicy' | 'podsecuritypolicy' | 'rbac';
    config: string;
  }> {
    const { applicationSpec, namespace } = request;
    
    return [
      {
        type: 'networkpolicy',
        config: this.generateNetworkPolicyManifest(applicationSpec, namespace)
      },
      {
        type: 'podsecuritypolicy',
        config: this.generatePodSecurityPolicyManifest(applicationSpec, namespace)
      },
      {
        type: 'rbac',
        config: this.generateRBACManifests(applicationSpec, namespace)
      }
    ];
  }

  /**
   * Generate endpoints
   */
  private generateEndpoints(request: DeploymentRequest): Array<{
    name: string;
    url: string;
    type: 'internal' | 'external' | 'loadbalancer';
  }> {
    const { applicationSpec, namespace } = request;
    
    const endpoints = [
      {
        name: 'Internal Service',
        url: `http://${applicationSpec.name}-service.${namespace}.svc.cluster.local:${applicationSpec.port}`,
        type: 'internal' as 'internal' | 'external' | 'loadbalancer'
      }
    ];

    if (applicationSpec.networking.loadBalancer) {
      endpoints.push({
        name: 'Load Balancer',
        url: `http://${applicationSpec.name}-service-lb.${namespace}.svc.cluster.local:${applicationSpec.port}`,
        type: 'loadbalancer' as 'internal' | 'external' | 'loadbalancer'
      });
    }

    if (applicationSpec.networking.ingress) {
      endpoints.push({
        name: 'Ingress',
        url: `https://${applicationSpec.name}.example.com`,
        type: 'external' as 'internal' | 'external' | 'loadbalancer'
      });
    }

    return endpoints;
  }

  /**
   * Generate health checks
   */
  private generateHealthChecks(request: DeploymentRequest): Array<{
    name: string;
    endpoint: string;
    expectedStatus: number;
  }> {
    const { applicationSpec, namespace } = request;
    
    return [
      {
        name: 'Application Health',
        endpoint: `http://${applicationSpec.name}-service.${namespace}.svc.cluster.local:${applicationSpec.port}${applicationSpec.healthChecks.readiness.path}`,
        expectedStatus: 200
      },
      {
        name: 'Application Liveness',
        endpoint: `http://${applicationSpec.name}-service.${namespace}.svc.cluster.local:${applicationSpec.port}${applicationSpec.healthChecks.liveness.path}`,
        expectedStatus: 200
      },
      {
        name: 'Kubernetes API',
        endpoint: 'https://kubernetes.default.svc.cluster.local/api/v1',
        expectedStatus: 200
      }
    ];
  }

  /**
   * Generate rollback plan
   */
  private generateRollbackPlan(request: DeploymentRequest): string[] {
    const { applicationSpec, namespace } = request;
    
    return [
      `kubectl rollout undo deployment/${applicationSpec.name}-deployment -n ${namespace}`,
      `kubectl rollout status deployment/${applicationSpec.name}-deployment -n ${namespace}`,
      `kubectl get pods -n ${namespace} -l app=${applicationSpec.name}`,
      `kubectl describe deployment ${applicationSpec.name}-deployment -n ${namespace}`,
      `kubectl get events -n ${namespace} --sort-by=.metadata.creationTimestamp | tail -20`
    ];
  }

  /**
   * Calculate estimated cost
   */
  private calculateEstimatedCost(request: DeploymentRequest): {
    compute: number;
    storage: number;
    networking: number;
    total: number;
    currency: string;
  } {
    const { applicationSpec, clusterConfig } = request;
    
    // Simplified cost calculation (would be enhanced with actual provider pricing)
    const computeCost = applicationSpec.replicas.target * 0.05; // $0.05 per pod per hour
    const storageCost = applicationSpec.storage.persistent ? 
      parseInt(applicationSpec.storage.size.replace('Gi', '')) * 0.001 : 0; // $0.001 per GB per hour
    const networkingCost = applicationSpec.networking.loadBalancer ? 0.025 : 0; // $0.025 per LB per hour
    
    return {
      compute: computeCost,
      storage: storageCost,
      networking: networkingCost,
      total: computeCost + storageCost + networkingCost,
      currency: 'USD'
    };
  }

  /**
   * Generate recommendations
   */
  private generateRecommendations(request: DeploymentRequest): string[] {
    const { applicationSpec, clusterConfig } = request;
    
    const recommendations = [
      'Monitor resource utilization and adjust requests/limits as needed',
      'Set up automated backup procedures for persistent data',
      'Implement comprehensive logging and monitoring',
      'Regular security scanning and updates',
      'Test disaster recovery procedures'
    ];

    if (applicationSpec.replicas.min === applicationSpec.replicas.max) {
      recommendations.push('Consider enabling horizontal pod autoscaling for better resource utilization');
    }

    if (!applicationSpec.networking.tlsEnabled) {
      recommendations.push('Enable TLS/SSL for production workloads');
    }

    if (!clusterConfig.security.networkPolicies) {
      recommendations.push('Implement network policies for enhanced security');
    }

    return recommendations;
  }

  /**
   * Generate next steps
   */
  private generateNextSteps(request: DeploymentRequest): string[] {
    const { applicationSpec } = request;
    
    return [
      'Apply Kubernetes manifests to the cluster',
      'Verify deployment status and pod health',
      'Configure monitoring and alerting',
      'Set up CI/CD pipeline for automated deployments',
      'Implement backup and disaster recovery procedures',
      'Conduct load testing and performance optimization',
      'Set up log aggregation and analysis',
      'Configure security scanning and compliance monitoring'
    ];
  }

  // Manifest Generation Methods

  private generateNamespaceManifest(namespace: string): string {
    return `apiVersion: v1
kind: Namespace
metadata:
  name: ${namespace}
  labels:
    name: ${namespace}
    managed-by: ssh-mcp-server`;
  }

  private generateConfigMapManifest(appSpec: ApplicationSpec, namespace: string): string {
    return `apiVersion: v1
kind: ConfigMap
metadata:
  name: ${appSpec.name}-config
  namespace: ${namespace}
data:
  NODE_ENV: "${appSpec.environment}"
  PORT: "${appSpec.port}"
  LOG_LEVEL: "info"
  HEALTH_CHECK_PATH: "${appSpec.healthChecks.readiness.path}"`;
  }

  private generateSecretManifest(appSpec: ApplicationSpec, namespace: string): string {
    return `apiVersion: v1
kind: Secret
metadata:
  name: ${appSpec.name}-secrets
  namespace: ${namespace}
type: Opaque
data:
  # Base64 encoded secrets (example)
  DATABASE_PASSWORD: cGFzc3dvcmQxMjM=
  JWT_SECRET: c2VjcmV0a2V5MTIz`;
  }

  private generateDeploymentManifest(
    appSpec: ApplicationSpec, 
    namespace: string, 
    strategy: DeploymentStrategy
  ): string {
    const strategyConfig = this.getDeploymentStrategyConfig(strategy);
    
    return `apiVersion: apps/v1
kind: Deployment
metadata:
  name: ${appSpec.name}-deployment
  namespace: ${namespace}
  labels:
    app: ${appSpec.name}
    version: ${appSpec.version}
spec:
  replicas: ${appSpec.replicas.target}
  strategy:
    type: ${strategyConfig.type}
    ${strategyConfig.config}
  selector:
    matchLabels:
      app: ${appSpec.name}
  template:
    metadata:
      labels:
        app: ${appSpec.name}
        version: ${appSpec.version}
    spec:
      serviceAccountName: ${appSpec.name}-sa
      securityContext:
        runAsNonRoot: ${appSpec.security.runAsNonRoot}
        runAsUser: 1000
        fsGroup: 2000
      containers:
      - name: ${appSpec.name}
        image: ${appSpec.containerImage}
        ports:
        - containerPort: ${appSpec.port}
          name: http
        resources:
          requests:
            cpu: ${appSpec.resources.requests.cpu}
            memory: ${appSpec.resources.requests.memory}
          limits:
            cpu: ${appSpec.resources.limits.cpu}
            memory: ${appSpec.resources.limits.memory}
        env:
        - name: NODE_ENV
          valueFrom:
            configMapKeyRef:
              name: ${appSpec.name}-config
              key: NODE_ENV
        - name: PORT
          valueFrom:
            configMapKeyRef:
              name: ${appSpec.name}-config
              key: PORT
        envFrom:
        - configMapRef:
            name: ${appSpec.name}-config
        - secretRef:
            name: ${appSpec.name}-secrets
        readinessProbe:
          httpGet:
            path: ${appSpec.healthChecks.readiness.path}
            port: ${appSpec.healthChecks.readiness.port}
          initialDelaySeconds: ${appSpec.healthChecks.readiness.initialDelaySeconds}
          periodSeconds: ${appSpec.healthChecks.readiness.periodSeconds}
        livenessProbe:
          httpGet:
            path: ${appSpec.healthChecks.liveness.path}
            port: ${appSpec.healthChecks.liveness.port}
          initialDelaySeconds: ${appSpec.healthChecks.liveness.initialDelaySeconds}
          periodSeconds: ${appSpec.healthChecks.liveness.periodSeconds}
        securityContext:
          allowPrivilegeEscalation: ${appSpec.security.allowPrivilegeEscalation}
          readOnlyRootFilesystem: ${appSpec.security.readOnlyRootFilesystem}
          capabilities:
            drop:
            - ALL
            add: ${JSON.stringify(appSpec.security.capabilities)}
        ${appSpec.storage.persistent ? `volumeMounts:
        - name: storage
          mountPath: /app/data` : ''}
      ${appSpec.storage.persistent ? `volumes:
      - name: storage
        persistentVolumeClaim:
          claimName: ${appSpec.name}-pvc` : ''}`;
  }

  private generateServiceManifest(appSpec: ApplicationSpec, namespace: string): string {
    return `apiVersion: v1
kind: Service
metadata:
  name: ${appSpec.name}-service
  namespace: ${namespace}
  labels:
    app: ${appSpec.name}
spec:
  type: ${appSpec.networking.loadBalancer ? 'LoadBalancer' : 'ClusterIP'}
  ports:
  - port: ${appSpec.port}
    targetPort: http
    protocol: TCP
    name: http
  selector:
    app: ${appSpec.name}`;
  }

  private generateIngressManifest(appSpec: ApplicationSpec, namespace: string): string {
    return `apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: ${appSpec.name}-ingress
  namespace: ${namespace}
  annotations:
    kubernetes.io/ingress.class: nginx
    cert-manager.io/cluster-issuer: letsencrypt-prod
    nginx.ingress.kubernetes.io/ssl-redirect: "true"
spec:
  tls:
  - hosts:
    - ${appSpec.name}.example.com
    secretName: ${appSpec.name}-tls
  rules:
  - host: ${appSpec.name}.example.com
    http:
      paths:
      - path: /
        pathType: Prefix
        backend:
          service:
            name: ${appSpec.name}-service
            port:
              number: ${appSpec.port}`;
  }

  private generateHPAManifest(
    appSpec: ApplicationSpec, 
    namespace: string, 
    scalingPolicy: ScalingPolicy
  ): string {
    const metrics = this.getScalingMetrics(scalingPolicy);
    
    return `apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: ${appSpec.name}-hpa
  namespace: ${namespace}
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: ${appSpec.name}-deployment
  minReplicas: ${appSpec.replicas.min}
  maxReplicas: ${appSpec.replicas.max}
  metrics:
${metrics}
  behavior:
    scaleDown:
      stabilizationWindowSeconds: 300
      policies:
      - type: Percent
        value: 50
        periodSeconds: 60
    scaleUp:
      stabilizationWindowSeconds: 60
      policies:
      - type: Percent
        value: 100
        periodSeconds: 60`;
  }

  private generatePVCManifest(appSpec: ApplicationSpec, namespace: string): string {
    return `apiVersion: v1
kind: PersistentVolumeClaim
metadata:
  name: ${appSpec.name}-pvc
  namespace: ${namespace}
spec:
  accessModes:
    - ReadWriteOnce
  storageClassName: ${appSpec.storage.storageClass}
  resources:
    requests:
      storage: ${appSpec.storage.size}`;
  }

  private generateNetworkPolicyManifest(appSpec: ApplicationSpec, namespace: string): string {
    return `apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: ${appSpec.name}-netpol
  namespace: ${namespace}
spec:
  podSelector:
    matchLabels:
      app: ${appSpec.name}
  policyTypes:
  - Ingress
  - Egress
  ingress:
  - from:
    - namespaceSelector:
        matchLabels:
          name: ${namespace}
    - namespaceSelector:
        matchLabels:
          name: ingress-nginx
    ports:
    - protocol: TCP
      port: ${appSpec.port}
  egress:
  - to: []
    ports:
    - protocol: TCP
      port: 53
    - protocol: UDP
      port: 53
  - to: []
    ports:
    - protocol: TCP
      port: 443
    - protocol: TCP
      port: 80`;
  }

  private generateServiceAccountManifest(appSpec: ApplicationSpec, namespace: string): string {
    return `apiVersion: v1
kind: ServiceAccount
metadata:
  name: ${appSpec.name}-sa
  namespace: ${namespace}
automountServiceAccountToken: false`;
  }

  private generateVPAManifest(appSpec: ApplicationSpec, namespace: string): string {
    return `apiVersion: autoscaling.k8s.io/v1
kind: VerticalPodAutoscaler
metadata:
  name: ${appSpec.name}-vpa
  namespace: ${namespace}
spec:
  targetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: ${appSpec.name}-deployment
  updatePolicy:
    updateMode: "Auto"
  resourcePolicy:
    containerPolicies:
    - containerName: ${appSpec.name}
      minAllowed:
        cpu: 100m
        memory: 128Mi
      maxAllowed:
        cpu: 2
        memory: 2Gi`;
  }

  private generatePodSecurityPolicyManifest(appSpec: ApplicationSpec, namespace: string): string {
    return `apiVersion: policy/v1beta1
kind: PodSecurityPolicy
metadata:
  name: ${appSpec.name}-psp
spec:
  privileged: false
  allowPrivilegeEscalation: ${appSpec.security.allowPrivilegeEscalation}
  requiredDropCapabilities:
    - ALL
  allowedCapabilities: ${JSON.stringify(appSpec.security.capabilities)}
  volumes:
    - 'configMap'
    - 'emptyDir'
    - 'projected'
    - 'secret'
    - 'downwardAPI'
    - 'persistentVolumeClaim'
  hostNetwork: false
  hostIPC: false
  hostPID: false
  runAsUser:
    rule: 'MustRunAsNonRoot'
  seLinux:
    rule: 'RunAsAny'
  fsGroup:
    rule: 'RunAsAny'`;
  }

  private generateRBACManifests(appSpec: ApplicationSpec, namespace: string): string {
    return `apiVersion: rbac.authorization.k8s.io/v1
kind: Role
metadata:
  namespace: ${namespace}
  name: ${appSpec.name}-role
rules:
- apiGroups: [""]
  resources: ["configmaps", "secrets"]
  verbs: ["get", "list"]
---
apiVersion: rbac.authorization.k8s.io/v1
kind: RoleBinding
metadata:
  name: ${appSpec.name}-rolebinding
  namespace: ${namespace}
subjects:
- kind: ServiceAccount
  name: ${appSpec.name}-sa
  namespace: ${namespace}
roleRef:
  kind: Role
  name: ${appSpec.name}-role
  apiGroup: rbac.authorization.k8s.io`;
  }

  private generatePrometheusConfig(appSpec: ApplicationSpec): string {
    return `global:
  scrape_interval: 15s
  evaluation_interval: 15s

rule_files:
  - "${appSpec.name}_rules.yml"

scrape_configs:
  - job_name: '${appSpec.name}'
    kubernetes_sd_configs:
    - role: pod
    relabel_configs:
    - source_labels: [__meta_kubernetes_pod_label_app]
      action: keep
      regex: ${appSpec.name}
    - source_labels: [__meta_kubernetes_pod_container_port_name]
      action: keep
      regex: http
    - source_labels: [__meta_kubernetes_pod_name]
      target_label: instance
    - source_labels: [__meta_kubernetes_namespace]
      target_label: kubernetes_namespace
    - source_labels: [__meta_kubernetes_pod_name]
      target_label: kubernetes_pod_name`;
  }

  private generateGrafanaConfig(appSpec: ApplicationSpec): string {
    return `{
  "dashboard": {
    "id": null,
    "title": "${appSpec.name} Application Metrics",
    "tags": ["kubernetes", "${appSpec.name}"],
    "timezone": "browser",
    "panels": [
      {
        "title": "CPU Usage",
        "type": "graph",
        "targets": [
          {
            "expr": "rate(container_cpu_usage_seconds_total{pod=~\\"${appSpec.name}.*\\"}[5m])",
            "legendFormat": "{{pod}}"
          }
        ]
      },
      {
        "title": "Memory Usage",
        "type": "graph", 
        "targets": [
          {
            "expr": "container_memory_usage_bytes{pod=~\\"${appSpec.name}.*\\"}",
            "legendFormat": "{{pod}}"
          }
        ]
      },
      {
        "title": "Request Rate",
        "type": "graph",
        "targets": [
          {
            "expr": "rate(http_requests_total{job=\\"${appSpec.name}\\"}[5m])",
            "legendFormat": "{{method}} {{status}}"
          }
        ]
      }
    ],
    "time": {
      "from": "now-1h",
      "to": "now"
    },
    "refresh": "5s"
  }
}`;
  }

  private generateAlertManagerConfig(appSpec: ApplicationSpec): string {
    return `groups:
- name: ${appSpec.name}.rules
  rules:
  - alert: ${appSpec.name}HighCPU
    expr: rate(container_cpu_usage_seconds_total{pod=~"${appSpec.name}.*"}[5m]) > 0.8
    for: 2m
    labels:
      severity: warning
    annotations:
      summary: "High CPU usage detected"
      description: "CPU usage is above 80% for {{ $labels.pod }}"
  
  - alert: ${appSpec.name}HighMemory
    expr: container_memory_usage_bytes{pod=~"${appSpec.name}.*"} / container_spec_memory_limit_bytes > 0.9
    for: 2m
    labels:
      severity: critical
    annotations:
      summary: "High memory usage detected"
      description: "Memory usage is above 90% for {{ $labels.pod }}"
  
  - alert: ${appSpec.name}PodDown
    expr: up{job="${appSpec.name}"} == 0
    for: 1m
    labels:
      severity: critical
    annotations:
      summary: "Pod is down"
      description: "{{ $labels.instance }} of job {{ $labels.job }} has been down for more than 1 minute"`;
  }

  // Helper Methods

  private getDeploymentStrategyConfig(strategy: DeploymentStrategy): { type: string; config: string } {
    switch (strategy) {
      case DeploymentStrategy.ROLLING_UPDATE:
        return {
          type: 'RollingUpdate',
          config: `rollingUpdate:
      maxSurge: 1
      maxUnavailable: 0`
        };
      case DeploymentStrategy.RECREATE:
        return {
          type: 'Recreate',
          config: ''
        };
      default:
        return {
          type: 'RollingUpdate',
          config: `rollingUpdate:
      maxSurge: 1
      maxUnavailable: 0`
        };
    }
  }

  private getScalingMetrics(scalingPolicy: ScalingPolicy): string {
    switch (scalingPolicy) {
      case ScalingPolicy.CPU_BASED:
        return `  - type: Resource
    resource:
      name: cpu
      target:
        type: Utilization
        averageUtilization: 70`;
      
      case ScalingPolicy.MEMORY_BASED:
        return `  - type: Resource
    resource:
      name: memory
      target:
        type: Utilization
        averageUtilization: 80`;
      
      case ScalingPolicy.CUSTOM_METRICS:
        return `  - type: Pods
    pods:
      metric:
        name: http_requests_per_second
      target:
        type: AverageValue
        averageValue: "1k"`;
      
      default:
        return `  - type: Resource
    resource:
      name: cpu
      target:
        type: Utilization
        averageUtilization: 70
  - type: Resource
    resource:
      name: memory
      target:
        type: Utilization
        averageUtilization: 80`;
    }
  }

  private generateCustomMetrics(appSpec: ApplicationSpec, scalingPolicy: ScalingPolicy): string[] {
    if (scalingPolicy !== ScalingPolicy.CUSTOM_METRICS) {
      return [];
    }
    
    return [
      'http_requests_per_second',
      'active_connections',
      'queue_length',
      'response_time_p95'
    ];
  }

  private buildKubernetesDeploymentPrompt(request: DeploymentRequest): string {
    const { applicationSpec, clusterConfig, deploymentStrategy, namespace } = request;
    
    return `
Deploy application to Kubernetes with enterprise-grade orchestration:

**Kubernetes Deployment Workflow for ${applicationSpec.name}:**
1. **Cluster Preparation**: Prepare Kubernetes cluster for deployment
   - Verify cluster health and node availability
   - Check cluster version compatibility
   - Validate networking and storage configuration
   - Ensure required controllers and operators are installed

2. **Resource Planning**: Plan Kubernetes resources
   - Calculate resource requirements and limits
   - Plan horizontal and vertical scaling strategies
   - Design storage and networking requirements
   - Plan security policies and RBAC configuration

3. **Deployment Strategy**: Implement ${deploymentStrategy} deployment
   - Generate comprehensive Kubernetes manifests
   - Configure deployment rollout strategy
   - Set up health checks and readiness probes
   - Plan rollback and disaster recovery procedures

4. **Monitoring and Observability**: Set up comprehensive monitoring
   - Configure Prometheus metrics collection
   - Set up Grafana dashboards and alerts
   - Implement distributed tracing and logging
   - Configure SLI/SLO monitoring and alerting

5. **Security Hardening**: Implement Kubernetes security best practices
   - Configure network policies and segmentation
   - Set up RBAC and service account permissions
   - Implement pod security policies and contexts
   - Configure secret management and encryption

6. **Auto-scaling Configuration**: Configure intelligent scaling
   - Set up Horizontal Pod Autoscaler (HPA)
   - Configure Vertical Pod Autoscaler (VPA)
   - Implement custom metrics-based scaling
   - Plan cluster auto-scaling strategies

7. **Operational Excellence**: Ensure production readiness
   - Set up CI/CD pipeline integration
   - Configure backup and disaster recovery
   - Implement cost optimization strategies
   - Plan capacity planning and performance tuning

Please provide comprehensive Kubernetes deployment guidance with enterprise-grade orchestration, monitoring, and security.
    `.trim();
  }

  private generateDeploymentId(): string {
    return `k8s_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Get deployment status
   */
  getDeploymentStatus(deploymentId: string): DeploymentResult | undefined {
    return this.activeDeployments.get(deploymentId);
  }

  /**
   * Get all active deployments for session
   */
  getSessionDeployments(sessionId: string): DeploymentResult[] {
    return Array.from(this.activeDeployments.values())
      .filter(deployment => deployment.sessionId === sessionId);
  }

  /**
   * Update deployment status
   */
  async updateDeploymentStatus(
    deploymentId: string, 
    status: DeploymentResult['status'],
    userId?: string
  ): Promise<void> {
    const deployment = this.activeDeployments.get(deploymentId);
    if (deployment) {
      deployment.status = status;
      
      if (userId) {
        await this.auditLogger.logEvent(AuditEventType.SSH_COMMAND_EXECUTED, {
          userId,
          sessionId: deployment.sessionId,
          description: `Kubernetes deployment status updated: ${status}`,
          outcome: 'success',
          eventDetails: { deploymentId, status }
        });
      }
      
      this.emit('deployment_status_updated', { deploymentId, status });
    }
  }

  /**
   * Clean up completed deployments
   */
  cleanupDeployments(maxAge: number = 86400000): void { // 24 hours default
    const cutoff = Date.now() - maxAge;
    for (const [deploymentId, deployment] of this.activeDeployments.entries()) {
      if (parseInt(deploymentId.split('_')[1]) < cutoff) {
        this.activeDeployments.delete(deploymentId);
      }
    }
  }
}