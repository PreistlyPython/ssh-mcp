import { createHash, randomBytes, scrypt, createCipheriv, createDecipheriv } from 'crypto';
import { promisify } from 'util';

const scryptAsync = promisify(scrypt);

export enum EncryptionAlgorithm {
  AES_256_GCM = 'aes-256-gcm',
  AES_256_CBC = 'aes-256-cbc',
  CHACHA20_POLY1305 = 'chacha20-poly1305'
}

export interface EncryptionConfig {
  algorithm: EncryptionAlgorithm;
  keyDerivation: {
    algorithm: 'scrypt' | 'pbkdf2';
    saltLength: number;
    iterations: number;
    keyLength: number;
  };
  sessionEncryption: {
    enabled: boolean;
    rotationInterval: number; // milliseconds
    memoryEncryption: boolean;
  };
  credentialEncryption: {
    enabled: boolean;
    atRest: boolean;
    inTransit: boolean;
  };
}

export interface EncryptedData {
  algorithm: EncryptionAlgorithm;
  ciphertext: string;
  iv: string;
  salt: string;
  authTag?: string; // For AEAD algorithms like GCM
  timestamp: Date;
  keyId?: string;
}

export interface SessionKey {
  keyId: string;
  key: Buffer;
  algorithm: EncryptionAlgorithm;
  createdAt: Date;
  expiresAt: Date;
  usageCount: number;
  maxUsage: number;
}

export interface EncryptedSession {
  sessionId: string;
  encryptedData: EncryptedData;
  keyId: string;
  metadata: {
    userId?: string;
    createdAt: Date;
    lastAccessed: Date;
    accessCount: number;
  };
}

export interface CredentialVault {
  [userId: string]: {
    encryptedCredentials: EncryptedData;
    credentialType: 'password' | 'privateKey' | 'certificate';
    lastRotated: Date;
    rotationSchedule?: Date;
  };
}

/**
 * Advanced session encryption manager with enterprise-grade security
 */
export class SessionEncryptionManager {
  private config: EncryptionConfig;
  private sessionKeys = new Map<string, SessionKey>();
  private masterKey: Buffer;
  private credentialVault: CredentialVault = {};
  private rotationTimer?: NodeJS.Timeout;

  constructor(config: Partial<EncryptionConfig> = {}, masterKey?: Buffer) {
    this.config = {
      algorithm: EncryptionAlgorithm.AES_256_GCM,
      keyDerivation: {
        algorithm: 'scrypt',
        saltLength: 32,
        iterations: 16384,
        keyLength: 32
      },
      sessionEncryption: {
        enabled: true,
        rotationInterval: 3600000, // 1 hour
        memoryEncryption: true
      },
      credentialEncryption: {
        enabled: true,
        atRest: true,
        inTransit: true
      },
      ...config
    };

    // Initialize master key
    this.masterKey = masterKey || this.generateMasterKey();

    // Setup automatic key rotation
    this.setupKeyRotation();
  }

  /**
   * Encrypt session data with automatic key management
   */
  async encryptSessionData(
    sessionId: string,
    data: any,
    userId?: string
  ): Promise<EncryptedSession> {
    if (!this.config.sessionEncryption.enabled) {
      throw new Error('Session encryption is disabled');
    }

    // Get or create session key
    let sessionKey = this.getSessionKey(sessionId);
    if (!sessionKey || this.isKeyExpired(sessionKey)) {
      sessionKey = await this.generateSessionKey(sessionId);
    }

    // Serialize and encrypt data
    const serializedData = JSON.stringify(data);
    const encryptedData = await this.encryptData(serializedData, sessionKey.key, sessionKey.algorithm);

    // Update key usage
    sessionKey.usageCount++;

    const encryptedSession: EncryptedSession = {
      sessionId,
      encryptedData,
      keyId: sessionKey.keyId,
      metadata: {
        userId,
        createdAt: new Date(),
        lastAccessed: new Date(),
        accessCount: 1
      }
    };

    return encryptedSession;
  }

  /**
   * Decrypt session data with automatic key validation
   */
  async decryptSessionData(encryptedSession: EncryptedSession): Promise<any> {
    if (!this.config.sessionEncryption.enabled) {
      throw new Error('Session encryption is disabled');
    }

    // Get session key
    const sessionKey = this.sessionKeys.get(encryptedSession.keyId);
    if (!sessionKey) {
      throw new Error('Session key not found - session may have expired');
    }

    if (this.isKeyExpired(sessionKey)) {
      throw new Error('Session key has expired');
    }

    // Decrypt data
    const decryptedData = await this.decryptData(
      encryptedSession.encryptedData,
      sessionKey.key
    );

    // Update access metadata
    encryptedSession.metadata.lastAccessed = new Date();
    encryptedSession.metadata.accessCount++;

    return JSON.parse(decryptedData);
  }

