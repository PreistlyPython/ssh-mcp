import { MFAManager, MFAType, UserMFAProfile } from './mfa-manager.js';
import { createHash, randomBytes, scrypt, timingSafeEqual } from 'crypto';
import { promisify } from 'util';
import { EventEmitter } from 'events';

const scryptAsync = promisify(scrypt);

export enum AuthMethod {
  PASSWORD = 'password',
  PRIVATE_KEY = 'private_key', 
  CERTIFICATE = 'certificate',
  LDAP = 'ldap',
  SAML = 'saml',
  OAUTH2 = 'oauth2'
}

export enum AuthEvent {
  AUTH_SUCCESS = 'auth_success',
  AUTH_FAILURE = 'auth_failure',
  AUTH_LOCKED = 'auth_locked',
  AUTH_UNLOCKED = 'auth_unlocked',
  PASSWORD_CHANGED = 'password_changed',
  SUSPICIOUS_ACTIVITY = 'suspicious_activity'
}

export interface AuthAttempt {
  timestamp: Date;
  method: AuthMethod;
  success: boolean;
  ipAddress?: string;
  userAgent?: string;
  sessionId?: string;
}

export interface AuthPolicy {
  maxFailedAttempts: number;
  lockoutDurationMs: number;
  passwordPolicy: {
    minLength: number;
    requireUppercase: boolean;
    requireLowercase: boolean;
    requireNumbers: boolean;
    requireSpecialChars: boolean;
    maxAge: number; // days
    preventReuse: number; // number of previous passwords to check
  };
  sessionPolicy: {
    maxIdleTimeMs: number;
    maxSessionDurationMs: number;
    requireReauthForPrivileged: boolean;
  };
  mfaPolicy: {
    required: boolean;
    requiredMethods: MFAType[];
    gracePeriodMs: number; // time before MFA becomes mandatory
  };
}

export interface UserCredentials {
  userId: string;
  passwordHash?: string;
  salt?: string;
  privateKeyFingerprint?: string;
  certificateFingerprint?: string;
  externalAuthId?: string; // for LDAP, SAML, OAuth2
  createdAt: Date;
  lastPasswordChange: Date;
  previousPasswordHashes: string[];
}

export interface AuthSession {
  sessionId: string;
  userId: string;
  authMethod: AuthMethod;
  mfaCompleted: boolean;
  privilegeLevel: 'standard' | 'elevated' | 'admin';
  createdAt: Date;
  lastActivity: Date;
  ipAddress?: string;
  userAgent?: string;
  metadata: Record<string, any>;
}

export interface AuthResult {
  success: boolean;
  sessionId?: string;
  userId?: string;
  requiresMFA?: boolean;
  mfaChallengeId?: string;
  errorCode?: string;
  lockoutExpiresAt?: Date;
  privilegeLevel?: string;
}

export class EnterpriseAuthManager extends EventEmitter {
  private mfaManager: MFAManager;
  private userCredentials = new Map<string, UserCredentials>();
  private authAttempts = new Map<string, AuthAttempt[]>();
  private lockedUsers = new Map<string, Date>(); // userId -> unlock time
  private activeSessions = new Map<string, AuthSession>();
  private policy: AuthPolicy;

  constructor(
    mfaManager: MFAManager,
    policy: Partial<AuthPolicy> = {}
  ) {
    super();
    
    this.mfaManager = mfaManager;
    this.policy = {
      maxFailedAttempts: 5,
      lockoutDurationMs: 900000, // 15 minutes
      passwordPolicy: {
        minLength: 12,
        requireUppercase: true,
        requireLowercase: true,
        requireNumbers: true,
        requireSpecialChars: true,
        maxAge: 90, // 90 days
        preventReuse: 12
      },
      sessionPolicy: {
        maxIdleTimeMs: 3600000, // 1 hour
        maxSessionDurationMs: 28800000, // 8 hours
        requireReauthForPrivileged: true
      },
      mfaPolicy: {
        required: true,
        requiredMethods: [MFAType.TOTP],
        gracePeriodMs: 604800000 // 7 days
      },
      ...policy
    };

    // Setup periodic cleanup
    setInterval(() => this.cleanupExpiredSessions(), 300000); // 5 minutes
    setInterval(() => this.cleanupOldAttempts(), 3600000); // 1 hour
  }

