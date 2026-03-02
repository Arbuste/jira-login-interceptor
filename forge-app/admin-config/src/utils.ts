import type { AdminResource } from './types';

export function resolveDisplayName(list: AdminResource[], id: string): string {
  const item = list.find((r) => r.id === id);
  return item?.attributes?.name ?? id;
}