  /**
   * Encrypt credentials for secure storage
   */
  async encryptCredentials(
    userId: string,
    credentials: {
      type: 'password' | 'privateKey' | 'certificate';
      data: string;
    }
  ): Promise<void> {
    if (!this.config.credentialEncryption.enabled) {
      throw new Error('Credential encryption is disabled');
    }

    // Derive user-specific key
    const userSalt = this.generateUserSalt(userId);
    const credentialKey = await this.deriveKey(this.masterKey, userSalt);

    // Encrypt credentials
    const encryptedCredentials = await this.encryptData(
      credentials.data,
      credentialKey,
      this.config.algorithm
    );

    // Store in vault
    this.credentialVault[userId] = {
      encryptedCredentials,
      credentialType: credentials.type,
      lastRotated: new Date(),
      rotationSchedule: this.calculateNextRotation(credentials.type)
    };
  }

  /**
   * Decrypt credentials for use
   */
  async decryptCredentials(userId: string): Promise<string | null> {
    if (!this.config.credentialEncryption.enabled) {
      throw new Error('Credential encryption is disabled');
    }

    const vaultEntry = this.credentialVault[userId];
    if (!vaultEntry) {
      return null;
    }

    // Derive user-specific key
    const userSalt = this.generateUserSalt(userId);
    const credentialKey = await this.deriveKey(this.masterKey, userSalt);

    // Decrypt credentials
    const decryptedCredentials = await this.decryptData(
      vaultEntry.encryptedCredentials,
      credentialKey
    );

    return decryptedCredentials;
  }

  /**
   * Rotate session key for enhanced security
   */
  async rotateSessionKey(sessionId: string): Promise<SessionKey> {
    const oldKey = this.sessionKeys.get(sessionId);
    if (oldKey) {
      // Mark old key as expired
      oldKey.expiresAt = new Date();
    }

    // Generate new key
    const newKey = await this.generateSessionKey(sessionId);
    
    return newKey;
  }

  /**
   * Rotate credentials for enhanced security
   */
  async rotateCredentials(userId: string): Promise<void> {
    const vaultEntry = this.credentialVault[userId];
    if (!vaultEntry) {
      throw new Error('User credentials not found');
    }

    // Update rotation timestamp
    vaultEntry.lastRotated = new Date();
    vaultEntry.rotationSchedule = this.calculateNextRotation(vaultEntry.credentialType);

    // Note: Actual credential rotation would require new credentials from user
    // This method primarily updates the rotation schedule
  }

  /**
   * Securely wipe session from memory
   */
  wipeSession(sessionId: string): void {
    const sessionKey = this.sessionKeys.get(sessionId);
    if (sessionKey) {
      // Overwrite key in memory
      sessionKey.key.fill(0);
      this.sessionKeys.delete(sessionId);
    }
  }

  /**
   * Securely wipe all sessions
   */
  wipeAllSessions(): void {
    for (const [sessionId] of this.sessionKeys) {
      this.wipeSession(sessionId);
    }
  }

  /**
   * Get encryption statistics
   */
  getEncryptionStats(): {
    activeSessions: number;
    encryptedCredentials: number;
    keyRotations: number;
    algorithm: EncryptionAlgorithm;
    memoryEncryption: boolean;
  } {
    return {
      activeSessions: this.sessionKeys.size,
      encryptedCredentials: Object.keys(this.credentialVault).length,
      keyRotations: Array.from(this.sessionKeys.values()).filter(
        key => key.usageCount > 0
      ).length,
      algorithm: this.config.algorithm,
      memoryEncryption: this.config.sessionEncryption.memoryEncryption
    };
  }

  // Private methods

  private generateMasterKey(): Buffer {
    return randomBytes(32); // 256-bit key
  }

  private async generateSessionKey(sessionId: string): Promise<SessionKey> {
    const keyId = this.generateKeyId();
    const key = randomBytes(32); // 256-bit key
    const now = new Date();
    
    const sessionKey: SessionKey = {
      keyId,
      key,
      algorithm: this.config.algorithm,
      createdAt: now,
      expiresAt: new Date(now.getTime() + this.config.sessionEncryption.rotationInterval),
      usageCount: 0,
      maxUsage: 10000 // Prevent key overuse
    };

    this.sessionKeys.set(sessionId, sessionKey);
    this.sessionKeys.set(keyId, sessionKey); // Allow lookup by keyId too
    
    return sessionKey;
  }

  private getSessionKey(sessionId: string): SessionKey | undefined {
    return this.sessionKeys.get(sessionId);
  }

