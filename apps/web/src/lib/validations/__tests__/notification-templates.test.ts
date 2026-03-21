import { describe, it, expect } from 'vitest';
import {
  createNotificationTemplateSchema,
  updateNotificationTemplateSchema,
  deleteNotificationTemplateSchema,
} from '@/lib/validations/notification-templates';

const TEMPLATE_ID = 'cljd4bvd00000wjh07mcy26x';

const VALID_CREATE = {
  key: 'order.confirmed',
  name: 'Order Confirmed',
  category: 'orders',
  bodyTemplate: 'Your order has been confirmed.',
  channels: ['EMAIL'] as ['EMAIL'],
};

describe('createNotificationTemplateSchema', () => {
  it('accepts valid input', () => {
    expect(createNotificationTemplateSchema.safeParse(VALID_CREATE).success).toBe(true);
  });

  it('accepts all valid channels', () => {
    const result = createNotificationTemplateSchema.safeParse({
      ...VALID_CREATE,
      channels: ['EMAIL', 'PUSH', 'IN_APP', 'SMS'],
    });
    expect(result.success).toBe(true);
  });

  it('accepts optional fields', () => {
    const result = createNotificationTemplateSchema.safeParse({
      ...VALID_CREATE,
      description: 'Sent when order is confirmed',
      subjectTemplate: 'Order {{orderId}} confirmed',
      htmlTemplate: '<p>Confirmed</p>',
      isSystemOnly: true,
      isActive: false,
    });
    expect(result.success).toBe(true);
  });

  it('rejects missing key', () => {
    const { key: _key, ...rest } = VALID_CREATE;
    expect(createNotificationTemplateSchema.safeParse(rest).success).toBe(false);
  });

  it('rejects key with uppercase letters', () => {
    expect(
      createNotificationTemplateSchema.safeParse({ ...VALID_CREATE, key: 'Order.confirmed' }).success,
    ).toBe(false);
  });

  it('rejects key with spaces', () => {
    expect(
      createNotificationTemplateSchema.safeParse({ ...VALID_CREATE, key: 'order confirmed' }).success,
    ).toBe(false);
  });

  it('rejects key starting with a number', () => {
    expect(
      createNotificationTemplateSchema.safeParse({ ...VALID_CREATE, key: '1order.confirmed' }).success,
    ).toBe(false);
  });

  it('rejects empty channels array', () => {
    expect(
      createNotificationTemplateSchema.safeParse({ ...VALID_CREATE, channels: [] }).success,
    ).toBe(false);
  });

  it('rejects invalid channel value', () => {
    expect(
      createNotificationTemplateSchema.safeParse({ ...VALID_CREATE, channels: ['TELEGRAM'] }).success,
    ).toBe(false);
  });

  it('rejects unknown fields (strict mode)', () => {
    expect(
      createNotificationTemplateSchema.safeParse({ ...VALID_CREATE, unknownField: 'bad' }).success,
    ).toBe(false);
  });

  it('rejects missing bodyTemplate', () => {
    const { bodyTemplate: _body, ...rest } = VALID_CREATE;
    expect(createNotificationTemplateSchema.safeParse(rest).success).toBe(false);
  });
});

describe('updateNotificationTemplateSchema', () => {
  it('accepts partial update with only name', () => {
    expect(
      updateNotificationTemplateSchema.safeParse({ templateId: TEMPLATE_ID, name: 'New Name' }).success,
    ).toBe(true);
  });

  it('accepts update with only templateId (no-op update)', () => {
    expect(
      updateNotificationTemplateSchema.safeParse({ templateId: TEMPLATE_ID }).success,
    ).toBe(true);
  });

  it('requires templateId', () => {
    expect(
      updateNotificationTemplateSchema.safeParse({ name: 'New Name' }).success,
    ).toBe(false);
  });

  it('rejects templateId that is not cuid2', () => {
    expect(
      updateNotificationTemplateSchema.safeParse({ templateId: 'not-a-cuid2', name: 'Name' }).success,
    ).toBe(false);
  });

  it('rejects unknown fields (strict mode)', () => {
    expect(
      updateNotificationTemplateSchema.safeParse({ templateId: TEMPLATE_ID, unknownField: 'bad' }).success,
    ).toBe(false);
  });

  it('accepts partial channels update', () => {
    expect(
      updateNotificationTemplateSchema.safeParse({
        templateId: TEMPLATE_ID,
        channels: ['EMAIL', 'PUSH'],
      }).success,
    ).toBe(true);
  });

  it('rejects empty channels array on update', () => {
    expect(
      updateNotificationTemplateSchema.safeParse({
        templateId: TEMPLATE_ID,
        channels: [],
      }).success,
    ).toBe(false);
  });
});

describe('deleteNotificationTemplateSchema', () => {
  it('accepts valid templateId as cuid2', () => {
    expect(
      deleteNotificationTemplateSchema.safeParse({ templateId: TEMPLATE_ID }).success,
    ).toBe(true);
  });

  it('requires templateId', () => {
    expect(deleteNotificationTemplateSchema.safeParse({}).success).toBe(false);
  });

  it('rejects templateId that is not cuid2', () => {
    expect(
      deleteNotificationTemplateSchema.safeParse({ templateId: 'abc-not-cuid2' }).success,
    ).toBe(false);
  });

  it('rejects unknown fields (strict mode)', () => {
    expect(
      deleteNotificationTemplateSchema.safeParse({
        templateId: TEMPLATE_ID,
        extra: 'bad',
      }).success,
    ).toBe(false);
  });
});
