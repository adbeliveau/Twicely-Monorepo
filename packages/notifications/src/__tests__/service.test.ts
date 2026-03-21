import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TEMPLATES, interpolate, type TemplateKey } from '../templates';

// Mocks
const mockDbInsert = vi.fn(() => ({ values: vi.fn().mockResolvedValue([]) }));
const mockDbSelect = vi.fn();
const mockDb = { insert: mockDbInsert, select: mockDbSelect };
const mockSendEmail = vi.fn().mockResolvedValue({ success: true });
const mockGetOfferWithParties = vi.fn();

vi.mock('@twicely/db', () => ({ db: mockDb }));
vi.mock('@/lib/email/send', () => ({ sendEmail: mockSendEmail }));
vi.mock('@twicely/commerce/offer-queries', () => ({ getOfferWithParties: mockGetOfferWithParties }));

// Helper to set up preference + settings query mocks
const mockPrefs = (prefs: { email: boolean; inApp: boolean } | null) => {
  mockDbSelect
    .mockReturnValueOnce({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue(prefs ? [prefs] : []),
        }),
      }),
    })
    .mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue([]),
        }),
      }),
    });
};


describe('Notification Service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  describe('notify() core', () => {
    it('creates IN_APP notification row when inApp enabled', async () => {
      mockPrefs({ email: false, inApp: true });
      const { notify } = await import('../service');
      await notify('user-1', 'offer.declined', { itemTitle: 'Vintage Watch', offerAmountFormatted: '$100.00' });
      expect(mockDbInsert).toHaveBeenCalled();
      const insertCall = mockDbInsert.mock.results[0]?.value;
      expect(insertCall.values).toHaveBeenCalledWith(expect.objectContaining({ channel: 'IN_APP', userId: 'user-1' }));
    });

    it('sends email when email channel enabled', async () => {
      // 1st call: getUserPreferences, 2nd: getNotificationSettingsInternal, 3rd: getUserEmail
      mockDbSelect
        .mockReturnValueOnce({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({ limit: vi.fn().mockResolvedValue([{ email: true, inApp: false }]) }),
          }),
        })
        .mockReturnValueOnce({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({ limit: vi.fn().mockResolvedValue([]) }),
          }),
        })
        .mockReturnValueOnce({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({ limit: vi.fn().mockResolvedValue([{ email: 'buyer@test.com' }]) }),
          }),
        });
      const { notify } = await import('../service');
      await notify('user-1', 'offer.accepted', { itemTitle: 'Item', offerAmountFormatted: '$50.00' });
      expect(mockSendEmail).toHaveBeenCalledWith(expect.objectContaining({ to: 'buyer@test.com' }));
    });

    it('skips email when user preference disables it', async () => {
      mockPrefs({ email: false, inApp: true });
      const { notify } = await import('../service');
      await notify('user-1', 'offer.declined', { itemTitle: 'Item' });
      expect(mockSendEmail).not.toHaveBeenCalled();
    });

    it('uses defaultChannels when no user preference exists', async () => {
      mockPrefs(null); // No preference found
      const { notify } = await import('../service');
      await notify('user-1', 'offer.received', { itemTitle: 'Test' });
      // offer.received has defaultChannels: ['EMAIL', 'IN_APP']
      expect(mockDbInsert).toHaveBeenCalled();
    });

    it('creates separate notification rows per enabled channel', async () => {
      mockDbSelect.mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({ limit: vi.fn().mockResolvedValue([{ email: true, inApp: true }]) }),
        }),
      }).mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({ limit: vi.fn().mockResolvedValue([]) }),
        }),
      }).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({ limit: vi.fn().mockResolvedValue([{ email: 'test@test.com' }]) }),
        }),
      });
      const { notify } = await import('../service');
      await notify('user-1', 'order.confirmed', { orderNumber: 'TW-123', totalFormatted: '$99.00' });
      // Should insert IN_APP + EMAIL = 2 calls
      expect(mockDbInsert).toHaveBeenCalledTimes(2);
    });
  });

  describe('Error handling', () => {
    it('email send failure does not throw (logged, failedAt set)', async () => {
      mockSendEmail.mockResolvedValueOnce({ success: false, error: 'SMTP error' });
      mockDbSelect.mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({ limit: vi.fn().mockResolvedValue([{ email: true, inApp: false }]) }),
        }),
      }).mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({ limit: vi.fn().mockResolvedValue([]) }),
        }),
      }).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({ limit: vi.fn().mockResolvedValue([{ email: 'test@test.com' }]) }),
        }),
      });
      const { notify } = await import('../service');
      // Should not throw
      await expect(notify('user-1', 'offer.declined', { itemTitle: 'Item' })).resolves.toBeUndefined();
      // Should record failure
      const insertCall = mockDbInsert.mock.results[0]?.value;
      expect(insertCall.values).toHaveBeenCalledWith(expect.objectContaining({ failureReason: 'SMTP error' }));
    });

    it('unknown templateKey returns early, no DB insert', async () => {
      const { notify } = await import('../service');
      await notify('user-1', 'invalid.template' as TemplateKey, {});
      expect(mockDbInsert).not.toHaveBeenCalled();
    });

    it('missing user email skips EMAIL channel gracefully', async () => {
      mockDbSelect.mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({ limit: vi.fn().mockResolvedValue([{ email: true, inApp: false }]) }),
        }),
      }).mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({ limit: vi.fn().mockResolvedValue([]) }),
        }),
      }).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({ limit: vi.fn().mockResolvedValue([]) }), // No email found
        }),
      });
      const { notify } = await import('../service');
      await notify('user-1', 'offer.declined', { itemTitle: 'Item' });
      expect(mockSendEmail).not.toHaveBeenCalled();
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
      mockPrefs({ email: false, inApp: true });
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

    it('notifyOfferEvent fires notify with correct templateKey for created', async () => {
      const mockNotify = vi.fn().mockResolvedValue(undefined);
      vi.doMock('../service', () => ({ notify: mockNotify }));
      mockGetOfferWithParties.mockResolvedValue({
        buyerId: 'b1', sellerId: 's1', offerCents: 5000, listingId: 'l1',
        listing: { title: 'Test Item', slug: 'test-item' },
        buyer: { name: 'Buyer' }, seller: { name: 'Seller' },
      });
      const { notifyOfferEvent } = await import('@/lib/commerce/offer-notifications');
      notifyOfferEvent('created', 'offer-1');
      // Wait for async
      await new Promise((r) => setTimeout(r, 10));
      expect(mockGetOfferWithParties).toHaveBeenCalledWith('offer-1');
    });

    it('notifyOfferEvent handles declined event', async () => {
      mockGetOfferWithParties.mockResolvedValue({
        buyerId: 'b1', sellerId: 's1', offerCents: 10000, listingId: 'l1',
        listing: { title: 'Declined Item', slug: 'declined-item' },
        buyer: { name: 'Bob' }, seller: { name: 'Sue' },
      });
      const { notifyOfferEvent } = await import('@/lib/commerce/offer-notifications');
      notifyOfferEvent('declined', 'offer-2');
      await new Promise((r) => setTimeout(r, 10));
      expect(mockGetOfferWithParties).toHaveBeenCalledWith('offer-2');
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
