import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TEMPLATES, interpolate, type TemplateKey } from '../templates';

// ─── Mocks ──────────────────────────────────────────────────────────────────

const mockDbInsert = vi.fn();
const mockDbSelect = vi.fn();
const mockDb = { insert: mockDbInsert, select: mockDbSelect };
const mockSendEmail = vi.fn();
const mockGetPlatformSetting = vi.fn();
const mockValkeyGet = vi.fn();
const mockValkeyIncr = vi.fn();
const mockValkeyExpire = vi.fn();
const mockGetValkeyClient = vi.fn();
const mockGetEmailComponent = vi.fn();

vi.mock('@twicely/db', () => ({ db: mockDb }));
vi.mock('@twicely/email/send', () => ({ sendEmail: mockSendEmail }));
vi.mock('@twicely/logger', () => ({
  logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn() },
}));
vi.mock('@twicely/db/cache', () => ({
  getValkeyClient: mockGetValkeyClient,
}));
vi.mock('@twicely/db/queries/platform-settings', () => ({
  getPlatformSetting: mockGetPlatformSetting,
}));
vi.mock('../email-components', () => ({
  getEmailComponent: mockGetEmailComponent,
}));

// ─── Helpers ────────────────────────────────────────────────────────────────

function resetDefaults() {
  mockDbInsert.mockImplementation(() => ({ values: vi.fn().mockResolvedValue([]) }));
  mockSendEmail.mockResolvedValue({ success: true });
  mockGetPlatformSetting.mockResolvedValue(true);
  mockValkeyGet.mockResolvedValue('0');
  mockValkeyIncr.mockResolvedValue(1);
  mockValkeyExpire.mockResolvedValue(1);
  mockGetValkeyClient.mockReturnValue({
    get: mockValkeyGet,
    incr: mockValkeyIncr,
    expire: mockValkeyExpire,
  });
  mockGetEmailComponent.mockReturnValue(null);
}

function mockSelectChain(opts: {
  prefs?: { email: boolean; inApp: boolean } | null;
  settings?: {
    digestFrequency: string | null;
    quietHoursEnabled: boolean;
    quietHoursStart: string | null;
    quietHoursEnd: string | null;
    timezone: string;
  } | null;
  email?: string | null;
}) {
  const prefResult = opts.prefs ? [opts.prefs] : [];
  const settingsResult = opts.settings ? [opts.settings] : [];

  const makeChain = (result: unknown[]) => ({
    from: vi.fn().mockReturnValue({
      where: vi.fn().mockReturnValue({
        limit: vi.fn().mockResolvedValue(result),
      }),
    }),
  });

  // 1st: getUserPreferences, 2nd: getNotificationSettingsInternal, 3rd: getUserEmail (if provided)
  mockDbSelect
    .mockReturnValueOnce(makeChain(prefResult))
    .mockReturnValueOnce(makeChain(settingsResult));

  if (opts.email !== undefined) {
    mockDbSelect.mockReturnValueOnce(makeChain(opts.email ? [{ email: opts.email }] : []));
  }
}

// ─── Tests ──────────────────────────────────────────────────────────────────

