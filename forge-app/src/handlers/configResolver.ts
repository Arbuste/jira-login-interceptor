import Resolver from '@forge/resolver';
import { webTrigger } from '@forge/api';
import {
  getConfig,
  setConfig,
  getApiKey,
  setApiKey,
  generateApiKey,
  getAdminApiKey,
  setAdminApiKey,
} from '../storage';
import { AppConfig, AdminResource } from '../types';
import {
  listOrganizations,
  listDirectories,
  listGroups,
} from '../admin-api';

const resolver = new Resolver();

resolver.define('getConfig', async (): Promise<AppConfig> => {
  const config = await getConfig();
  return config ?? { orgId: '', directoryId: '', groupId: '' };
});

resolver.define('setConfig', async ({ payload }): Promise<{ success: boolean }> => {
  const { orgId, directoryId, groupId } = payload as AppConfig;
  await setConfig({ orgId, directoryId, groupId });
  return { success: true };
});

resolver.define('listOrgs', async (): Promise<AdminResource[]> => {
  return listOrganizations();
});

resolver.define('listDirectories', async ({ payload }): Promise<AdminResource[]> => {
  const { orgId } = payload as { orgId: string };
  if (!orgId) throw new Error('orgId is required');
  return listDirectories(orgId);
});

resolver.define('listGroups', async ({ payload }): Promise<AdminResource[]> => {
  const { orgId, directoryId } = payload as { orgId: string; directoryId: string };
  if (!orgId || !directoryId) throw new Error('orgId and directoryId are required');
  return listGroups(orgId, directoryId);
});

resolver.define('getApiKey', async (): Promise<{ apiKey: string | null }> => {
  const apiKey = await getApiKey();
  return { apiKey };
});

resolver.define('generateApiKey', async (): Promise<{ apiKey: string }> => {
  const key = generateApiKey();
  await setApiKey(key);
  return { apiKey: key };
});

resolver.define('getWebhookUrl', async (): Promise<{ url: string }> => {
  const url = await webTrigger.getUrl('group-autojoiner-webtrigger');
  return { url };
});

resolver.define('getAdminApiKey', async (): Promise<{ hasKey: boolean }> => {
  const key = await getAdminApiKey();
  return { hasKey: !!key };
});

resolver.define('setAdminApiKey', async ({ payload }): Promise<{ success: boolean }> => {
  const { adminApiKey } = payload as { adminApiKey: string };
  if (!adminApiKey) throw new Error('adminApiKey is required');
  await setAdminApiKey(adminApiKey);
  return { success: true };
});

export const configResolver = resolver.getDefinitions();