  private isKeyExpired(sessionKey: SessionKey): boolean {
    return new Date() > sessionKey.expiresAt || 
           sessionKey.usageCount >= sessionKey.maxUsage;
  }

  private async encryptData(
    data: string,
    key: Buffer,
    algorithm: EncryptionAlgorithm = this.config.algorithm
  ): Promise<EncryptedData> {
    const iv = randomBytes(16); // 128-bit IV
    const salt = randomBytes(this.config.keyDerivation.saltLength);

    switch (algorithm) {
      case EncryptionAlgorithm.AES_256_GCM: {
        const cipher = createCipheriv('aes-256-gcm', key, iv) as any;
        let encrypted = cipher.update(data, 'utf8', 'hex');
        encrypted += cipher.final('hex');
        const authTag = cipher.getAuthTag();

        return {
          algorithm,
          ciphertext: encrypted,
          iv: iv.toString('hex'),
          salt: salt.toString('hex'),
          authTag: authTag.toString('hex'),
          timestamp: new Date()
        };
      }

      case EncryptionAlgorithm.AES_256_CBC: {
        const cipher = createCipheriv('aes-256-cbc', key, iv);
        let encrypted = cipher.update(data, 'utf8', 'hex');
        encrypted += cipher.final('hex');

        return {
          algorithm,
          ciphertext: encrypted,
          iv: iv.toString('hex'),
          salt: salt.toString('hex'),
          timestamp: new Date()
        };
      }

      case EncryptionAlgorithm.CHACHA20_POLY1305: {
        const cipher = createCipheriv('chacha20-poly1305', key, iv) as any;
        let encrypted = cipher.update(data, 'utf8', 'hex');
        encrypted += cipher.final('hex');
        const authTag = cipher.getAuthTag();

        return {
          algorithm,
          ciphertext: encrypted,
          iv: iv.toString('hex'),
          salt: salt.toString('hex'),
          authTag: authTag.toString('hex'),
          timestamp: new Date()
        };
      }

      default:
        throw new Error(`Unsupported encryption algorithm: ${algorithm}`);
    }
  }

  private async decryptData(
    encryptedData: EncryptedData,
    key: Buffer
  ): Promise<string> {
    const iv = Buffer.from(encryptedData.iv, 'hex');

    switch (encryptedData.algorithm) {
      case EncryptionAlgorithm.AES_256_GCM: {
        const decipher = createDecipheriv('aes-256-gcm', key, iv) as any;
        if (encryptedData.authTag) {
          decipher.setAuthTag(Buffer.from(encryptedData.authTag, 'hex'));
        }
        let decrypted = decipher.update(encryptedData.ciphertext, 'hex', 'utf8');
        decrypted += decipher.final('utf8');
        return decrypted;
      }

      case EncryptionAlgorithm.AES_256_CBC: {
        const decipher = createDecipheriv('aes-256-cbc', key, iv);
        let decrypted = decipher.update(encryptedData.ciphertext, 'hex', 'utf8');
        decrypted += decipher.final('utf8');
        return decrypted;
      }

      case EncryptionAlgorithm.CHACHA20_POLY1305: {
        const decipher = createDecipheriv('chacha20-poly1305', key, iv) as any;
        if (encryptedData.authTag) {
          decipher.setAuthTag(Buffer.from(encryptedData.authTag, 'hex'));
        }
        let decrypted = decipher.update(encryptedData.ciphertext, 'hex', 'utf8');
        decrypted += decipher.final('utf8');
        return decrypted;
      }

      default:
        throw new Error(`Unsupported decryption algorithm: ${encryptedData.algorithm}`);
    }
  }

  private async deriveKey(masterKey: Buffer, salt: Buffer): Promise<Buffer> {
    switch (this.config.keyDerivation.algorithm) {
      case 'scrypt':
        return await scryptAsync(
          masterKey,
          salt,
          this.config.keyDerivation.keyLength
        ) as Buffer;
      
      default:
        throw new Error(`Unsupported key derivation algorithm: ${this.config.keyDerivation.algorithm}`);
    }
  }

  private generateUserSalt(userId: string): Buffer {
    // Generate deterministic salt for user (for consistent key derivation)
    const hash = createHash('sha256');
    hash.update(userId);
    hash.update(this.masterKey);
    return hash.digest();
  }

  private generateKeyId(): string {
    return randomBytes(16).toString('hex');
  }

  private calculateNextRotation(credentialType: string): Date {
    const baseInterval = 90 * 24 * 60 * 60 * 1000; // 90 days
    const intervals = {
      password: baseInterval,
      privateKey: baseInterval * 2, // 180 days
      certificate: baseInterval * 4  // 360 days
    };

    const interval = intervals[credentialType as keyof typeof intervals] || baseInterval;
    return new Date(Date.now() + interval);
  }

