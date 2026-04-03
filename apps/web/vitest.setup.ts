/**
 * Global vitest setup — prevents real auth chain from loading.
 *
 * When tests DON'T mock @twicely/casl, the real barrel loads and re-exports
 * from ./authorize.ts.  That module imports @twicely/auth/server → schema
 * tables, crashing on partial schema mocks.
 *
 * This setup mocks the authorize SUBPATH so the barrel re-export is
 * intercepted before real auth infrastructure loads.  Tests that mock
 * @twicely/casl (the barrel) override this entirely — the barrel mock
 * never imports ./authorize at all.
 */
import { vi } from 'vitest';

vi.mock('@twicely/casl/authorize', () => ({
  authorize: vi.fn().mockResolvedValue({
    userId: 'test-user-setup',
    role: 'USER',
    status: 'ACTIVE',
    ability: {
      can: vi.fn(() => true),
      cannot: vi.fn(() => false),
    },
  }),
  requireAuth: vi.fn().mockResolvedValue({
    userId: 'test-user-setup',
    role: 'USER',
    status: 'ACTIVE',
    ability: {
      can: vi.fn(() => true),
      cannot: vi.fn(() => false),
    },
  }),
  ForbiddenError: class ForbiddenError extends Error {
    constructor(message = 'Forbidden') {
      super(message);
      this.name = 'ForbiddenError';
    }
  },
}));
