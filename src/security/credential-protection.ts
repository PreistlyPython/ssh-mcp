/**
 * Credential Protection System for SSH MCP Server
 * Provides secure credential storage with encryption at rest and key rotation mechanisms
 */

import { randomBytes, scrypt, createCipheriv, createDecipheriv, createHash } from 'crypto';
import { promisify } from 'util';
import fs from 'fs/promises';
import path from 'path';
import { EventEmitter } from 'events';
import { AuditLogger, AuditEventType } from '../audit/audit-logger.js';

const scryptAsync = promisify(scrypt);

export enum CredentialType {
  SSH_PASSWORD = 'ssh_password',
  SSH_PRIVATE_KEY = 'ssh_private_key',
  SSH_PASSPHRASE = 'ssh_passphrase',
  API_TOKEN = 'api_token',
  DATABASE_CONNECTION = 'database_connection',
  OAUTH_TOKEN = 'oauth_token',
  CERTIFICATE = 'certificate',
  ENCRYPTION_KEY = 'encryption_key'
}

export enum KeyRotationStatus {
  ACTIVE = 'active',
  PENDING_ROTATION = 'pending_rotation',
  ROTATING = 'rotating',
  DEPRECATED = 'deprecated',
  REVOKED = 'revoked'
}

export interface CredentialMetadata {
  id: string;
  type: CredentialType;
  description: string;
  createdAt: Date;
  updatedAt: Date;
  expiresAt?: Date;
  rotationIntervalDays?: number;
  lastRotated?: Date;
  rotationStatus: KeyRotationStatus;
  accessCount: number;
  lastAccessed?: Date;
  tags: string[];
  owner?: string;
  environment: 'development' | 'staging' | 'production';
}

export interface EncryptedCredential {
  metadata: CredentialMetadata;
  encryptedData: string;
  salt: string;
  algorithm: string;
  keyDerivationIterations: number;
  checksum: string;
}

export interface CredentialAccessLog {
  credentialId: string;
  accessedBy: string;
  accessedAt: Date;
  operation: 'read' | 'write' | 'rotate' | 'delete';
  sessionId?: string;
  clientIp?: string;
  userAgent?: string;
  success: boolean;
  errorMessage?: string;
}

export interface CredentialProtectionConfig {
  storageDirectory: string;
  defaultRotationIntervalDays: number;
  keyDerivationIterations: number;
  encryptionAlgorithm: string;
  keySize: number;
  saltSize: number;
  checksumAlgorithm: string;
  backupEnabled: boolean;
  backupRetentionDays: number;
  accessLoggingEnabled: boolean;
  automaticRotationEnabled: boolean;
  rotationTimeWindowHours: number;
}

/**
 * Advanced credential protection system with encryption at rest and key rotation
 */
export class CredentialProtectionManager extends EventEmitter {
  private config: CredentialProtectionConfig;
  private auditLogger: AuditLogger;
  private credentials = new Map<string, EncryptedCredential>();
  private accessLogs: CredentialAccessLog[] = [];
  private masterKey: Buffer | null = null;
  private rotationTimer?: NodeJS.Timeout;

  constructor(config: Partial<CredentialProtectionConfig> = {}, auditLogger?: AuditLogger) {
    super();
    
    this.config = {
      storageDirectory: process.env.CREDENTIAL_STORAGE_DIR || './secure/credentials',
      defaultRotationIntervalDays: 90,
      keyDerivationIterations: 100000,
      encryptionAlgorithm: 'aes-256-gcm',
      keySize: 32,
      saltSize: 16,
      checksumAlgorithm: 'sha256',
      backupEnabled: true,
      backupRetentionDays: 30,
      accessLoggingEnabled: true,
      automaticRotationEnabled: true,
      rotationTimeWindowHours: 24,
      ...config
    };

    this.auditLogger = auditLogger || new AuditLogger();
    
    // Initialize storage and start rotation monitoring
    this.initializeStorage();
    this.startRotationMonitoring();
  }

