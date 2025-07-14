# SSH-MCP: Enterprise-Grade SSH Operations with AI Intelligence

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![MCP Compatible](https://img.shields.io/badge/MCP-Compatible-blue.svg)](https://modelcontextprotocol.io)
[![Security: SOC2](https://img.shields.io/badge/Security-SOC2%20Compliant-green.svg)](https://www.aicpa.org/soc2)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0+-blue.svg)](https://www.typescriptlang.org/)
[![Node.js](https://img.shields.io/badge/Node.js-20+-brightgreen.svg)](https://nodejs.org/)
[![Enterprise Ready](https://img.shields.io/badge/Enterprise-Ready-gold.svg)](#enterprise-features)

SSH-MCP is the first AI-native SSH management server that provides enterprise-grade remote operations with integrated AI intelligence, security compliance, and adaptive learning capabilities. It orchestrates multiple MCPs to deliver context-aware assistance, real-time documentation, and intelligent automation for remote development workflows.

## 🌟 Key Features

### 🔐 Enterprise Security
- **SOC2 Compliant**: Full compliance with enterprise security standards
- **AES-256-GCM Encryption**: Military-grade encryption for credentials at rest
- **Multi-Factor Authentication**: Support for TOTP, SMS, hardware tokens, and biometric auth
- **Circuit Breaker Protection**: 8 resilient circuits protecting all critical services
- **Comprehensive Audit Trails**: Complete logging with compliance reporting

### 🤖 AI-Powered Intelligence
- **Context-Aware Assistance**: Real-time command suggestions based on current context
- **Technology Detection**: Automatic project stack identification and recommendations
- **Pattern Recognition**: ML-powered learning from command history
- **Community Intelligence**: GitHub pattern mining and best practice discovery
- **Predictive Operations**: Anticipate issues using trend analysis

### 🚀 Developer Productivity
- **89 Specialized Tools**: Comprehensive toolset across 10 major categories
- **Multi-Framework Support**: Laravel, Node.js, React, Go, Rust, Kubernetes
- **Smart File Operations**: Operational transforms with multiple fallback strategies
- **Zero-Downtime Deployments**: Intelligent deployment strategies
- **Performance Benchmarking**: Industry-standard comparisons

### 📊 Monitoring & Compliance
- **Real-Time Monitoring**: Performance metrics and system health tracking
- **Compliance Frameworks**: SOC2, GDPR, NIST, HIPAA, PCI-DSS, ISO 27001
- **Error Analysis**: Intelligent error diagnosis with MCP orchestration
- **Alert Management**: Proactive alerting with automatic remediation

## 📋 Table of Contents

- [Installation](#installation)
- [Quick Start](#quick-start)
- [Configuration](#configuration)
- [Tool Categories](#tool-categories)
- [Security](#security)
- [API Reference](#api-reference)
- [Examples](#examples)
- [Contributing](#contributing)
- [License](#license)

## 🛠️ Installation

### Prerequisites

- Node.js 18+ and npm/yarn
- Claude Code CLI with MCP support
- SSH access to target servers
- Git for version control

### Install SSH-MCP

```bash
# Clone the repository
git clone https://github.com/LYFTIUM-INC/ssh-mcp.git
cd ssh-mcp

# Install dependencies
npm install

# Build the project
npm run build

# Configure Claude Code
claude mcp add /path/to/ssh-mcp
```

## 🚀 Quick Start

### 1. Configure Server Credentials

Create a `.env` file in the project root:

```env
# Example server configuration
MY_SERVER_HOST=example.com
MY_SERVER_PORT=22
MY_SERVER_USERNAME=user
MY_SERVER_PASSWORD=secure_password
MY_SERVER_DEFAULT_DIR=/home/user
MY_SERVER_DESCRIPTION=Production Server

# Performance Tuning
SSH_MAX_POOL_SIZE=1000        # Maximum concurrent connections
SSH_MIN_POOL_SIZE=10          # Minimum pooled connections
SSH_COMMAND_TIMEOUT=60000     # Command timeout in milliseconds
```

### 2. Connect and Execute

```javascript
// Quick connect to predefined server
const session = await quickConnect({ serverName: "my-server" });

// Execute commands
const result = await executeRemoteCommand({
  sessionId: session.id,
  command: "ls -la"
});

console.log(result.stdout);
```

### 3. Use AI Intelligence

```javascript
// Get intelligent command suggestions
const suggestions = await getIntelligentCommandHelp({
  sessionId: session.id,
  command: "find",
  currentDirectory: "/home/user"
});

// Detect project technology
const tech = await detectProjectTechnology({
  sessionId: session.id,
  projectPath: "/home/user/project"
});
```

## ⚙️ Configuration

### Environment Variables

SSH-MCP uses environment variables for server configuration. Each server requires:

```env
# Server naming convention: SERVERNAME_PROPERTY
SERVERNAME_HOST=hostname.com
SERVERNAME_PORT=22
SERVERNAME_USERNAME=username
SERVERNAME_PASSWORD=password        # Optional if using key
SERVERNAME_PRIVATE_KEY=key_content  # Optional if using password
SERVERNAME_PRIVATE_KEY_PATH=/path   # Optional path to key file
SERVERNAME_PASSPHRASE=passphrase    # Optional for encrypted keys
SERVERNAME_DEFAULT_DIR=/home/user   # Optional default directory
SERVERNAME_DESCRIPTION=Description   # Optional server description
```

### Claude Code Configuration

Add SSH-MCP to Claude Code:

```bash
# Add the MCP server
claude mcp add ssh-mcp

# Configure with environment variables
claude mcp configure ssh-mcp --env MY_SERVER_HOST=example.com --env MY_SERVER_USERNAME=user
```

### Alternative Client Configuration

<details>
<summary>Cursor Configuration</summary>

Add to `~/.cursor/settings.json`:

```json
{
  "mcp.servers": {
    "ssh-mcp": {
      "command": "node",
      "args": ["/path/to/ssh-mcp/build/index.js"],
      "env": {
        "NODE_PATH": "/path/to/ssh-mcp/node_modules"
      }
    }
  }
}
```
</details>

<details>
<summary>Windsurf Configuration</summary>

Add to `~/.windsurf/settings.json`:

```json
{
  "mcp": {
    "mcpServers": {
      "ssh-mcp": {
        "command": "node",
        "args": ["/path/to/ssh-mcp/build/index.js"],
        "env": {
          "NODE_PATH": "/path/to/ssh-mcp/node_modules"
        }
      }
    }
  }
}
```
</details>

## 📂 Tool Categories

### 1. Connection Management (7 tools)
- `quick_connect` - Connect to predefined servers
- `list_predefined_servers` - List configured servers
- `create_ssh_session` - Create custom SSH sessions
- `list_sessions` - View active sessions
- `close_session` - Terminate sessions
- `get_performance_metrics` - Real-time performance data
- `get_security_metrics` - Security posture information

### 2. Core SSH Operations (3 tools)
- `execute_remote_command` - Run commands remotely
- `transfer_file` - Upload/download files
- `close_session` - Clean session termination

### 3. Security & Authentication (11 tools)
- `store_credential` - Secure credential storage
- `retrieve_credential` - Secure credential retrieval
- `list_credentials` - Credential management
- `rotate_credential` - Automatic rotation
- `delete_credential` - Secure deletion
- `configure_mfa` - Multi-factor authentication
- `get_credential_protection_stats` - Security metrics
- `get_credentials_requiring_rotation` - Rotation management
- `get_credential_access_logs` - Audit trails
- `get_circuit_breaker_status` - Circuit health
- `reset_circuit_breaker` - Manual recovery

### 4. AI Intelligence (8 tools)
- `get_intelligent_command_help` - Context-aware assistance
- `get_technology_documentation` - Real-time docs
- `detect_project_technology` - Auto-detection
- `search_github_patterns` - Pattern discovery
- `discover_best_practices` - Best practices
- `get_community_insights` - Community wisdom
- `create_or_update_sitemap` - Sitemap generation
- `get_monitoring_insights` - Intelligent monitoring

### 5. Memory & Learning (5 tools)
- `record_command_memory` - Pattern recognition
- `get_command_suggestions` - Smart suggestions
- `get_learning_insights` - Learning analysis
- `get_memory_statistics` - Memory metrics
- `persist_ssh_operation` - Long-term storage

### 6. Framework Support
- **Laravel/PHP** (2 tools)
  - `laravel_artisan_command` - Artisan commands
  - `laravel_deploy` - Zero-downtime deployment
  
- **Node.js** (2 tools)
  - `nodejs_process_management` - PM2 integration
  - `nodejs_realtime_setup` - Real-time features
  
- **React/Next.js** (1 tool)
  - `react_smart_component_edit` - Intelligent editing
  
- **Go** (3 tools)
  - `go_module_init` - Module initialization
  - `go_test_generation` - Test generation
  - `go_dependency_audit` - Security audit
  
- **Rust** (3 tools)
  - `rust_project_setup` - Project creation
  - `rust_async_patterns` - Async patterns
  - `rust_memory_optimization` - Memory optimization
  
- **Kubernetes** (1 tool)
  - `kubernetes_deploy` - Auto-scaling deployment

### 7. Error Monitoring & Resilience (8 tools)
- `get_error_monitoring_stats` - Error statistics
- `get_active_alerts` - Active alerts
- `get_error_analysis` - Error diagnosis
- `acknowledge_alert` - Alert management
- `resolve_alert` - Alert resolution
- `get_circuit_breaker_status` - Circuit status
- `reset_circuit_breaker` - Circuit recovery
- `analyze_workflow_patterns` - Pattern analysis

### 8. Compliance & Audit (9 tools)
- `run_compliance_assessment` - Compliance checks
- `get_compliance_status` - Status monitoring
- `generate_compliance_report` - Report generation
- `check_compliance_control` - Control verification
- `get_data_retention_compliance` - Data compliance
- `get_privacy_compliance` - Privacy compliance
- `remediate_compliance_violation` - Remediation
- `get_compliance_statistics` - Metrics
- `export_compliance_data` - Data export

### 9. Advanced Operations (9 tools)
- `safe_file_edit` - Multi-strategy editing
- `smart_file_edit` - Operational transforms
- `setup_testing_suite` - Test framework setup
- `create_intelligent_backup` - Smart backups
- `restore_from_backup` - Intelligent restore
- `analyze_backup_patterns` - Backup optimization
- `ml_code_analysis` - AI code analysis
- `predict_next_commands` - Command prediction
- `optimize_workflow_with_ml` - ML optimization

## 🔒 Security

### Best Practices

1. **Never commit credentials**: Use environment variables
2. **Rotate credentials regularly**: Set rotation schedules
3. **Use MFA**: Enable multi-factor authentication
4. **Audit access**: Review credential access logs
5. **Encrypt sensitive data**: All credentials encrypted at rest

### Security Features

- **Encryption**: AES-256-GCM for data at rest
- **Key Management**: Secure key storage and rotation
- **Access Control**: Role-based access control
- **Audit Logging**: Complete audit trail
- **Compliance**: SOC2, GDPR, NIST compliant

### Security Checklist

- [ ] Configure comprehensive `.gitignore`
- [ ] Set up credential rotation schedules
- [ ] Enable MFA for production access
- [ ] Configure compliance monitoring
- [ ] Review audit logs regularly

## 📚 API Reference

### Connection Management

```typescript
// Quick connect to predefined server
quickConnect(params: { serverName: string }): Promise<{ sessionId: string }>

// Create custom SSH session
createSSHSession(params: {
  host: string
  username: string
  password?: string
  privateKey?: string
  port?: number
}): Promise<{ sessionId: string }>

// List active sessions
listSessions(): Promise<Session[]>

// Get performance metrics
getPerformanceMetrics(): Promise<PerformanceData>
```

### Command Execution

```typescript
// Execute remote command
executeRemoteCommand(params: {
  sessionId: string
  command: string
}): Promise<{
  exitCode: number
  stdout: string
  stderr: string
}>

// Transfer files
transferFile(params: {
  sessionId: string
  localPath: string
  remotePath: string
  direction: "upload" | "download"
}): Promise<void>
```

### AI Intelligence

```typescript
// Get intelligent command help
getIntelligentCommandHelp(params: {
  sessionId: string
  command: string
  currentDirectory?: string
}): Promise<{
  suggestions: CommandSuggestion[]
  contextualHelp: string
  bestPractices: string[]
}>

// Detect project technology
detectProjectTechnology(params: {
  sessionId: string
  projectPath: string
}): Promise<{
  primary: string
  secondary: string[]
  confidence: number
}>
```

## 💡 Examples

### Basic SSH Operations

```javascript
// Connect and execute commands
const session = await quickConnect({ serverName: "production" });

const result = await executeRemoteCommand({
  sessionId: session.id,
  command: "docker ps"
});

console.log(result.stdout);
```

### Advanced File Editing

```javascript
// Smart file editing with operational transforms
await smartFileEdit({
  sessionId: session.id,
  filePath: "/home/user/app.js",
  operations: [{
    id: "op1",
    type: "replace",
    oldContent: "const port = 3000",
    content: "const port = process.env.PORT || 3000"
  }],
  strategy: {
    type: "operational_transform",
    validation: {
      syntaxCheck: true,
      lintCheck: true
    }
  }
});
```

### Laravel Deployment

```javascript
// Zero-downtime Laravel deployment
await laravelDeploy({
  sessionId: session.id,
  projectPath: "/var/www/app",
  environment: "production",
  strategy: "blue-green"
});
```

### Compliance Reporting

```javascript
// Generate SOC2 compliance report
const report = await generateComplianceReport({
  framework: "soc2",
  startDate: "2024-01-01",
  endDate: "2024-12-31"
});

// Export for external audit
const exportData = await exportComplianceData({
  format: "pdf"
});
```

## 🤝 Contributing

We welcome contributions! Please see our [Contributing Guide](CONTRIBUTING.md) for details.

### Development Setup

```bash
# Clone and install
git clone https://github.com/LYFTIUM-INC/ssh-mcp.git
cd ssh-mcp
npm install

# Run tests
npm test

# Build
npm run build

# Watch mode
npm run watch

# Lint
npm run lint
```

### Security Reporting

Found a security issue? Please email andre@optinampout.com instead of using the issue tracker.

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- **Andre (OptinampOut)** - Lead developer and architect
- **Claude Code assistance** - AI-powered development support
- Claude and Anthropic for MCP framework
- The open-source community for inspiration
- All contributors and testers

## 📞 Support

- Documentation: [Complete Tool Documentation](docs/TOOLS.md)
- Issues: [GitHub Issues](https://github.com/LYFTIUM-INC/ssh-mcp/issues)
- Discussions: [GitHub Discussions](https://github.com/LYFTIUM-INC/ssh-mcp/discussions)
- Business Inquiries: andre@optinampout.com

---

**SSH-MCP** - Transforming remote development with AI-powered intelligence and enterprise-grade security.