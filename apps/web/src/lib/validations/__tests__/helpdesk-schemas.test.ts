import { describe, it, expect } from 'vitest';
import {
  createCaseSchema,
  createCaseMessageSchema,
  agentReplySchema,
  updateCaseStatusSchema,
  updateCasePrioritySchema,
  submitCsatSchema,
  createMacroSchema,
  createKbArticleSchema,
  createKbCategorySchema,
  submitArticleFeedbackSchema,
  updateCaseTagsSchema,
} from '@/lib/validations/helpdesk';

// Valid cuid2 IDs for schema tests
const CASE_ID = 'cljd4bvd00000wjh07mcy26x';
const ARTICLE_ID = 'cljd4bvd00001wjh07mcy26y';
const CATEGORY_ID = 'cljd4bvd00002wjh07mcy26z';

describe('createCaseSchema', () => {
  const VALID_CASE = {
    type: 'SUPPORT' as const,
    subject: 'My order has not arrived after two weeks',
    description: 'I placed order TWC-000123 on March 1st and it still has not arrived. The tracking shows it left the warehouse but has not moved since March 3rd. Please help me resolve this issue.',
  };

  it('accepts valid case submission', () => {
    expect(createCaseSchema.safeParse(VALID_CASE).success).toBe(true);
  });

  it('accepts all valid types', () => {
    const types = ['SUPPORT', 'ORDER', 'RETURN', 'BILLING', 'ACCOUNT'] as const;
    for (const type of types) {
      expect(createCaseSchema.safeParse({ ...VALID_CASE, type }).success).toBe(true);
    }
  });

  it('rejects DISPUTE and CHARGEBACK types from user form', () => {
    expect(createCaseSchema.safeParse({ ...VALID_CASE, type: 'DISPUTE' }).success).toBe(false);
    expect(createCaseSchema.safeParse({ ...VALID_CASE, type: 'CHARGEBACK' }).success).toBe(false);
  });

  it('rejects subject shorter than 10 characters', () => {
    expect(createCaseSchema.safeParse({ ...VALID_CASE, subject: 'Too short' }).success).toBe(false);
  });

  it('rejects description shorter than 50 characters', () => {
    const shortDesc = 'Short desc';
    expect(createCaseSchema.safeParse({ ...VALID_CASE, description: shortDesc }).success).toBe(false);
  });

  it('rejects unknown extra fields (strict mode)', () => {
    expect(createCaseSchema.safeParse({ ...VALID_CASE, unknownField: 'bad' }).success).toBe(false);
  });

  it('accepts optional orderId as cuid2', () => {
    expect(createCaseSchema.safeParse({ ...VALID_CASE, orderId: CASE_ID }).success).toBe(true);
  });

  it('accepts valid attachments array', () => {
    const withAttachments = {
      ...VALID_CASE,
      attachments: [{
        url: 'https://cdn.twicely.co/attachments/photo.jpg',
        filename: 'photo.jpg',
        mimeType: 'image/jpeg',
        sizeBytes: 204800,
      }],
    };
    expect(createCaseSchema.safeParse(withAttachments).success).toBe(true);
  });

  it('rejects more than 5 attachments', () => {
    const attachment = { url: 'https://cdn.twicely.co/a.jpg', filename: 'a.jpg', mimeType: 'image/jpeg', sizeBytes: 1024 };
    const withTooMany = { ...VALID_CASE, attachments: Array(6).fill(attachment) };
    expect(createCaseSchema.safeParse(withTooMany).success).toBe(false);
  });
});

describe('createCaseMessageSchema', () => {
  it('accepts valid message', () => {
    expect(createCaseMessageSchema.safeParse({ body: 'Here is my reply.' }).success).toBe(true);
  });

  it('rejects empty body', () => {
    expect(createCaseMessageSchema.safeParse({ body: '' }).success).toBe(false);
  });

  it('rejects unknown fields (strict)', () => {
    expect(createCaseMessageSchema.safeParse({ body: 'hello', extra: 'bad' }).success).toBe(false);
  });
});

