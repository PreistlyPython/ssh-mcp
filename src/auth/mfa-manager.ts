import { authenticator } from 'otplib';
import { createHash, randomBytes } from 'crypto';
import { EventEmitter } from 'events';

export enum MFAType {
  TOTP = 'totp',
  SMS = 'sms', 
  EMAIL = 'email',
  HARDWARE_TOKEN = 'hardware_token',
  BACKUP_CODES = 'backup_codes'
}

export enum AuthEvent {
  MFA_CHALLENGE_SENT = 'mfa_challenge_sent',
  MFA_VERIFICATION_SUCCESS = 'mfa_verification_success',
  MFA_VERIFICATION_FAILED = 'mfa_verification_failed',
  MFA_SETUP_COMPLETED = 'mfa_setup_completed',
  BACKUP_CODE_USED = 'backup_code_used'
}

export interface MFAChallenge {
  challengeId: string;
  type: MFAType;
  expiresAt: Date;
  attempts: number;
  maxAttempts: number;
  metadata?: any;
}

export interface MFAConfig {
  enabled: boolean;
  requiredMethods: MFAType[];
  optionalMethods: MFAType[];
  challengeTimeoutMs: number;
  maxAttempts: number;
  backupCodesCount: number;
  totpSettings: {
    issuer: string;
    window: number;
    step: number;
  };
}

export interface UserMFAProfile {
  userId: string;
  enabledMethods: Set<MFAType>;
  totpSecret?: string;
  phoneNumber?: string;
  email?: string;
  backupCodes: Set<string>;
  lastUsed: Map<MFAType, Date>;
  setupCompleted: boolean;
}

export interface MFAVerificationResult {
  success: boolean;
  methodUsed?: MFAType;
  remainingAttempts?: number;
  errorCode?: string;
  requiresAdditionalAuth?: boolean;
}

export class MFAManager extends EventEmitter {
  private challenges = new Map<string, MFAChallenge>();
  private userProfiles = new Map<string, UserMFAProfile>();
  private config: MFAConfig;

  constructor(config: Partial<MFAConfig> = {}) {
    super();
    
    this.config = {
      enabled: true,
      requiredMethods: [MFAType.TOTP],
      optionalMethods: [MFAType.SMS, MFAType.EMAIL, MFAType.BACKUP_CODES],
      challengeTimeoutMs: 300000, // 5 minutes
      maxAttempts: 3,
      backupCodesCount: 10,
      totpSettings: {
        issuer: 'SSH-WebDev-MCP',
        window: 2,
        step: 30
      },
      ...config
    };

    // Clean up expired challenges periodically
    setInterval(() => this.cleanupExpiredChallenges(), 60000);
  }

  /**
   * Initialize MFA for a new user
   */
  async initializeUserMFA(userId: string, requiredMethods?: MFAType[]): Promise<UserMFAProfile> {
    const methods = requiredMethods || this.config.requiredMethods;
    
    const profile: UserMFAProfile = {
      userId,
      enabledMethods: new Set(),
      backupCodes: new Set(),
      lastUsed: new Map(),
      setupCompleted: false
    };

    // Generate TOTP secret if required
    if (methods.includes(MFAType.TOTP)) {
      profile.totpSecret = authenticator.generateSecret();
    }

    // Generate backup codes if enabled
    if (methods.includes(MFAType.BACKUP_CODES) || this.config.optionalMethods.includes(MFAType.BACKUP_CODES)) {
      profile.backupCodes = this.generateBackupCodes(this.config.backupCodesCount);
    }

    this.userProfiles.set(userId, profile);
    return profile;
  }