  /**
   * Register new user with credentials
   */
  async registerUser(
    userId: string,
    authMethod: AuthMethod,
    credentials: {
      password?: string;
      privateKey?: string;
      certificate?: string;
      externalAuthId?: string;
    }
  ): Promise<{ success: boolean; mfaSetup?: any }> {
    // Check if user already exists
    if (this.userCredentials.has(userId)) {
      throw new Error('User already exists');
    }

    const userCreds: UserCredentials = {
      userId,
      createdAt: new Date(),
      lastPasswordChange: new Date(),
      previousPasswordHashes: []
    };

    switch (authMethod) {
      case AuthMethod.PASSWORD:
        if (!credentials.password) {
          throw new Error('Password required for password authentication');
        }
        
        if (!this.validatePasswordPolicy(credentials.password)) {
          throw new Error('Password does not meet policy requirements');
        }
        
        const { hash, salt } = await this.hashPassword(credentials.password);
        userCreds.passwordHash = hash;
        userCreds.salt = salt;
        break;

      case AuthMethod.PRIVATE_KEY:
        if (!credentials.privateKey) {
          throw new Error('Private key required for key authentication');
        }
        userCreds.privateKeyFingerprint = this.calculateFingerprint(credentials.privateKey);
        break;

      case AuthMethod.CERTIFICATE:
        if (!credentials.certificate) {
          throw new Error('Certificate required for certificate authentication');
        }
        userCreds.certificateFingerprint = this.calculateFingerprint(credentials.certificate);
        break;

      case AuthMethod.LDAP:
      case AuthMethod.SAML:
      case AuthMethod.OAUTH2:
        if (!credentials.externalAuthId) {
          throw new Error('External auth ID required for external authentication');
        }
        userCreds.externalAuthId = credentials.externalAuthId;
        break;
    }

    this.userCredentials.set(userId, userCreds);

    // Setup MFA if required
    let mfaSetup;
    if (this.policy.mfaPolicy.required) {
      const mfaProfile = await this.mfaManager.initializeUserMFA(
        userId,
        this.policy.mfaPolicy.requiredMethods
      );
      mfaSetup = { profile: mfaProfile };
    }

    return { success: true, mfaSetup };
  }

  /**
   * Authenticate user with primary credentials
   */
  async authenticate(
    userId: string,
    authMethod: AuthMethod,
    credentials: {
      password?: string;
      privateKey?: string;
      certificate?: string;
      externalToken?: string;
    },
    context: {
      ipAddress?: string;
      userAgent?: string;
      sessionId?: string;
    } = {}
  ): Promise<AuthResult> {
    // Check if user is locked
    if (this.isUserLocked(userId)) {
      const lockoutExpires = this.lockedUsers.get(userId);
      return {
        success: false,
        errorCode: 'USER_LOCKED',
        lockoutExpiresAt: lockoutExpires
      };
    }

    const userCreds = this.userCredentials.get(userId);
    if (!userCreds) {
      this.recordAuthAttempt(userId, authMethod, false, context);
      return { success: false, errorCode: 'USER_NOT_FOUND' };
    }

    let authSuccess = false;

    // Verify primary credentials
    switch (authMethod) {
      case AuthMethod.PASSWORD:
        authSuccess = await this.verifyPassword(
          credentials.password!,
          userCreds.passwordHash!,
          userCreds.salt!
        );
        break;

      case AuthMethod.PRIVATE_KEY:
        authSuccess = this.verifyPrivateKey(
          credentials.privateKey!,
          userCreds.privateKeyFingerprint!
        );
        break;

      case AuthMethod.CERTIFICATE:
        authSuccess = this.verifyCertificate(
          credentials.certificate!,
          userCreds.certificateFingerprint!
        );
        break;

      case AuthMethod.LDAP:
      case AuthMethod.SAML:
      case AuthMethod.OAUTH2:
        authSuccess = await this.verifyExternalAuth(
          credentials.externalToken!,
          userCreds.externalAuthId!,
          authMethod
        );
        break;
    }

    this.recordAuthAttempt(userId, authMethod, authSuccess, context);

    if (!authSuccess) {
      this.handleFailedAuth(userId);
      return { success: false, errorCode: 'INVALID_CREDENTIALS' };
    }

    // Check if MFA is required
    const requiresMFA = this.policy.mfaPolicy.required && 
                       this.mfaManager.isUserMFAConfigured(userId);

    if (requiresMFA) {
      try {
        const mfaChallenge = await this.mfaManager.createChallenge(userId);
        return {
          success: false,
          requiresMFA: true,
          mfaChallengeId: mfaChallenge.challengeId,
          userId
        };
      } catch (error: any) {
        return { success: false, errorCode: 'MFA_SETUP_REQUIRED' };
      }
    }

    // Create session
    const session = this.createSession(userId, authMethod, false, context);
    
    this.emit(AuthEvent.AUTH_SUCCESS, {
      userId,
      authMethod,
      sessionId: session.sessionId,
      context
    });

    return {
      success: true,
      sessionId: session.sessionId,
      userId,
      privilegeLevel: session.privilegeLevel
    };
  }