describe('agentReplySchema', () => {
  const VALID_REPLY = { caseId: CASE_ID, body: 'Agent reply body text here.' };

  it('accepts valid agent reply', () => {
    expect(agentReplySchema.safeParse(VALID_REPLY).success).toBe(true);
  });

  it('accepts isInternal flag', () => {
    expect(agentReplySchema.safeParse({ ...VALID_REPLY, isInternal: true }).success).toBe(true);
  });

  it('defaults isInternal to false', () => {
    const result = agentReplySchema.safeParse(VALID_REPLY);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.isInternal).toBe(false);
    }
  });

  it('rejects missing caseId', () => {
    expect(agentReplySchema.safeParse({ body: 'Reply text' }).success).toBe(false);
  });

  it('accepts seed-format caseId', () => {
    expect(agentReplySchema.safeParse({ caseId: 'seed-hd-case-001', body: 'Reply text' }).success).toBe(true);
  });

  it('rejects empty caseId', () => {
    expect(agentReplySchema.safeParse({ caseId: '', body: 'Reply text' }).success).toBe(false);
  });
});

describe('updateCaseStatusSchema', () => {
  it('accepts all valid status transitions', () => {
    const statuses = ['OPEN', 'PENDING_USER', 'PENDING_INTERNAL', 'ON_HOLD', 'ESCALATED', 'RESOLVED'] as const;
    for (const status of statuses) {
      expect(updateCaseStatusSchema.safeParse({ caseId: CASE_ID, status }).success).toBe(true);
    }
  });

  it('rejects NEW and CLOSED (not agent-settable)', () => {
    expect(updateCaseStatusSchema.safeParse({ caseId: CASE_ID, status: 'NEW' }).success).toBe(false);
    expect(updateCaseStatusSchema.safeParse({ caseId: CASE_ID, status: 'CLOSED' }).success).toBe(false);
  });

  it('accepts seed-format caseId', () => {
    expect(updateCaseStatusSchema.safeParse({ caseId: 'seed-hd-case-001', status: 'OPEN' }).success).toBe(true);
  });

  it('rejects empty caseId', () => {
    expect(updateCaseStatusSchema.safeParse({ caseId: '', status: 'OPEN' }).success).toBe(false);
  });
});

describe('updateCasePrioritySchema', () => {
  it('accepts all priority values', () => {
    const priorities = ['CRITICAL', 'URGENT', 'HIGH', 'NORMAL', 'LOW'] as const;
    for (const priority of priorities) {
      expect(updateCasePrioritySchema.safeParse({ caseId: CASE_ID, priority }).success).toBe(true);
    }
  });

  it('rejects invalid priority', () => {
    expect(updateCasePrioritySchema.safeParse({ caseId: CASE_ID, priority: 'MEDIUM' }).success).toBe(false);
  });

  it('accepts seed-format caseId', () => {
    expect(updateCasePrioritySchema.safeParse({ caseId: 'seed-hd-case-001', priority: 'HIGH' }).success).toBe(true);
  });

  it('rejects empty caseId', () => {
    expect(updateCasePrioritySchema.safeParse({ caseId: '', priority: 'HIGH' }).success).toBe(false);
  });
});

describe('submitCsatSchema', () => {
  it('accepts valid rating 1-5', () => {
    for (let rating = 1; rating <= 5; rating++) {
      expect(submitCsatSchema.safeParse({ caseId: CASE_ID, rating }).success).toBe(true);
    }
  });

  it('rejects rating 0 and 6', () => {
    expect(submitCsatSchema.safeParse({ caseId: CASE_ID, rating: 0 }).success).toBe(false);
    expect(submitCsatSchema.safeParse({ caseId: CASE_ID, rating: 6 }).success).toBe(false);
  });

  it('accepts optional comment', () => {
    expect(submitCsatSchema.safeParse({ caseId: CASE_ID, rating: 5, comment: 'Great service!' }).success).toBe(true);
  });
});

