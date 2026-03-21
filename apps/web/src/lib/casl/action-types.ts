export const ACTIONS = ['read', 'create', 'update', 'delete', 'manage', 'impersonate'] as const;

export type Action = (typeof ACTIONS)[number];