  /**
   * Complete MFA authentication
   */
  async completeMFAAuth(
    userId: string,
    challengeId: string,
    response: string,
    authMethod: AuthMethod,
    context: any = {}
  ): Promise<AuthResult> {
    const mfaResult = await this.mfaManager.verifyChallenge(userId, challengeId, response);
    
    if (!mfaResult.success) {
      return {
        success: false,
        errorCode: mfaResult.errorCode,
        requiresMFA: true
      };
    }

    // Create authenticated session
    const session = this.createSession(userId, authMethod, true, context);
    
    this.emit(AuthEvent.AUTH_SUCCESS, {
      userId,
      authMethod,
      mfaMethod: mfaResult.methodUsed,
      sessionId: session.sessionId,
      context
    });

    return {
      success: true,
      sessionId: session.sessionId,
      userId,
      privilegeLevel: session.privilegeLevel
    };
  }

  /**
   * Validate active session
   */
  validateSession(sessionId: string): AuthSession | null {
    const session = this.activeSessions.get(sessionId);
    
    if (!session) {
      return null;
    }

    const now = new Date();
    const idleTime = now.getTime() - session.lastActivity.getTime();
    const totalTime = now.getTime() - session.createdAt.getTime();

    // Check session timeouts
    if (idleTime > this.policy.sessionPolicy.maxIdleTimeMs ||
        totalTime > this.policy.sessionPolicy.maxSessionDurationMs) {
      this.activeSessions.delete(sessionId);
      return null;
    }

    // Update last activity
    session.lastActivity = now;
    return session;
  }

  /**
   * Logout and invalidate session
   */
  logout(sessionId: string): boolean {
    const session = this.activeSessions.get(sessionId);
    if (session) {
      this.activeSessions.delete(sessionId);
      return true;
    }
    return false;
  }

  /**
   * Change user password
   */
  async changePassword(
    userId: string,
    currentPassword: string,
    newPassword: string
  ): Promise<{ success: boolean; errorCode?: string }> {
    const userCreds = this.userCredentials.get(userId);
    if (!userCreds) {
      return { success: false, errorCode: 'USER_NOT_FOUND' };
    }

    // Verify current password
    if (!await this.verifyPassword(currentPassword, userCreds.passwordHash!, userCreds.salt!)) {
      return { success: false, errorCode: 'INVALID_CURRENT_PASSWORD' };
    }

    // Validate new password policy
    if (!this.validatePasswordPolicy(newPassword)) {
      return { success: false, errorCode: 'PASSWORD_POLICY_VIOLATION' };
    }

    // Check password reuse
    const newPasswordHash = await this.hashPassword(newPassword);
    if (this.isPasswordReused(userCreds, newPasswordHash.hash)) {
      return { success: false, errorCode: 'PASSWORD_REUSED' };
    }

    // Update password
    userCreds.previousPasswordHashes.unshift(userCreds.passwordHash!);
    userCreds.previousPasswordHashes = userCreds.previousPasswordHashes.slice(
      0, 
      this.policy.passwordPolicy.preventReuse
    );
    
    userCreds.passwordHash = newPasswordHash.hash;
    userCreds.salt = newPasswordHash.salt;
    userCreds.lastPasswordChange = new Date();

    this.emit(AuthEvent.PASSWORD_CHANGED, { userId });
    
    return { success: true };
  }

  // Private helper methods

  private createSession(
    userId: string,
    authMethod: AuthMethod,
    mfaCompleted: boolean,
    context: any
  ): AuthSession {
    const sessionId = randomBytes(32).toString('hex');
    const now = new Date();

    const session: AuthSession = {
      sessionId,
      userId,
      authMethod,
      mfaCompleted,
      privilegeLevel: 'standard', // Could be determined by role/group membership
      createdAt: now,
      lastActivity: now,
      ipAddress: context.ipAddress,
      userAgent: context.userAgent,
      metadata: {}
    };

    this.activeSessions.set(sessionId, session);
    return session;
  }

