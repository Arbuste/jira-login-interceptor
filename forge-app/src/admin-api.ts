/**
 * Atlassian Admin API calls.
 * All requests use the Forge fetch with an explicit org-level API key
 * stored in KVS, injected as a Bearer token.
 */

import { fetch } from '@forge/api';
import { AdminResource } from './types';
import { getAdminApiKey } from './storage';

const BASE_URL = 'https://api.atlassian.com';
const MAX_PAGES = 20; // safety cap

async function authHeaders(): Promise<Record<string, string>> {
  const apiKey = await getAdminApiKey();
  if (!apiKey) {
    throw new Error('Atlassian Admin API key is not configured. Set it in the admin page.');
  }
  return {
    'Accept': 'application/json',
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${apiKey}`,
  };
}

/**
 * Generic paginated fetch. Follows `links.next` until exhausted.
 */
async function fetchAllPages<T>(startUrl: string, headers: Record<string, string>): Promise<T[]> {
  const results: T[] = [];
  let url: string | null = startUrl;
  let page = 0;

  while (url && page < MAX_PAGES) {
    const response = await fetch(url, { method: 'GET', headers });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`API request failed (${response.status}): ${errorText}`);
    }

    const json = await response.json() as { data?: T[]; links?: { next?: string } };
    if (Array.isArray(json.data)) {
      results.push(...json.data);
    }

    const next = json.links?.next ?? null;
    if (next) {
      if (next.startsWith('http')) {
        // Full URL — use as-is
        url = next;
      } else if (next.startsWith('?') || next.startsWith('/')) {
        // Query string or absolute path — resolve against current URL
        url = new URL(next, url).href;
      } else {
        // Bare cursor token — append as cursor param to original start URL
        const base = new URL(startUrl);
        base.searchParams.set('cursor', next);
        url = base.href;
      }
    } else {
      url = null;
    }
    page++;
  }

  return results;
}

/**
 * Add a user to a directory group.
 */
export async function addUserToGroup(
  orgId: string,
  directoryId: string,
  groupId: string,
  accountId: string,
): Promise<{ status: number; statusText: string }> {
  const url = `${BASE_URL}/admin/v2/orgs/${orgId}/directories/${directoryId}/groups/${groupId}/memberships`;
  const headers = await authHeaders();

  const response = await fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify({ accountId }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`API request failed (${response.status}): ${errorText}`);
  }

  return { status: response.status, statusText: response.statusText };
}

/**
 * Check whether a user is a member of a directory group.
 */
export async function checkUserMembership(
  orgId: string,
  directoryId: string,
  groupId: string,
  accountId: string,
): Promise<boolean> {
  const params = new URLSearchParams({
    groupIds: groupId,
    accountIds: accountId,
    limit: '1',
  });
  const url = `${BASE_URL}/admin/v2/orgs/${orgId}/directories/${directoryId}/users?${params}`;
  const headers = await authHeaders();

  const response = await fetch(url, {
    method: 'GET',
    headers,
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Membership check failed (${response.status}): ${errorText}`);
  }

  const data = (await response.json()) as { data?: unknown[] };
  return Array.isArray(data.data) && data.data.length > 0;
}

/**
 * List organizations accessible to this API key.
 * v1 response shape: { data: [{ id, type, attributes: { name } }] }
 */
export async function listOrganizations(): Promise<AdminResource[]> {
  const url = `${BASE_URL}/admin/v1/orgs`;
  const headers = await authHeaders();
  return fetchAllPages<AdminResource>(url, headers);
}

/**
 * List directories for an organization.
 * v2 response shape: { data: [{ directoryId, name, icon }] }
 */
export async function listDirectories(orgId: string): Promise<AdminResource[]> {
  const url = `${BASE_URL}/admin/v2/orgs/${orgId}/directories`;
  const headers = await authHeaders();

  interface DirectoryEntry { directoryId?: string; id?: string; name?: string }
  const entries = await fetchAllPages<DirectoryEntry>(url, headers);
  return entries.map((d) => ({
    id: d.directoryId ?? d.id ?? '',
    attributes: { name: d.name },
  }));
}

/**
 * List groups for a directory.
 * v2 response shape: { data: [{ groupId, name, ... }] }
 */
export async function listGroups(orgId: string, directoryId: string): Promise<AdminResource[]> {
  const url = `${BASE_URL}/admin/v2/orgs/${orgId}/directories/${directoryId}/groups`;
  const headers = await authHeaders();

  interface GroupEntry { groupId?: string; id?: string; name?: string }
  const entries = await fetchAllPages<GroupEntry>(url, headers);
  return entries.map((g) => ({
    id: g.groupId ?? g.id ?? '',
    attributes: { name: g.name },
  }));
}
