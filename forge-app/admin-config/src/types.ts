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
