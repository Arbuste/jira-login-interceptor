/** Stored configuration for the group auto-joiner. */
export interface AppConfig {
  orgId: string;
  directoryId: string;
  groupId: string;
}

/** An Atlassian Admin API resource with id + attributes. */
export interface AdminResource {
  id: string;
  attributes?: { name?: string; [key: string]: unknown };
}

/** Webtrigger request shape (headers/queryParameters are string arrays). */
export interface WebTriggerRequest {
  body: string;
  headers: Record<string, string[]>;
  method: string;
  path: string;
  queryParameters: Record<string, string[]>;
}

/** Webtrigger response shape. */
export interface WebTriggerResponse {
  statusCode: number;
  headers?: Record<string, string[]>;
  body: string;
  statusText?: string;
}

/** Body sent by the Chrome extension to the webtrigger. */
export interface WebtriggerBody {
  action: 'addToGroup' | 'verifyMembership';
  accountId: string;
}