  private async hashPassword(password: string): Promise<{ hash: string; salt: string }> {
    const salt = randomBytes(32).toString('hex');
    const hash = await scryptAsync(password, salt, 64) as Buffer;
    return { hash: hash.toString('hex'), salt };
  }

  private async verifyPassword(password: string, storedHash: string, salt: string): Promise<boolean> {
    const hash = await scryptAsync(password, salt, 64) as Buffer;
    return timingSafeEqual(Buffer.from(storedHash, 'hex'), hash);
  }

  private verifyPrivateKey(privateKey: string, storedFingerprint: string): boolean {
    const fingerprint = this.calculateFingerprint(privateKey);
    return fingerprint === storedFingerprint;
  }

  private verifyCertificate(certificate: string, storedFingerprint: string): boolean {
    const fingerprint = this.calculateFingerprint(certificate);
    return fingerprint === storedFingerprint;
  }

  private async verifyExternalAuth(token: string, externalId: string, method: AuthMethod): Promise<boolean> {
    // Implementation would depend on external auth provider
    // This is a placeholder for actual integration
    console.log(`Verifying external auth: ${method} for ${externalId}`);
    return true; // Placeholder
  }

  private calculateFingerprint(data: string): string {
    return createHash('sha256').update(data).digest('hex');
  }

  private validatePasswordPolicy(password: string): boolean {
    const policy = this.policy.passwordPolicy;
    
    if (password.length < policy.minLength) return false;
    if (policy.requireUppercase && !/[A-Z]/.test(password)) return false;
    if (policy.requireLowercase && !/[a-z]/.test(password)) return false;
    if (policy.requireNumbers && !/\d/.test(password)) return false;
    if (policy.requireSpecialChars && !/[!@#$%^&*(),.?":{}|<>]/.test(password)) return false;
    
    return true;
  }

  private isPasswordReused(userCreds: UserCredentials, newPasswordHash: string): boolean {
    return userCreds.previousPasswordHashes.includes(newPasswordHash);
  }

  private recordAuthAttempt(
    userId: string,
    method: AuthMethod,
    success: boolean,
    context: any
  ): void {
    if (!this.authAttempts.has(userId)) {
      this.authAttempts.set(userId, []);
    }

    const attempts = this.authAttempts.get(userId)!;
    attempts.push({
      timestamp: new Date(),
      method,
      success,
      ipAddress: context.ipAddress,
      userAgent: context.userAgent,
      sessionId: context.sessionId
    });

    // Keep only recent attempts (last 24 hours)
    const dayAgo = new Date(Date.now() - 86400000);
    this.authAttempts.set(
      userId,
      attempts.filter(attempt => attempt.timestamp > dayAgo)
    );
  }

  private handleFailedAuth(userId: string): void {
    const attempts = this.authAttempts.get(userId) || [];
    const recentFailures = attempts.filter(
      attempt => !attempt.success && 
      attempt.timestamp > new Date(Date.now() - 3600000) // last hour
    );

    if (recentFailures.length >= this.policy.maxFailedAttempts) {
      const unlockTime = new Date(Date.now() + this.policy.lockoutDurationMs);
      this.lockedUsers.set(userId, unlockTime);
      
      this.emit(AuthEvent.AUTH_LOCKED, {
        userId,
        unlockTime,
        attemptCount: recentFailures.length
      });
    }
  }

  private isUserLocked(userId: string): boolean {
    const unlockTime = this.lockedUsers.get(userId);
    if (!unlockTime) return false;

    if (unlockTime <= new Date()) {
      this.lockedUsers.delete(userId);
      this.emit(AuthEvent.AUTH_UNLOCKED, { userId });
      return false;
    }

    return true;
  }

  private cleanupExpiredSessions(): void {
    const now = new Date();
    
    for (const [sessionId, session] of this.activeSessions) {
      const idleTime = now.getTime() - session.lastActivity.getTime();
      const totalTime = now.getTime() - session.createdAt.getTime();

      if (idleTime > this.policy.sessionPolicy.maxIdleTimeMs ||
          totalTime > this.policy.sessionPolicy.maxSessionDurationMs) {
        this.activeSessions.delete(sessionId);
      }
    }
  }

  private cleanupOldAttempts(): void {
    const dayAgo = new Date(Date.now() - 86400000);
    
    for (const [userId, attempts] of this.authAttempts) {
      const recentAttempts = attempts.filter(attempt => attempt.timestamp > dayAgo);
      if (recentAttempts.length === 0) {
        this.authAttempts.delete(userId);
      } else {
        this.authAttempts.set(userId, recentAttempts);
      }
    }
  }
}