describe('Notification Service', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.resetModules();
    resetDefaults();
  });

  describe('notify() core', () => {
    it('creates IN_APP notification row when inApp enabled', async () => {
      mockSelectChain({ prefs: { email: false, inApp: true } });
      const { notify } = await import('../service');
      await notify('user-1', 'offer.declined', { itemTitle: 'Vintage Watch', offerAmountFormatted: '$100.00' });
      expect(mockDbInsert).toHaveBeenCalled();
      const insertCall = mockDbInsert.mock.results[0]?.value;
      expect(insertCall.values).toHaveBeenCalledWith(expect.objectContaining({ channel: 'IN_APP', userId: 'user-1' }));
    });

    it('sends email when email channel enabled', async () => {
      mockSelectChain({ prefs: { email: true, inApp: false }, email: 'buyer@test.com' });
      mockGetEmailComponent.mockReturnValue('<mock-component />');
      const { notify } = await import('../service');
      await notify('user-1', 'offer.accepted', { itemTitle: 'Item', offerAmountFormatted: '$50.00' });
      expect(mockSendEmail).toHaveBeenCalledWith(expect.objectContaining({ to: 'buyer@test.com' }));
    });

    it('skips email when user preference disables it', async () => {
      mockSelectChain({ prefs: { email: false, inApp: true } });
      const { notify } = await import('../service');
      await notify('user-1', 'offer.declined', { itemTitle: 'Item' });
      expect(mockSendEmail).not.toHaveBeenCalled();
    });

    it('uses defaultChannels when no user preference exists', async () => {
      // offer.received defaults to ['EMAIL', 'IN_APP'], so getUserEmail will be called
      mockSelectChain({ prefs: null, email: 'test@test.com' });
      mockGetEmailComponent.mockReturnValue('<mock-component />');
      const { notify } = await import('../service');
      await notify('user-1', 'offer.received', { itemTitle: 'Test' });
      // Both channels should trigger inserts
      expect(mockDbInsert).toHaveBeenCalled();
    });

    it('creates separate notification rows per enabled channel', async () => {
      mockSelectChain({ prefs: { email: true, inApp: true }, email: 'test@test.com' });
      mockGetEmailComponent.mockReturnValue('<mock-component />');
      const { notify } = await import('../service');
      await notify('user-1', 'order.confirmed', { orderNumber: 'TW-123', totalFormatted: '$99.00' });
      // IN_APP + EMAIL = 2 inserts
      expect(mockDbInsert).toHaveBeenCalledTimes(2);
    });
  });

  describe('Global email gate', () => {
    it('skips email when comms.email.enabled is false', async () => {
      mockSelectChain({ prefs: { email: true, inApp: false } });
      mockGetPlatformSetting.mockResolvedValue(false); // all settings false
      const { notify } = await import('../service');
      await notify('user-1', 'offer.declined', { itemTitle: 'Item' });
      expect(mockSendEmail).not.toHaveBeenCalled();
    });
  });

  describe('Rate limiting', () => {
    it('skips email when rate limit exceeded', async () => {
      mockSelectChain({ prefs: { email: true, inApp: false }, email: 'test@test.com' });
      mockGetEmailComponent.mockReturnValue('<mock-component />');
      mockGetPlatformSetting
        .mockResolvedValueOnce(true) // comms.email.enabled
        .mockResolvedValueOnce(true) // comms.digest.enabled
        .mockResolvedValueOnce(5);   // comms.email.maxPerDayPerUser = 5
      mockValkeyGet.mockResolvedValue('5'); // At limit
      const { notify } = await import('../service');
      await notify('user-1', 'offer.declined', { itemTitle: 'Item' });
      expect(mockSendEmail).not.toHaveBeenCalled();
      expect(mockValkeyIncr).not.toHaveBeenCalled();
    });

    it('allows email when under rate limit and increments after success', async () => {
      mockSelectChain({ prefs: { email: true, inApp: false }, email: 'test@test.com' });
      mockGetEmailComponent.mockReturnValue('<mock-component />');
      mockGetPlatformSetting
        .mockResolvedValueOnce(true)  // comms.email.enabled
        .mockResolvedValueOnce(true)  // comms.digest.enabled
        .mockResolvedValueOnce(50);   // comms.email.maxPerDayPerUser
      mockValkeyGet.mockResolvedValue('3');
      const { notify } = await import('../service');
      await notify('user-1', 'offer.declined', { itemTitle: 'Item' });
      expect(mockSendEmail).toHaveBeenCalled();
      expect(mockValkeyIncr).toHaveBeenCalledTimes(1);
    });

    it('fails open when Valkey is unavailable', async () => {
      mockSelectChain({ prefs: { email: true, inApp: false }, email: 'test@test.com' });
      mockGetEmailComponent.mockReturnValue('<mock-component />');
      mockGetValkeyClient.mockReturnValue({
        get: vi.fn().mockRejectedValue(new Error('Connection refused')),
        incr: vi.fn().mockRejectedValue(new Error('Connection refused')),
        expire: vi.fn(),
      });
      const { notify } = await import('../service');
      await notify('user-1', 'offer.declined', { itemTitle: 'Item' });
      expect(mockSendEmail).toHaveBeenCalled();
    });
  });

  describe('Digest routing', () => {
    it('queues NORMAL priority email for digest when user has digestFrequency', async () => {
      mockSelectChain({
        prefs: { email: true, inApp: false },
        settings: { digestFrequency: 'daily', quietHoursEnabled: false, quietHoursStart: null, quietHoursEnd: null, timezone: 'America/New_York' },
      });
      const { notify } = await import('../service');
      // offer.expired has priority NORMAL → should be queued for digest
      await notify('user-1', 'offer.expired', { itemTitle: 'Item' });
      // Should insert digest row but NOT send email and NOT charge rate limit
      expect(mockDbInsert).toHaveBeenCalled();
      expect(mockSendEmail).not.toHaveBeenCalled();
      expect(mockValkeyIncr).not.toHaveBeenCalled();
    });

    it('sends HIGH priority email immediately even with digest enabled', async () => {
      mockSelectChain({
        prefs: { email: true, inApp: false },
        settings: { digestFrequency: 'daily', quietHoursEnabled: false, quietHoursStart: null, quietHoursEnd: null, timezone: 'America/New_York' },
        email: 'test@test.com',
      });
      mockGetEmailComponent.mockReturnValue('<mock-component />');
      const { notify } = await import('../service');
      // offer.received has priority HIGH → should send immediately
      await notify('user-1', 'offer.received', { itemTitle: 'Item' });
      expect(mockSendEmail).toHaveBeenCalled();
    });

    it('sends NORMAL email immediately when digest globally disabled', async () => {
      mockSelectChain({
        prefs: { email: true, inApp: false },
        settings: { digestFrequency: 'daily', quietHoursEnabled: false, quietHoursStart: null, quietHoursEnd: null, timezone: 'America/New_York' },
        email: 'test@test.com',
      });
      mockGetEmailComponent.mockReturnValue('<mock-component />');
      mockGetPlatformSetting
        .mockResolvedValueOnce(true)   // comms.email.enabled
        .mockResolvedValueOnce(false)  // comms.digest.enabled = false
        .mockResolvedValueOnce(50);    // comms.email.maxPerDayPerUser
      const { notify } = await import('../service');
      // offer.expired has priority NORMAL but digest disabled → should send immediately
      await notify('user-1', 'offer.expired', { itemTitle: 'Item' });
      expect(mockSendEmail).toHaveBeenCalled();
    });
  });

  describe('Email component handling', () => {
    it('records failure when getEmailComponent returns null', async () => {
      mockSelectChain({ prefs: { email: true, inApp: false }, email: 'test@test.com' });
      mockGetEmailComponent.mockReturnValue(null);
      mockGetPlatformSetting
        .mockResolvedValueOnce(true)  // comms.email.enabled
        .mockResolvedValueOnce(true); // comms.digest.enabled (rate limit never reached)
      const { notify } = await import('../service');
      await notify('user-1', 'offer.declined', { itemTitle: 'Item' });
      expect(mockSendEmail).not.toHaveBeenCalled();
      expect(mockValkeyIncr).not.toHaveBeenCalled();
      // Should insert failure row
      expect(mockDbInsert).toHaveBeenCalled();
      const insertCall = mockDbInsert.mock.results[0]?.value;
      expect(insertCall.values).toHaveBeenCalledWith(expect.objectContaining({
        failureReason: 'No email component for template',
      }));
    });
  });

  describe('Error handling', () => {
    it('email send failure does not throw (logged, failedAt set)', async () => {
      mockSendEmail.mockResolvedValueOnce({ success: false, error: 'SMTP error' });
      mockSelectChain({ prefs: { email: true, inApp: false }, email: 'test@test.com' });
      mockGetEmailComponent.mockReturnValue('<mock-component />');
      mockGetPlatformSetting
        .mockResolvedValueOnce(true)  // comms.email.enabled
        .mockResolvedValueOnce(true)  // comms.digest.enabled
        .mockResolvedValueOnce(50);   // comms.email.maxPerDayPerUser
      const { notify } = await import('../service');
      await expect(notify('user-1', 'offer.declined', { itemTitle: 'Item' })).resolves.toBeUndefined();
      expect(mockValkeyIncr).not.toHaveBeenCalled(); // Failed send should not charge quota
      const insertCall = mockDbInsert.mock.results[0]?.value;
      expect(insertCall.values).toHaveBeenCalledWith(expect.objectContaining({ failureReason: 'SMTP error' }));
    });

    it('unknown templateKey returns early, no DB insert', async () => {
      const { notify } = await import('../service');
      await notify('user-1', 'invalid.template' as TemplateKey, {});
      expect(mockDbInsert).not.toHaveBeenCalled();
    });

    it('missing user email skips EMAIL channel gracefully', async () => {
      mockSelectChain({ prefs: { email: true, inApp: false }, email: null });
      mockGetPlatformSetting
        .mockResolvedValueOnce(true)  // comms.email.enabled
        .mockResolvedValueOnce(true); // comms.digest.enabled (rate limit never reached)
      const { notify } = await import('../service');
      await notify('user-1', 'offer.declined', { itemTitle: 'Item' });
      expect(mockSendEmail).not.toHaveBeenCalled();
      expect(mockValkeyIncr).not.toHaveBeenCalled();
    });
  });

  describe('Template interpolation', () => {
    it('replaces {{placeholders}} with data values', () => {
      const result = interpolate('Hello {{name}}, your order {{orderNumber}} is ready', {
        name: 'John',
        orderNumber: 'TW-12345',
      });
      expect(result).toBe('Hello John, your order TW-12345 is ready');
    });

    it('missing placeholder key replaced with empty string', () => {
      const result = interpolate('Item: {{itemTitle}}, Price: {{price}}', { itemTitle: 'Watch' });
      expect(result).toBe('Item: Watch, Price: ');
    });

    it('subject and body both interpolated', async () => {
      mockSelectChain({ prefs: { email: false, inApp: true } });
      const { notify } = await import('../service');
      await notify('user-1', 'offer.declined', { itemTitle: 'Vintage Lamp', offerAmountFormatted: '$75.00' });
      const insertCall = mockDbInsert.mock.results[0]?.value;
      expect(insertCall.values).toHaveBeenCalledWith(
        expect.objectContaining({
          subject: 'Your offer on Vintage Lamp was not accepted',
          body: expect.stringContaining('$75.00'),
        })
      );
    });
  });

  describe('Rate limit placement (regression)', () => {
    it('does NOT charge rate limit when email is queued for digest', async () => {
      mockSelectChain({
        prefs: { email: true, inApp: false },
        settings: { digestFrequency: 'daily', quietHoursEnabled: false, quietHoursStart: null, quietHoursEnd: null, timezone: 'America/New_York' },
      });
      const { notify } = await import('../service');
      // offer.expired = NORMAL priority → digest path
      await notify('user-1', 'offer.expired', { itemTitle: 'Item' });
      expect(mockValkeyIncr).not.toHaveBeenCalled();
      expect(mockSendEmail).not.toHaveBeenCalled();
    });

    it('does NOT charge rate limit when user email is missing', async () => {
      mockSelectChain({ prefs: { email: true, inApp: false }, email: null });
      const { notify } = await import('../service');
      await notify('user-1', 'offer.declined', { itemTitle: 'Item' });
      expect(mockValkeyIncr).not.toHaveBeenCalled();
      expect(mockSendEmail).not.toHaveBeenCalled();
    });

    it('does NOT charge rate limit when getEmailComponent returns null', async () => {
      mockSelectChain({ prefs: { email: true, inApp: false }, email: 'test@test.com' });
      mockGetEmailComponent.mockReturnValue(null);
      const { notify } = await import('../service');
      await notify('user-1', 'offer.declined', { itemTitle: 'Item' });
      expect(mockValkeyIncr).not.toHaveBeenCalled();
      expect(mockSendEmail).not.toHaveBeenCalled();
    });

    it('DOES charge rate limit when email is actually sent', async () => {
      mockSelectChain({ prefs: { email: true, inApp: false }, email: 'test@test.com' });
      mockGetEmailComponent.mockReturnValue('<mock-component />');
      const { notify } = await import('../service');
      await notify('user-1', 'offer.declined', { itemTitle: 'Item' });
      expect(mockValkeyIncr).toHaveBeenCalledTimes(1);
      expect(mockSendEmail).toHaveBeenCalledTimes(1);
    });

    it('does NOT charge rate limit when sendEmail fails', async () => {
      mockSendEmail.mockResolvedValueOnce({ success: false, error: 'SMTP error' });
      mockSelectChain({ prefs: { email: true, inApp: false }, email: 'test@test.com' });
      mockGetEmailComponent.mockReturnValue('<mock-component />');
      const { notify } = await import('../service');
      await notify('user-1', 'offer.declined', { itemTitle: 'Item' });
      expect(mockSendEmail).toHaveBeenCalledTimes(1);
      expect(mockValkeyIncr).not.toHaveBeenCalled();
    });

    it('uses timezone-aware date in rate limit key', async () => {
      mockSelectChain({
        prefs: { email: true, inApp: false },
        settings: { digestFrequency: null, quietHoursEnabled: false, quietHoursStart: null, quietHoursEnd: null, timezone: 'Asia/Tokyo' },
        email: 'test@test.com',
      });
      mockGetEmailComponent.mockReturnValue('<mock-component />');
      const { notify } = await import('../service');
      await notify('user-1', 'offer.declined', { itemTitle: 'Item' });
      // Verify the rate limit key uses timezone-formatted date (YYYY-MM-DD via en-CA)
      const incrArg = mockValkeyIncr.mock.calls[0]?.[0] as string;
      expect(incrArg).toMatch(/^email-rate:user-1:\d{4}-\d{2}-\d{2}$/);
    });
  });

  describe('Integration patterns', () => {
    it('offer.received has priority HIGH', () => {
      expect(TEMPLATES['offer.received'].priority).toBe('HIGH');
    });

    it('order.confirmed has priority CRITICAL', () => {
      expect(TEMPLATES['order.confirmed'].priority).toBe('CRITICAL');
    });

    it('all 7 template keys resolve to valid TemplateDef', () => {
      const keys: TemplateKey[] = [
        'offer.declined', 'offer.accepted', 'offer.received',
        'offer.countered', 'offer.expired', 'order.confirmed', 'order.shipped',
      ];
      for (const key of keys) {
        const template = TEMPLATES[key];
        expect(template).toBeDefined();
        expect(template.key).toBe(key);
        expect(template.name).toBeTruthy();
        expect(template.category).toBeTruthy();
        expect(template.priority).toMatch(/^(CRITICAL|HIGH|NORMAL|LOW)$/);
        expect(template.defaultChannels.length).toBeGreaterThan(0);
        expect(template.subjectTemplate).toBeTruthy();
        expect(template.bodyTemplate).toBeTruthy();
      }
    });

    it('offer templates all have EMAIL and IN_APP as defaultChannels', () => {
      const offerKeys: TemplateKey[] = ['offer.declined', 'offer.accepted', 'offer.received', 'offer.countered', 'offer.expired'];
      for (const key of offerKeys) {
        expect(TEMPLATES[key].defaultChannels).toContain('EMAIL');
        expect(TEMPLATES[key].defaultChannels).toContain('IN_APP');
      }
    });
  });
});
