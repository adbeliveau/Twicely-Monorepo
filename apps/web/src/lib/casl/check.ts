import type { Subject } from './subjects';

/**
 * Custom subject helper that wraps conditions with CASL's subject type marker.
 *
 * This replaces CASL's subject() helper to avoid TypeScript strict-mode
 * incompatibility with ForcedSubject<T>'s branded return type.
 *
 * @param type - The subject type (e.g., 'Listing', 'Order')
 * @param conditions - The conditions object with properties to check
 * @returns A plain object with __caslSubjectType__ marker
 */
export function sub<T extends Subject>(
  type: T,
  conditions: Record<string, unknown>,
): Record<string, unknown> {
  return { ...conditions, __caslSubjectType__: type };
}