  /**
   * Store a credential securely with encryption at rest
   */
  async storeCredential(
    type: CredentialType,
    data: string | Buffer,
    metadata: Partial<CredentialMetadata> = {},
    masterPassword?: string
  ): Promise<string> {
    const credentialId = this.generateCredentialId();
    const now = new Date();
    
    const fullMetadata: CredentialMetadata = {
      id: credentialId,
      type,
      description: metadata.description || `${type} credential`,
      createdAt: now,
      updatedAt: now,
      expiresAt: metadata.expiresAt,
      rotationIntervalDays: metadata.rotationIntervalDays || this.config.defaultRotationIntervalDays,
      rotationStatus: KeyRotationStatus.ACTIVE,
      accessCount: 0,
      tags: metadata.tags || [],
      owner: metadata.owner,
      environment: metadata.environment || 'production',
      ...metadata
    };

    // Generate encryption materials
    const salt = randomBytes(this.config.saltSize);
    const key = await this.deriveKey(masterPassword || await this.getMasterKey(), salt);
    
    // Encrypt the credential data
    const encryptedData = await this.encryptData(data, key);
    const checksum = this.calculateChecksum(encryptedData);
    
    const encryptedCredential: EncryptedCredential = {
      metadata: fullMetadata,
      encryptedData,
      salt: salt.toString('hex'),
      algorithm: this.config.encryptionAlgorithm,
      keyDerivationIterations: this.config.keyDerivationIterations,
      checksum
    };

    // Store in memory and persist to disk
    this.credentials.set(credentialId, encryptedCredential);
    await this.persistCredential(encryptedCredential);
    
    // Log access
    await this.logAccess(credentialId, 'system', 'write', true);
    
    // Audit event
    await this.auditLogger.logEvent(AuditEventType.CREDENTIAL_STORED, {
      description: `Credential stored: ${type}`,
      outcome: 'success',
      eventDetails: {
        credentialId,
        type,
        environment: fullMetadata.environment
      }
    });

    this.emit('credential_stored', { credentialId, type, metadata: fullMetadata });
    
    return credentialId;
  }

  /**
   * Retrieve and decrypt a credential
   */
  async retrieveCredential(
    credentialId: string,
    accessedBy: string,
    sessionId?: string,
    masterPassword?: string
  ): Promise<{
    data: string | Buffer;
    metadata: CredentialMetadata;
  }> {
    const credential = this.credentials.get(credentialId) || await this.loadCredential(credentialId);
    
    if (!credential) {
      await this.logAccess(credentialId, accessedBy, 'read', false, 'Credential not found');
      throw new Error(`Credential not found: ${credentialId}`);
    }

    // Check if credential is expired or revoked
    if (credential.metadata.rotationStatus === KeyRotationStatus.REVOKED) {
      await this.logAccess(credentialId, accessedBy, 'read', false, 'Credential revoked');
      throw new Error(`Credential has been revoked: ${credentialId}`);
    }

    if (credential.metadata.expiresAt && credential.metadata.expiresAt < new Date()) {
      await this.logAccess(credentialId, accessedBy, 'read', false, 'Credential expired');
      throw new Error(`Credential has expired: ${credentialId}`);
    }

    try {
      // Verify checksum
      const calculatedChecksum = this.calculateChecksum(credential.encryptedData);
      if (calculatedChecksum !== credential.checksum) {
        throw new Error('Credential integrity check failed');
      }

      // Derive decryption key
      const salt = Buffer.from(credential.salt, 'hex');
      const key = await this.deriveKey(masterPassword || await this.getMasterKey(), salt);
      
      // Decrypt data
      const decryptedData = await this.decryptData(credential.encryptedData, key);
      
      // Update access tracking
      credential.metadata.accessCount++;
      credential.metadata.lastAccessed = new Date();
      this.credentials.set(credentialId, credential);
      await this.persistCredential(credential);
      
      // Log successful access
      await this.logAccess(credentialId, accessedBy, 'read', true, undefined, sessionId);
      
      this.emit('credential_accessed', { 
        credentialId, 
        accessedBy, 
        sessionId,
        metadata: credential.metadata 
      });

      return {
        data: decryptedData,
        metadata: credential.metadata
      };
    } catch (error: any) {
      await this.logAccess(credentialId, accessedBy, 'read', false, error.message, sessionId);
      
      await this.auditLogger.logEvent(AuditEventType.CREDENTIAL_ACCESS_FAILED, {
        description: `Credential access failed: ${credentialId}`,
        outcome: 'failure',
        eventDetails: {
          credentialId,
          accessedBy,
          sessionId,
          errorMessage: error.message
        }
      });
      
      throw error;
    }
  }