  /**
   * Complete MFA setup for user
   */
  async completeMFASetup(userId: string, setupData: {
    totpToken?: string;
    phoneNumber?: string;
    email?: string;
  }): Promise<{ success: boolean; qrCode?: string; backupCodes?: string[] }> {
    const profile = this.userProfiles.get(userId);
    if (!profile) {
      throw new Error('User MFA profile not found');
    }

    // Verify TOTP if provided
    if (setupData.totpToken && profile.totpSecret) {
      // Set window temporarily for verification
      authenticator.options = { window: this.config.totpSettings.window };
      const isValid = authenticator.verify({
        token: setupData.totpToken,
        secret: profile.totpSecret
      });

      if (!isValid) {
        return { success: false };
      }

      profile.enabledMethods.add(MFAType.TOTP);
    }

    // Set contact information
    if (setupData.phoneNumber) {
      profile.phoneNumber = setupData.phoneNumber;
      profile.enabledMethods.add(MFAType.SMS);
    }

    if (setupData.email) {
      profile.email = setupData.email;
      profile.enabledMethods.add(MFAType.EMAIL);
    }

    // Enable backup codes if generated
    if (profile.backupCodes.size > 0) {
      profile.enabledMethods.add(MFAType.BACKUP_CODES);
    }

    // Check if required methods are enabled
    const hasRequiredMethods = this.config.requiredMethods.every(method => 
      profile.enabledMethods.has(method)
    );

    if (hasRequiredMethods) {
      profile.setupCompleted = true;
      this.emit(AuthEvent.MFA_SETUP_COMPLETED, { userId, methods: Array.from(profile.enabledMethods) });
    }

    const result: any = { success: profile.setupCompleted };

    // Generate QR code for TOTP
    if (profile.totpSecret && profile.enabledMethods.has(MFAType.TOTP)) {
      result.qrCode = authenticator.keyuri(
        userId,
        this.config.totpSettings.issuer,
        profile.totpSecret
      );
    }

    // Return backup codes (only once during setup)
    if (profile.enabledMethods.has(MFAType.BACKUP_CODES)) {
      result.backupCodes = Array.from(profile.backupCodes);
    }

    return result;
  }

  /**
   * Create MFA challenge for user authentication
   */
  async createChallenge(userId: string, preferredMethod?: MFAType): Promise<MFAChallenge> {
    const profile = this.userProfiles.get(userId);
    if (!profile || !profile.setupCompleted) {
      throw new Error('User MFA not properly configured');
    }

    // Determine challenge method
    let method = preferredMethod;
    if (!method || !profile.enabledMethods.has(method)) {
      // Use first available required method
      method = this.config.requiredMethods.find(m => profile.enabledMethods.has(m));
      if (!method) {
        method = Array.from(profile.enabledMethods)[0];
      }
    }

    if (!method) {
      throw new Error('No MFA method available for user');
    }

    const challengeId = this.generateChallengeId();
    const challenge: MFAChallenge = {
      challengeId,
      type: method,
      expiresAt: new Date(Date.now() + this.config.challengeTimeoutMs),
      attempts: 0,
      maxAttempts: this.config.maxAttempts
    };

    // Handle method-specific challenge creation
    switch (method) {
      case MFAType.SMS:
        challenge.metadata = await this.sendSMSChallenge(profile.phoneNumber!);
        break;
      case MFAType.EMAIL:
        challenge.metadata = await this.sendEmailChallenge(profile.email!);
        break;
      case MFAType.TOTP:
      case MFAType.BACKUP_CODES:
        // No additional metadata needed
        break;
    }

    this.challenges.set(challengeId, challenge);
    
    this.emit(AuthEvent.MFA_CHALLENGE_SENT, {
      userId,
      challengeId,
      method,
      expiresAt: challenge.expiresAt
    });

    return challenge;
  }

