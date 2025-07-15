
import { Client } from "ssh2";
import { EncryptedSession } from './security/session-encryption.js';

export interface SSHSession {
  client: Client;
  host: string;
  username: string;
  defaultDir?: string;
  retryCount: number;
  lastActivity: number;
  isConnected: boolean;
  reconnectTimer?: NodeJS.Timeout;
  encryptedMetadata?: EncryptedSession;
  connectionConfig: {
    host: string;
    port: number;
    username: string;
    password?: string;
    privateKey?: string | Buffer;
  };
}

export interface CreateSessionParams {
  host: string;
  username: string;
  password?: string;
  privateKey?: string | Buffer;
  privateKeyPath?: string;
  passphrase?: string;
  port?: number;
  defaultDir?: string;
  maxRetries?: number;
  retryDelay?: number;
}

export interface ExecuteCommandParams {
  sessionId: string;
  command: string;
}

export interface TransferFileParams {
  sessionId: string;
  localPath: string;
  remotePath: string;
  direction: "upload" | "download";
}

export interface CloseSessionParams {
  sessionId: string;
}

export interface SSHManager {
  sessions: Map<string, SSHSession>;
  createSession(params: CreateSessionParams): Promise<string>;
  executeCommand(params: ExecuteCommandParams): Promise<string>;
  transferFile(params: TransferFileParams): Promise<string>;
  closeSession(params: CloseSessionParams): Promise<string>;
  getSession(sessionId: string): SSHSession | undefined;
}