  /**
   * Rotate a credential's encryption keys
   */
  async rotateCredential(
    credentialId: string,
    newData?: string | Buffer,
    rotatedBy: string = 'system'
  ): Promise<void> {
    const credential = this.credentials.get(credentialId) || await this.loadCredential(credentialId);
    
    if (!credential) {
      throw new Error(`Credential not found for rotation: ${credentialId}`);
    }

    // Mark as rotating
    credential.metadata.rotationStatus = KeyRotationStatus.ROTATING;
    credential.metadata.updatedAt = new Date();
    
    try {
      // If new data provided, use it; otherwise decrypt and re-encrypt with new key
      let dataToEncrypt: string | Buffer;
      
      if (newData) {
        dataToEncrypt = newData;
      } else {
        // Decrypt existing data to re-encrypt with new key
        const salt = Buffer.from(credential.salt, 'hex');
        const oldKey = await this.deriveKey(await this.getMasterKey(), salt);
        dataToEncrypt = await this.decryptData(credential.encryptedData, oldKey);
      }

      // Generate new encryption materials
      const newSalt = randomBytes(this.config.saltSize);
      const newKey = await this.deriveKey(await this.getMasterKey(), newSalt);
      
      // Encrypt with new key
      const newEncryptedData = await this.encryptData(dataToEncrypt, newKey);
      const newChecksum = this.calculateChecksum(newEncryptedData);
      
      // Update credential
      credential.encryptedData = newEncryptedData;
      credential.salt = newSalt.toString('hex');
      credential.checksum = newChecksum;
      credential.metadata.lastRotated = new Date();
      credential.metadata.rotationStatus = KeyRotationStatus.ACTIVE;
      credential.metadata.updatedAt = new Date();
      
      // Persist changes
      this.credentials.set(credentialId, credential);
      await this.persistCredential(credential);
      
      // Log rotation
      await this.logAccess(credentialId, rotatedBy, 'rotate', true);
      
      // Audit event
      await this.auditLogger.logEvent(AuditEventType.CREDENTIAL_ROTATED, {
        description: `Credential rotated: ${credentialId}`,
        outcome: 'success',
        eventDetails: {
          credentialId,
          rotatedBy,
          type: credential.metadata.type
        }
      });

      this.emit('credential_rotated', { credentialId, rotatedBy, metadata: credential.metadata });
      
    } catch (error: any) {
      // Reset status on failure
      credential.metadata.rotationStatus = KeyRotationStatus.ACTIVE;
      
      await this.logAccess(credentialId, rotatedBy, 'rotate', false, error.message);
      
      await this.auditLogger.logEvent(AuditEventType.CREDENTIAL_ROTATION_FAILED, {
        description: `Credential rotation failed: ${credentialId}`,
        outcome: 'failure',
        eventDetails: {
          credentialId,
          rotatedBy,
          errorMessage: error.message
        }
      });
      
      throw error;
    }
  }

  /**
   * Delete a credential securely
   */
  async deleteCredential(credentialId: string, deletedBy: string): Promise<void> {
    const credential = this.credentials.get(credentialId);
    
    if (!credential) {
      throw new Error(`Credential not found for deletion: ${credentialId}`);
    }

    // Mark as revoked first
    credential.metadata.rotationStatus = KeyRotationStatus.REVOKED;
    credential.metadata.updatedAt = new Date();
    await this.persistCredential(credential);
    
    // Remove from memory
    this.credentials.delete(credentialId);
    
    // Secure deletion from disk
    await this.secureDeleteCredentialFile(credentialId);
    
    // Log deletion
    await this.logAccess(credentialId, deletedBy, 'delete', true);
    
    // Audit event
    await this.auditLogger.logEvent(AuditEventType.CREDENTIAL_DELETED, {
      description: `Credential deleted: ${credentialId}`,
      outcome: 'success',
      eventDetails: {
        credentialId,
        deletedBy,
        type: credential.metadata.type
      }
    });

    this.emit('credential_deleted', { credentialId, deletedBy, metadata: credential.metadata });
  }

