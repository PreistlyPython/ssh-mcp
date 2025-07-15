/**
 * Environment Configuration Validator
 * Ensures all required environment variables are properly configured
 * 
 * @author Andre (OptinampOut) with Claude Code assistance
 * @organization LYFTIUM-INC
 * @date July 15, 2025
 */

import { existsSync, readFileSync } from 'fs';
import { resolve } from 'path';

export interface ServerEnvironmentConfig {
  host: string;
  port: number;
  username: string;
  password?: string;
  privateKey?: string;
  privateKeyPath?: string;
  passphrase?: string;
  defaultDir?: string;
  description?: string;
}

export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
  config?: ServerEnvironmentConfig;
}

export class EnvironmentValidator {
  private requiredVars: Record<string, string[]> = {
    'joedreamz': ['JOEDREAMZ_HOST', 'JOEDREAMZ_USERNAME'],
    'optinampout': ['OPTINAMPOUT_HOST', 'OPTINAMPOUT_USERNAME'],
    'my-server': ['MY_SERVER_HOST', 'MY_SERVER_USERNAME']
  };

  private sensitiveVars = ['PASSWORD', 'PRIVATE_KEY', 'PASSPHRASE'];

  /**
   * Validate environment configuration for a specific server
   */
  validateServerConfig(serverName: string): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];
    
    // Check if server is known
    if (!this.requiredVars[serverName]) {
      errors.push(`Unknown server: ${serverName}. Available servers: ${Object.keys(this.requiredVars).join(', ')}`);
      return { valid: false, errors, warnings };
    }

    // Get environment variable prefix
    const envPrefix = serverName.toUpperCase().replace(/-/g, '_');
    
    // Validate required variables
    const requiredList = this.requiredVars[serverName];
    for (const varName of requiredList) {
      if (!process.env[varName]) {
        errors.push(`Missing required environment variable: ${varName}`);
      }
    }

    // Check authentication method
    const hasPassword = !!process.env[`${envPrefix}_PASSWORD`];
    const hasPrivateKey = !!process.env[`${envPrefix}_PRIVATE_KEY`];
    const hasPrivateKeyPath = !!process.env[`${envPrefix}_PRIVATE_KEY_PATH`];

    if (!hasPassword && !hasPrivateKey && !hasPrivateKeyPath) {
      errors.push(`No authentication method configured for ${serverName}. Need PASSWORD, PRIVATE_KEY, or PRIVATE_KEY_PATH`);
    }

    // Validate private key path if provided
    if (hasPrivateKeyPath) {
      const keyPath = process.env[`${envPrefix}_PRIVATE_KEY_PATH`]!;
      if (!existsSync(keyPath)) {
        errors.push(`Private key file not found: ${keyPath}`);
      } else {
        try {
          const keyContent = readFileSync(keyPath, 'utf8');
          if (!keyContent.includes('BEGIN') || !keyContent.includes('PRIVATE KEY')) {
            warnings.push(`Private key file may be invalid: ${keyPath}`);
          }
        } catch (error) {
          errors.push(`Cannot read private key file: ${keyPath}`);
        }
      }
    }

    // Validate port if provided
    const port = process.env[`${envPrefix}_PORT`];
    if (port && (isNaN(parseInt(port)) || parseInt(port) < 1 || parseInt(port) > 65535)) {
      errors.push(`Invalid port number: ${port}`);
    }

    // Create config if valid
    if (errors.length === 0) {
      const config: ServerEnvironmentConfig = {
        host: process.env[`${envPrefix}_HOST`]!,
        port: parseInt(process.env[`${envPrefix}_PORT`] || '22'),
        username: process.env[`${envPrefix}_USERNAME`]!,
        password: process.env[`${envPrefix}_PASSWORD`],
        privateKey: process.env[`${envPrefix}_PRIVATE_KEY`],
        privateKeyPath: process.env[`${envPrefix}_PRIVATE_KEY_PATH`],
        passphrase: process.env[`${envPrefix}_PASSPHRASE`],
        defaultDir: process.env[`${envPrefix}_DEFAULT_DIR`],
        description: process.env[`${envPrefix}_DESCRIPTION`]
      };

      // Add security warnings
      if (hasPassword && !process.env.SSH_ALLOW_PASSWORD_AUTH) {
        warnings.push('Password authentication is less secure than key-based authentication');
      }

      return { valid: true, errors, warnings, config };
    }

    return { valid: false, errors, warnings };
  }

  /**
   * Validate all server configurations
   */
  validateAllServers(): Record<string, ValidationResult> {
    const results: Record<string, ValidationResult> = {};
    
    for (const serverName of Object.keys(this.requiredVars)) {
      results[serverName] = this.validateServerConfig(serverName);
    }

    return results;
  }

  /**
   * Get secure connection configuration
   */
  getSecureConfig(serverName: string): ServerEnvironmentConfig | null {
    const validation = this.validateServerConfig(serverName);
    
    if (!validation.valid) {
      console.error(`Configuration validation failed for ${serverName}:`);
      validation.errors.forEach(error => console.error(`  - ${error}`));
      return null;
    }

    if (validation.warnings.length > 0) {
      console.warn(`Configuration warnings for ${serverName}:`);
      validation.warnings.forEach(warning => console.warn(`  - ${warning}`));
    }

    return validation.config!;
  }

  /**
   * Load environment from .env file with validation
   */
  loadAndValidateEnv(envPath?: string): void {
    const path = envPath || resolve(process.cwd(), '.env');
    
    if (!existsSync(path)) {
      console.warn(`.env file not found at ${path}`);
      return;
    }

    try {
      const envContent = readFileSync(path, 'utf8');
      const lines = envContent.split('\n');
      
      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('#')) continue;
        
        const [key, ...valueParts] = trimmed.split('=');
        const value = valueParts.join('=').replace(/^["']|["']$/g, '');
        
        // Only set if not already set (don't override existing env vars)
        if (!process.env[key]) {
          process.env[key] = value;
        }
      }

      console.log(`✅ Loaded environment from ${path}`);
    } catch (error) {
      console.error(`Failed to load .env file: ${error}`);
    }
  }

  /**
   * Generate example .env file
   */
  generateExampleEnv(): string {
    return `# SSH-MCP Environment Configuration
# Generated: ${new Date().toISOString()}

# JoeDreamz Server Configuration
JOEDREAMZ_HOST=joedreamz.com
JOEDREAMZ_PORT=22
JOEDREAMZ_USERNAME=wajk74lwk7tp
JOEDREAMZ_PASSWORD=your_password_here
# JOEDREAMZ_PRIVATE_KEY_PATH=/path/to/private/key
# JOEDREAMZ_PASSPHRASE=key_passphrase
JOEDREAMZ_DEFAULT_DIR=~/public_html/joedreamz.com/wp-content/themes/twentytwentyfour/homepage
JOEDREAMZ_DESCRIPTION=JoeDreamz WordPress Production Server

# OptinAmpOut Server Configuration
OPTINAMPOUT_HOST=fr3.fcomet.com
OPTINAMPOUT_PORT=17177
OPTINAMPOUT_USERNAME=optinamp
OPTINAMPOUT_PASSWORD=your_password_here
# OPTINAMPOUT_PRIVATE_KEY_PATH=/path/to/private/key
# OPTINAMPOUT_PASSPHRASE=key_passphrase
OPTINAMPOUT_DEFAULT_DIR=/home/optinamp/public_html/
OPTINAMPOUT_DESCRIPTION=OptinAmpOut Production Server

# My Server Configuration (Example)
MY_SERVER_HOST=example.com
MY_SERVER_PORT=22
MY_SERVER_USERNAME=myuser
MY_SERVER_PASSWORD=your_password_here
# MY_SERVER_PRIVATE_KEY_PATH=/path/to/private/key
# MY_SERVER_PASSPHRASE=key_passphrase
MY_SERVER_DEFAULT_DIR=/home/myuser
MY_SERVER_DESCRIPTION=My example server

# Security Settings
SSH_ALLOW_PASSWORD_AUTH=false
SSH_MAX_RETRIES=3
SSH_RETRY_DELAY=2000
SSH_CONNECTION_TIMEOUT=20000
SSH_KEEPALIVE_INTERVAL=10000

# Performance Settings
SSH_MIN_POOL_SIZE=5
SSH_MAX_POOL_SIZE=100

# Memory Settings
SSH_MEMORY_PERSISTENCE=true
SSH_MEMORY_DATA_DIR=./data/memory
SSH_MEMORY_MAX_ENTRIES=10000

# Redis Cache Settings
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=
REDIS_DB=0

# Monitoring Settings
PROMETHEUS_PORT=9090
GRAFANA_PORT=3000
MONITORING_ENABLED=true
`;
  }
}

// Export singleton instance
export const environmentValidator = new EnvironmentValidator();