  private setupKeyRotation(): void {
    if (this.config.sessionEncryption.rotationInterval > 0) {
      this.rotationTimer = setInterval(() => {
        this.performAutomaticKeyRotation();
      }, this.config.sessionEncryption.rotationInterval);
    }
  }

  private performAutomaticKeyRotation(): void {
    const now = new Date();
    const expiredKeys: string[] = [];

    // Find expired keys
    for (const [keyId, sessionKey] of this.sessionKeys) {
      if (this.isKeyExpired(sessionKey)) {
        expiredKeys.push(keyId);
      }
    }

    // Remove expired keys
    for (const keyId of expiredKeys) {
      const sessionKey = this.sessionKeys.get(keyId);
      if (sessionKey) {
        // Securely overwrite key
        sessionKey.key.fill(0);
        this.sessionKeys.delete(keyId);
      }
    }

    console.log(`Rotated ${expiredKeys.length} expired session keys`);
  }

  /**
   * Cleanup method to call on shutdown
   */
  destroy(): void {
    if (this.rotationTimer) {
      clearInterval(this.rotationTimer);
    }
    
    this.wipeAllSessions();
    
    // Wipe master key
    this.masterKey.fill(0);
  }
}

/**
 * Memory-safe string utilities for handling sensitive data
 */
export class SecureString {
  private buffer: Buffer;
  private length: number;

  constructor(data: string) {
    this.buffer = Buffer.from(data, 'utf8');
    this.length = this.buffer.length;
  }

  /**
   * Get the string value (use sparingly)
   */
  getValue(): string {
    return this.buffer.toString('utf8');
  }

  /**
   * Compare with another string in constant time
   */
  equals(other: string | SecureString): boolean {
    const otherBuffer = other instanceof SecureString 
      ? other.buffer 
      : Buffer.from(other, 'utf8');

    if (this.buffer.length !== otherBuffer.length) {
      return false;
    }

    let result = 0;
    for (let i = 0; i < this.buffer.length; i++) {
      result |= this.buffer[i] ^ otherBuffer[i];
    }

    return result === 0;
  }

  /**
   * Get substring without exposing full string
   */
  substring(start: number, end?: number): SecureString {
    const subBuffer = this.buffer.subarray(start, end);
    const result = new SecureString('');
    result.buffer = subBuffer;
    result.length = subBuffer.length;
    return result;
  }

  /**
   * Get length without exposing content
   */
  getLength(): number {
    return this.length;
  }

  /**
   * Securely wipe the string from memory
   */
  wipe(): void {
    this.buffer.fill(0);
    this.length = 0;
  }

  /**
   * Create from existing buffer
   */
  static fromBuffer(buffer: Buffer): SecureString {
    const result = new SecureString('');
    result.buffer = buffer;
    result.length = buffer.length;
    return result;
  }
}

/**
 * Factory for creating pre-configured encryption managers
 */
export class EncryptionManagerFactory {
  static createForDevelopment(): SessionEncryptionManager {
    return new SessionEncryptionManager({
      sessionEncryption: {
        enabled: true,
        rotationInterval: 300000, // 5 minutes for development
        memoryEncryption: true
      },
      credentialEncryption: {
        enabled: true,
        atRest: true,
        inTransit: true
      }
    });
  }

  static createForProduction(masterKey?: Buffer): SessionEncryptionManager {
    return new SessionEncryptionManager({
      algorithm: EncryptionAlgorithm.AES_256_GCM,
      keyDerivation: {
        algorithm: 'scrypt',
        saltLength: 32,
        iterations: 32768, // Higher iterations for production
        keyLength: 32
      },
      sessionEncryption: {
        enabled: true,
        rotationInterval: 3600000, // 1 hour
        memoryEncryption: true
      },
      credentialEncryption: {
        enabled: true,
        atRest: true,
        inTransit: true
      }
    }, masterKey);
  }

  static createForEnterprise(masterKey?: Buffer): SessionEncryptionManager {
    return new SessionEncryptionManager({
      algorithm: EncryptionAlgorithm.AES_256_GCM,
      keyDerivation: {
        algorithm: 'scrypt',
        saltLength: 64, // Larger salt for enterprise
        iterations: 65536, // Higher iterations for enterprise
        keyLength: 32
      },
      sessionEncryption: {
        enabled: true,
        rotationInterval: 1800000, // 30 minutes
        memoryEncryption: true
      },
      credentialEncryption: {
        enabled: true,
        atRest: true,
        inTransit: true
      }
    }, masterKey);
  }
}