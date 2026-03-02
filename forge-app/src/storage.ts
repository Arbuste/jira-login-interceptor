import { kvs } from '@forge/kvs';
import { AppConfig } from './types';
import crypto from 'crypto';

const CONFIG_KEY = 'group-autojoiner-config';
const API_KEY_KEY = 'group-autojoiner-api-key';
const ADMIN_API_KEY_KEY = 'group-autojoiner-admin-api-key';

/**
 * Reads the stored configuration.
 */
export async function getConfig(): Promise<AppConfig | null> {
  try {
    return await kvs.get(CONFIG_KEY) as AppConfig | null;
  } catch {
    return null;
  }
}

/**
 * Writes the configuration to storage.
 */
export async function setConfig(config: AppConfig): Promise<void> {
  const { orgId, directoryId, groupId } = config;
  if (!orgId || !directoryId || !groupId) {
    throw new Error('orgId, directoryId, and groupId are all required');
  }
  await kvs.set(CONFIG_KEY, { orgId, directoryId, groupId });
}

/**
 * Reads the stored API key.
 */
export async function getApiKey(): Promise<string | null> {
  try {
    return await kvs.get(API_KEY_KEY) as string | null;
  } catch {
    return null;
  }
}

/**
 * Writes the API key to storage.
 */
export async function setApiKey(key: string): Promise<void> {
  await kvs.set(API_KEY_KEY, key);
}

/**
 * Generates a 32-character hex API key.
 */
export function generateApiKey(): string {
  return crypto.randomUUID().replaceAll('-', '');
}

/**
 * Reads the stored Atlassian Admin API key.
 */
export async function getAdminApiKey(): Promise<string | null> {
  try {
    return await kvs.get(ADMIN_API_KEY_KEY) as string | null;
  } catch {
    return null;
  }
}

/**
 * Writes the Atlassian Admin API key to storage.
 */
export async function setAdminApiKey(key: string): Promise<void> {
  await kvs.set(ADMIN_API_KEY_KEY, key);
}