describe('createMacroSchema', () => {
  it('accepts valid macro', () => {
    expect(createMacroSchema.safeParse({
      name: 'Return Approval',
      bodyTemplate: 'Hi {{buyer_name}}, we have approved your return for case {{case_number}}.',
    }).success).toBe(true);
  });

  it('rejects empty name', () => {
    expect(createMacroSchema.safeParse({ name: '', bodyTemplate: 'body' }).success).toBe(false);
  });
});

describe('createKbArticleSchema', () => {
  const VALID_ARTICLE = {
    categoryId: CATEGORY_ID,
    slug: 'how-returns-work',
    title: 'How Returns Work',
    body: 'This article explains how the return process works on Twicely.',
  };

  it('accepts valid article', () => {
    expect(createKbArticleSchema.safeParse(VALID_ARTICLE).success).toBe(true);
  });

  it('rejects slug with uppercase or spaces', () => {
    expect(createKbArticleSchema.safeParse({ ...VALID_ARTICLE, slug: 'How Returns Work' }).success).toBe(false);
    expect(createKbArticleSchema.safeParse({ ...VALID_ARTICLE, slug: 'HOW-RETURNS' }).success).toBe(false);
  });

  it('rejects body shorter than 10 chars', () => {
    expect(createKbArticleSchema.safeParse({ ...VALID_ARTICLE, body: 'Short' }).success).toBe(false);
  });

  it('accepts all audience values', () => {
    const audiences = ['ALL', 'BUYER', 'SELLER', 'AGENT_ONLY'] as const;
    for (const audience of audiences) {
      expect(createKbArticleSchema.safeParse({ ...VALID_ARTICLE, audience }).success).toBe(true);
    }
  });

  it('accepts seed-format categoryId', () => {
    expect(createKbArticleSchema.safeParse({ ...VALID_ARTICLE, categoryId: 'seed-kb-cat-001' }).success).toBe(true);
  });

  it('rejects empty categoryId', () => {
    expect(createKbArticleSchema.safeParse({ ...VALID_ARTICLE, categoryId: '' }).success).toBe(false);
  });
});

describe('createKbCategorySchema', () => {
  it('accepts valid category', () => {
    expect(createKbCategorySchema.safeParse({ slug: 'orders-shipping', name: 'Orders & Shipping' }).success).toBe(true);
  });

  it('rejects short slug', () => {
    expect(createKbCategorySchema.safeParse({ slug: 'a', name: 'A' }).success).toBe(false);
  });
});

describe('submitArticleFeedbackSchema', () => {
  it('accepts helpful: true', () => {
    expect(submitArticleFeedbackSchema.safeParse({ articleId: ARTICLE_ID, helpful: true }).success).toBe(true);
  });

  it('accepts helpful: false with comment', () => {
    expect(submitArticleFeedbackSchema.safeParse({ articleId: ARTICLE_ID, helpful: false, comment: 'Needs more detail.' }).success).toBe(true);
  });

  it('rejects unknown fields (strict)', () => {
    expect(submitArticleFeedbackSchema.safeParse({ articleId: ARTICLE_ID, helpful: true, extra: 'bad' }).success).toBe(false);
  });

  it('accepts seed-format articleId', () => {
    expect(submitArticleFeedbackSchema.safeParse({ articleId: 'seed-kb-article-001', helpful: true }).success).toBe(true);
  });

  it('rejects empty articleId', () => {
    expect(submitArticleFeedbackSchema.safeParse({ articleId: '', helpful: true }).success).toBe(false);
  });
});

describe('updateCaseTagsSchema', () => {
  it('accepts empty tags array', () => {
    expect(updateCaseTagsSchema.safeParse({ caseId: CASE_ID, tags: [] }).success).toBe(true);
  });

  it('accepts non-empty tags', () => {
    expect(updateCaseTagsSchema.safeParse({ caseId: CASE_ID, tags: ['shipping', 'urgent'] }).success).toBe(true);
  });

  it('accepts seed-format caseId', () => {
    expect(updateCaseTagsSchema.safeParse({ caseId: 'seed-hd-case-001', tags: [] }).success).toBe(true);
  });

  it('rejects empty caseId', () => {
    expect(updateCaseTagsSchema.safeParse({ caseId: '', tags: [] }).success).toBe(false);
  });
});
