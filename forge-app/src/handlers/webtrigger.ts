import { validateApiKey } from '../auth';
import { getConfig } from '../storage';
import { addUserToGroup, checkUserMembership } from '../admin-api';
import {
  WebTriggerRequest,
  WebTriggerResponse,
  WebtriggerBody,
} from '../types';

function jsonResponse(statusCode: number, body: Record<string, unknown>): WebTriggerResponse {
  return {
    statusCode,
    headers: { 'Content-Type': ['application/json'] },
    body: JSON.stringify(body),
  };
}

/**
 * Webtrigger handler — called by the Chrome extension.
 */
export async function handleWebtrigger(request: WebTriggerRequest): Promise<WebTriggerResponse> {
  // Authenticate
  const authHeader = request.headers['authorization']?.[0] ?? '';

  if (!(await validateApiKey(authHeader))) {
    return jsonResponse(401, { error: 'Invalid or missing API key' });
  }

  // Parse body
  let body: WebtriggerBody;
  try {
    body = JSON.parse(request.body) as WebtriggerBody;
  } catch {
    return jsonResponse(400, { error: 'Invalid JSON body' });
  }

  const { action, accountId } = body;

  if (!action || !accountId) {
    return jsonResponse(400, { error: 'action and accountId are required' });
  }

  // Load config
  const config = await getConfig();
  if (!config?.orgId || !config?.directoryId || !config?.groupId) {
    return jsonResponse(500, {
      error: 'Forge app not configured. Set org/directory/group in the admin page.',
    });
  }

  const { orgId, directoryId, groupId } = config;

  try {
    if (action === 'addToGroup') {
      const result = await addUserToGroup(orgId, directoryId, groupId, accountId);
      return jsonResponse(200, { success: true, data: result });
    }

    if (action === 'verifyMembership') {
      const isMember = await checkUserMembership(orgId, directoryId, groupId, accountId);
      return jsonResponse(200, { isMember });
    }

    return jsonResponse(400, { error: `Unknown action: ${action}` });
  } catch (err) {
    console.error(`Webtrigger error (${action}):`, err);
    return jsonResponse(500, {
      error: err instanceof Error ? err.message : 'Unknown error',
    });
  }
}