  /**
   * Verify MFA challenge response
   */
  async verifyChallenge(
    userId: string, 
    challengeId: string, 
    response: string
  ): Promise<MFAVerificationResult> {
    const challenge = this.challenges.get(challengeId);
    const profile = this.userProfiles.get(userId);

    if (!challenge || !profile) {
      return { success: false, errorCode: 'INVALID_CHALLENGE' };
    }

    if (challenge.expiresAt < new Date()) {
      this.challenges.delete(challengeId);
      return { success: false, errorCode: 'CHALLENGE_EXPIRED' };
    }

    if (challenge.attempts >= challenge.maxAttempts) {
      this.challenges.delete(challengeId);
      return { success: false, errorCode: 'MAX_ATTEMPTS_EXCEEDED' };
    }

    challenge.attempts++;

    let isValid = false;

    // Verify based on challenge type
    switch (challenge.type) {
      case MFAType.TOTP:
        isValid = this.verifyTOTP(profile.totpSecret!, response);
        break;
      case MFAType.SMS:
      case MFAType.EMAIL:
        isValid = this.verifyTemporaryCode(challenge.metadata.code, response);
        break;
      case MFAType.BACKUP_CODES:
        isValid = this.verifyBackupCode(profile, response);
        break;
    }

    if (isValid) {
      this.challenges.delete(challengeId);
      profile.lastUsed.set(challenge.type, new Date());
      
      this.emit(AuthEvent.MFA_VERIFICATION_SUCCESS, {
        userId,
        challengeId,
        method: challenge.type
      });

      return { 
        success: true, 
        methodUsed: challenge.type 
      };
    } else {
      this.emit(AuthEvent.MFA_VERIFICATION_FAILED, {
        userId,
        challengeId,
        method: challenge.type,
        attempts: challenge.attempts
      });

      return {
        success: false,
        errorCode: 'INVALID_RESPONSE',
        remainingAttempts: challenge.maxAttempts - challenge.attempts
      };
    }
  }

  /**
   * Check if user has MFA properly configured
   */
  isUserMFAConfigured(userId: string): boolean {
    const profile = this.userProfiles.get(userId);
    return profile?.setupCompleted || false;
  }

  /**
   * Get user's available MFA methods
   */
  getUserMFAMethods(userId: string): MFAType[] {
    const profile = this.userProfiles.get(userId);
    return profile ? Array.from(profile.enabledMethods) : [];
  }

  /**
   * Regenerate backup codes for user
   */
  async regenerateBackupCodes(userId: string): Promise<string[]> {
    const profile = this.userProfiles.get(userId);
    if (!profile) {
      throw new Error('User MFA profile not found');
    }

    profile.backupCodes = this.generateBackupCodes(this.config.backupCodesCount);
    
    return Array.from(profile.backupCodes);
  }

  // Private helper methods

  private generateChallengeId(): string {
    return randomBytes(16).toString('hex');
  }

  private generateBackupCodes(count: number): Set<string> {
    const codes = new Set<string>();
    
    while (codes.size < count) {
      const code = randomBytes(4).toString('hex').toUpperCase();
      codes.add(code);
    }
    
    return codes;
  }

  private verifyTOTP(secret: string, token: string): boolean {
    // Set window temporarily for verification
    authenticator.options = { window: this.config.totpSettings.window };
    return authenticator.verify({
      token,
      secret
    });
  }

  private verifyTemporaryCode(expectedCode: string, providedCode: string): boolean {
    return expectedCode === providedCode;
  }

  private verifyBackupCode(profile: UserMFAProfile, code: string): boolean {
    const normalizedCode = code.toUpperCase().replace(/\s/g, '');
    
    if (profile.backupCodes.has(normalizedCode)) {
      profile.backupCodes.delete(normalizedCode);
      this.emit(AuthEvent.BACKUP_CODE_USED, { 
        userId: profile.userId, 
        remainingCodes: profile.backupCodes.size 
      });
      return true;
    }
    
    return false;
  }

  private async sendSMSChallenge(phoneNumber: string): Promise<{ code: string }> {
    // Generate 6-digit code
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    
    // In production, integrate with SMS service (Twilio, AWS SNS, etc.)
    console.log(`SMS Challenge sent to ${phoneNumber}: ${code}`);
    
    return { code };
  }

  private async sendEmailChallenge(email: string): Promise<{ code: string }> {
    // Generate 6-digit code
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    
    // In production, integrate with email service (SendGrid, AWS SES, etc.)
    console.log(`Email Challenge sent to ${email}: ${code}`);
    
    return { code };
  }

  private cleanupExpiredChallenges(): void {
    const now = new Date();
    
    for (const [challengeId, challenge] of this.challenges) {
      if (challenge.expiresAt < now) {
        this.challenges.delete(challengeId);
      }
    }
  }
}