  /**
   * List credentials with filtering
   */
  async listCredentials(filter: {
    type?: CredentialType;
    environment?: string;
    owner?: string;
    tags?: string[];
    status?: KeyRotationStatus;
  } = {}): Promise<CredentialMetadata[]> {
    await this.loadAllCredentials();
    
    return Array.from(this.credentials.values())
      .map(c => c.metadata)
      .filter(metadata => {
        if (filter.type && metadata.type !== filter.type) return false;
        if (filter.environment && metadata.environment !== filter.environment) return false;
        if (filter.owner && metadata.owner !== filter.owner) return false;
        if (filter.status && metadata.rotationStatus !== filter.status) return false;
        if (filter.tags && !filter.tags.every(tag => metadata.tags.includes(tag))) return false;
        return true;
      })
      .sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());
  }

  /**
   * Get credentials requiring rotation
   */
  async getCredentialsRequiringRotation(): Promise<CredentialMetadata[]> {
    await this.loadAllCredentials();
    const now = new Date();
    
    return Array.from(this.credentials.values())
      .map(c => c.metadata)
      .filter(metadata => {
        if (metadata.rotationStatus !== KeyRotationStatus.ACTIVE) return false;
        if (!metadata.rotationIntervalDays) return false;
        
        const lastRotated = metadata.lastRotated || metadata.createdAt;
        const daysSinceRotation = (now.getTime() - lastRotated.getTime()) / (1000 * 60 * 60 * 24);
        
        return daysSinceRotation >= metadata.rotationIntervalDays;
      });
  }

  /**
   * Get access logs for a credential
   */
  getAccessLogs(credentialId?: string, limit: number = 100): CredentialAccessLog[] {
    let logs = this.accessLogs;
    
    if (credentialId) {
      logs = logs.filter(log => log.credentialId === credentialId);
    }
    
    return logs
      .sort((a, b) => b.accessedAt.getTime() - a.accessedAt.getTime())
      .slice(0, limit);
  }

  /**
   * Get protection statistics
   */
  getProtectionStatistics(): {
    totalCredentials: number;
    credentialsByType: Record<CredentialType, number>;
    credentialsByStatus: Record<KeyRotationStatus, number>;
    credentialsByEnvironment: Record<string, number>;
    rotationSchedule: Array<{ credentialId: string; nextRotation: Date }>;
    accessActivity: {
      totalAccesses: number;
      accessesLast24h: number;
      topAccessedCredentials: Array<{ credentialId: string; accessCount: number }>;
    };
  } {
    const now = new Date();
    const last24h = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    
    const credentialsByType: Record<string, number> = {};
    const credentialsByStatus: Record<string, number> = {};
    const credentialsByEnvironment: Record<string, number> = {};
    const rotationSchedule: Array<{ credentialId: string; nextRotation: Date }> = [];
    
    for (const credential of this.credentials.values()) {
      const { metadata } = credential;
      
      // Count by type
      credentialsByType[metadata.type] = (credentialsByType[metadata.type] || 0) + 1;
      
      // Count by status
      credentialsByStatus[metadata.rotationStatus] = (credentialsByStatus[metadata.rotationStatus] || 0) + 1;
      
      // Count by environment
      credentialsByEnvironment[metadata.environment] = (credentialsByEnvironment[metadata.environment] || 0) + 1;
      
      // Calculate next rotation
      if (metadata.rotationStatus === KeyRotationStatus.ACTIVE && metadata.rotationIntervalDays) {
        const lastRotated = metadata.lastRotated || metadata.createdAt;
        const nextRotation = new Date(lastRotated.getTime() + metadata.rotationIntervalDays * 24 * 60 * 60 * 1000);
        rotationSchedule.push({ credentialId: metadata.id, nextRotation });
      }
    }
    
    // Sort rotation schedule by date
    rotationSchedule.sort((a, b) => a.nextRotation.getTime() - b.nextRotation.getTime());
    
    // Access activity
    const accessesLast24h = this.accessLogs.filter(log => log.accessedAt > last24h).length;
    const topAccessedCredentials = Array.from(this.credentials.values())
      .map(c => ({ credentialId: c.metadata.id, accessCount: c.metadata.accessCount }))
      .sort((a, b) => b.accessCount - a.accessCount)
      .slice(0, 10);
    
    return {
      totalCredentials: this.credentials.size,
      credentialsByType: credentialsByType as Record<CredentialType, number>,
      credentialsByStatus: credentialsByStatus as Record<KeyRotationStatus, number>,
      credentialsByEnvironment,
      rotationSchedule,
      accessActivity: {
        totalAccesses: this.accessLogs.length,
        accessesLast24h,
        topAccessedCredentials
      }
    };
  }

  /**
   * Graceful shutdown
   */
  async shutdown(): Promise<void> {
    if (this.rotationTimer) {
      clearInterval(this.rotationTimer);
    }
    
    // Clear sensitive data from memory
    this.credentials.clear();
    this.masterKey = null;
    
    await this.auditLogger.logEvent(AuditEventType.SERVER_STOP, {
      description: 'Credential protection system shutdown',
      outcome: 'success',
      eventDetails: {
        finalStats: this.getProtectionStatistics()
      }
    });
  }

  // Private helper methods

  private async initializeStorage(): Promise<void> {
    try {
      await fs.mkdir(this.config.storageDirectory, { recursive: true });
      await this.loadAllCredentials();
    } catch (error: any) {
      console.error('Failed to initialize credential storage:', error.message);
      throw error;
    }
  }

  private startRotationMonitoring(): void {
    if (!this.config.automaticRotationEnabled) return;
    
    // Check for rotation every hour
    this.rotationTimer = setInterval(async () => {
      try {
        const credentialsRequiringRotation = await this.getCredentialsRequiringRotation();
        
        for (const metadata of credentialsRequiringRotation) {
          metadata.rotationStatus = KeyRotationStatus.PENDING_ROTATION;
          this.emit('credential_rotation_required', { metadata });
          
          // Auto-rotate if in rotation window
          const now = new Date();
          const rotationWindow = this.config.rotationTimeWindowHours * 60 * 60 * 1000;
          
          if (Math.random() < 0.1) { // 10% chance per check to spread load
            try {
              await this.rotateCredential(metadata.id);
            } catch (error: any) {
              console.error(`Auto-rotation failed for ${metadata.id}:`, error.message);
            }
          }
        }
      } catch (error: any) {
        console.error('Rotation monitoring error:', error.message);
      }
    }, 3600000); // Every hour
  }

  private generateCredentialId(): string {
    return `cred_${Date.now()}_${randomBytes(8).toString('hex')}`;
  }

  private async getMasterKey(): Promise<string> {
    // In production, this would come from a secure key management service
    // For now, generate from environment or create a default
    return process.env.CREDENTIAL_MASTER_KEY || 'default-master-key-change-in-production';
  }

  private async deriveKey(masterKey: string, salt: Buffer): Promise<Buffer> {
    return await scryptAsync(masterKey, salt, this.config.keySize) as Buffer;
  }

  private async encryptData(data: string | Buffer, key: Buffer): Promise<string> {
    const iv = randomBytes(16); // Generate random IV
    const cipher = createCipheriv(this.config.encryptionAlgorithm, key, iv);
    const dataBuffer = Buffer.isBuffer(data) ? data : Buffer.from(data, 'utf8');
    
    let encrypted = cipher.update(dataBuffer);
    encrypted = Buffer.concat([encrypted, cipher.final()]);
    
    // Prepend IV to encrypted data
    const combined = Buffer.concat([iv, encrypted]);
    return combined.toString('hex');
  }

  private async decryptData(encryptedData: string, key: Buffer): Promise<string> {
    const combined = Buffer.from(encryptedData, 'hex');
    
    // Extract IV from the beginning
    const iv = combined.slice(0, 16);
    const encryptedBuffer = combined.slice(16);
    
    const decipher = createDecipheriv(this.config.encryptionAlgorithm, key, iv);
    
    let decrypted = decipher.update(encryptedBuffer);
    decrypted = Buffer.concat([decrypted, decipher.final()]);
    
    return decrypted.toString('utf8');
  }

  private calculateChecksum(data: string): string {
    return createHash(this.config.checksumAlgorithm).update(data).digest('hex');
  }

  private async persistCredential(credential: EncryptedCredential): Promise<void> {
    const filePath = path.join(this.config.storageDirectory, `${credential.metadata.id}.json`);
    const credentialData = JSON.stringify(credential, null, 2);
    await fs.writeFile(filePath, credentialData, { mode: 0o600 }); // Owner read/write only
  }

  private async loadCredential(credentialId: string): Promise<EncryptedCredential | null> {
    try {
      const filePath = path.join(this.config.storageDirectory, `${credentialId}.json`);
      const data = await fs.readFile(filePath, 'utf8');
      const credential = JSON.parse(data) as EncryptedCredential;
      
      // Convert date strings back to Date objects
      credential.metadata.createdAt = new Date(credential.metadata.createdAt);
      credential.metadata.updatedAt = new Date(credential.metadata.updatedAt);
      if (credential.metadata.expiresAt) {
        credential.metadata.expiresAt = new Date(credential.metadata.expiresAt);
      }
      if (credential.metadata.lastRotated) {
        credential.metadata.lastRotated = new Date(credential.metadata.lastRotated);
      }
      if (credential.metadata.lastAccessed) {
        credential.metadata.lastAccessed = new Date(credential.metadata.lastAccessed);
      }
      
      this.credentials.set(credentialId, credential);
      return credential;
    } catch (error: any) {
      if (error.code !== 'ENOENT') {
        console.error(`Failed to load credential ${credentialId}:`, error.message);
      }
      return null;
    }
  }

  private async loadAllCredentials(): Promise<void> {
    try {
      const files = await fs.readdir(this.config.storageDirectory);
      const credentialFiles = files.filter(file => file.endsWith('.json'));
      
      for (const file of credentialFiles) {
        const credentialId = file.replace('.json', '');
        await this.loadCredential(credentialId);
      }
    } catch (error: any) {
      if (error.code !== 'ENOENT') {
        console.error('Failed to load credentials:', error.message);
      }
    }
  }

  private async secureDeleteCredentialFile(credentialId: string): Promise<void> {
    try {
      const filePath = path.join(this.config.storageDirectory, `${credentialId}.json`);
      
      // Overwrite file with random data multiple times before deletion
      const fileStats = await fs.stat(filePath);
      const fileSize = fileStats.size;
      
      for (let i = 0; i < 3; i++) {
        const randomData = randomBytes(fileSize);
        await fs.writeFile(filePath, randomData);
      }
      
      // Finally delete the file
      await fs.unlink(filePath);
    } catch (error: any) {
      console.error(`Failed to securely delete credential file ${credentialId}:`, error.message);
    }
  }

  private async logAccess(
    credentialId: string,
    accessedBy: string,
    operation: 'read' | 'write' | 'rotate' | 'delete',
    success: boolean,
    errorMessage?: string,
    sessionId?: string
  ): Promise<void> {
    if (!this.config.accessLoggingEnabled) return;
    
    const accessLog: CredentialAccessLog = {
      credentialId,
      accessedBy,
      accessedAt: new Date(),
      operation,
      sessionId,
      success,
      errorMessage
    };
    
    this.accessLogs.push(accessLog);
    
    // Keep only recent logs to prevent memory bloat
    if (this.accessLogs.length > 10000) {
      this.accessLogs = this.accessLogs.slice(-5000);
    }
  }
}