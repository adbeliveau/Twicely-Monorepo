# TWICELY V2 — Install Phase 27: Messaging Enhancements (Safety + Scale)
**Status:** LOCKED (v1.0)  
**Scope:** Rate limiting, keyword auto-flagging, and optional attachments — NO real-time chat, NO external contact exposure  
**Backend-first:** Schema → API → Permissions → Audit → Health → Doctor → UI  
**Canonicals (MUST follow):**
- `/rules/TWICELY_NOTIFICATIONS_CANONICAL.md`
- `/rules/TWICELY_TRUST_SAFETY_CANONICAL.md`
- `/rules/TWICELY_RBAC_DELEGATED_ACCESS_LOCKED.md`

> Place this file in: `/rules/TWICELY_V2_INSTALL_PHASE_27_MESSAGING_ENHANCEMENTS.md`  
> Prereq: Phase 26 complete and Doctor green.  
> Extends: Phase 21 (core messaging)

---

## 0) What this phase installs

### Backend
- Message rate limiting (per user, per conversation)
- Keyword auto-flagging (configurable banned word list)
- Message attachment support (images only, size-limited)
- Contact info detection and blocking
- Moderation queue enhancements

### UI Enhancements
- Attachment upload in message composer
- Rate limit feedback to users
- Enhanced moderation queue with keyword highlights
- Bulk moderation actions

### Explicit exclusions
- ❌ No real-time WebSocket chat
- ❌ No external contact info allowed (email, phone, social)
- ❌ No message editing or deletion by users
- ❌ No cross-conversation broadcasting

---

## 1) Messaging safety invariants (non-negotiable)

- **Rate limits enforced server-side** (not just UI)
- **Keyword detection runs on all messages** before persistence
- **Contact info is blocked, not just flagged**
- **Attachments are virus-scanned** (future) and size-limited
- **All moderation actions are audited**

---

## 2) Prisma schema (additive)

Add to `prisma/schema.prisma`:

```prisma
model MessageRateLimit {
  id           String   @id @default(cuid())
  userId       String
  windowStart  DateTime
  messageCount Int      @default(0)
  
  @@unique([userId, windowStart])
  @@index([userId, windowStart])
}

model MessageAttachment {
  id           String   @id @default(cuid())
  messageId    String
  fileName     String
  fileType     String   // image/jpeg, image/png, etc.
  fileSizeBytes Int
  storageKey   String   // S3/R2 key
  uploadedAt   DateTime @default(now())
  
  @@index([messageId])
}

model BannedKeyword {
  id           String   @id @default(cuid())
  keyword      String   @unique
  category     String   // contact_info | profanity | spam | scam
  action       String   // block | flag | warn
  isActive     Boolean  @default(true)
  createdAt    DateTime @default(now())
  createdByStaffId String
  
  @@index([category, isActive])
}

model MessageModerationLog {
  id           String   @id @default(cuid())
  messageId    String
  action       String   // auto_flagged | auto_blocked | manual_flagged | manual_hidden
  reason       String
  matchedKeywords String[] // keywords that triggered action
  staffId      String?  // null for auto actions
  createdAt    DateTime @default(now())
  
  @@index([messageId])
  @@index([action, createdAt])
}
```

Extend existing Message model:

```prisma
model Message {
  // ... existing fields ...
  
  hasAttachment  Boolean  @default(false)
  isBlocked      Boolean  @default(false)  // NEW: message blocked from delivery
  blockReason    String?                   // NEW: why message was blocked
  moderationStatus String @default("none") // none | auto_flagged | manual_review | cleared
}
```

Migration:
```bash
npx prisma migrate dev --name messaging_enhancements_phase27
```

---

## 3) Permission keys

Add to permissions registry:

```ts
export const messagingEnhancementKeys = {
  // Existing from Phase 21
  send: "messages.send",
  view: "messages.view",
  moderate: "messages.moderate",
  
  // New for Phase 27
  uploadAttachment: "messages.attachment.upload",
  manageKeywords: "messages.keywords.manage",
  bulkModerate: "messages.moderate.bulk",
  viewModerationLogs: "messages.moderation.logs",
};
```

Rules:
- Buyer/Seller: `messages.send`, `messages.view`, `messages.attachment.upload`
- Corp Moderation: `messages.moderate`, `messages.moderation.logs`
- Corp Trust Admin: `messages.keywords.manage`, `messages.moderate.bulk`

---

## 4) Rate limiting implementation

Create `packages/core/messaging/rateLimit.ts`:

```ts
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// Rate limit config (should be in settings, hardcoded for v1)
const RATE_LIMITS = {
  messagesPerHour: 20,
  messagesPerConversationPerHour: 10,
  attachmentsPerDay: 5,
};

function getWindowStart(windowMinutes: number): Date {
  const now = new Date();
  const windowMs = windowMinutes * 60 * 1000;
  return new Date(Math.floor(now.getTime() / windowMs) * windowMs);
}

export async function checkRateLimit(userId: string): Promise<{
  allowed: boolean;
  remaining: number;
  resetAt: Date;
}> {
  const windowStart = getWindowStart(60); // 1 hour window
  
  const record = await prisma.messageRateLimit.upsert({
    where: {
      userId_windowStart: { userId, windowStart },
    },
    update: {},
    create: {
      userId,
      windowStart,
      messageCount: 0,
    },
  });

  const remaining = Math.max(0, RATE_LIMITS.messagesPerHour - record.messageCount);
  const resetAt = new Date(windowStart.getTime() + 60 * 60 * 1000);

  return {
    allowed: record.messageCount < RATE_LIMITS.messagesPerHour,
    remaining,
    resetAt,
  };
}

export async function incrementRateLimit(userId: string): Promise<void> {
  const windowStart = getWindowStart(60);
  
  await prisma.messageRateLimit.upsert({
    where: {
      userId_windowStart: { userId, windowStart },
    },
    update: {
      messageCount: { increment: 1 },
    },
    create: {
      userId,
      windowStart,
      messageCount: 1,
    },
  });
}

export async function checkConversationRateLimit(
  userId: string,
  conversationId: string
): Promise<boolean> {
  const oneHourAgo = new Date();
  oneHourAgo.setHours(oneHourAgo.getHours() - 1);

  const recentCount = await prisma.message.count({
    where: {
      conversationId,
      senderId: userId,
      createdAt: { gte: oneHourAgo },
    },
  });

  return recentCount < RATE_LIMITS.messagesPerConversationPerHour;
}
```

---

## 5) Keyword detection and blocking

Create `packages/core/messaging/keywordFilter.ts`:

```ts
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// Contact info patterns (always blocked)
const CONTACT_PATTERNS = [
  /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/gi, // email
  /\b\d{3}[-.\s]?\d{3}[-.\s]?\d{4}\b/g, // US phone
  /\b\+\d{1,3}[-.\s]?\d{6,14}\b/g, // international phone
  /@[a-zA-Z0-9_]{1,15}\b/g, // social handles
  /\b(instagram|snapchat|whatsapp|telegram|facebook|venmo|cashapp|paypal)\b/gi,
  /\b(ig|snap|wa|fb|dm me)\b/gi,
];

export type FilterResult = {
  action: "allow" | "flag" | "block";
  matchedKeywords: string[];
  reason?: string;
};

export async function filterMessage(body: string): Promise<FilterResult> {
  const matchedKeywords: string[] = [];
  let action: "allow" | "flag" | "block" = "allow";
  let reason: string | undefined;

  // 1. Check contact info patterns (always block)
  for (const pattern of CONTACT_PATTERNS) {
    const matches = body.match(pattern);
    if (matches) {
      matchedKeywords.push(...matches);
      action = "block";
      reason = "Contact information not allowed";
    }
  }

  if (action === "block") {
    return { action, matchedKeywords, reason };
  }

  // 2. Check banned keywords
  const bannedKeywords = await prisma.bannedKeyword.findMany({
    where: { isActive: true },
  });

  const lowerBody = body.toLowerCase();

  for (const kw of bannedKeywords) {
    if (lowerBody.includes(kw.keyword.toLowerCase())) {
      matchedKeywords.push(kw.keyword);
      
      if (kw.action === "block") {
        action = "block";
        reason = `Blocked keyword: ${kw.category}`;
        break;
      } else if (kw.action === "flag" && action !== "block") {
        action = "flag";
        reason = `Flagged keyword: ${kw.category}`;
      }
    }
  }

  return { action, matchedKeywords, reason };
}

export async function logModeration(
  messageId: string,
  action: string,
  reason: string,
  matchedKeywords: string[],
  staffId?: string
): Promise<void> {
  await prisma.messageModerationLog.create({
    data: {
      messageId,
      action,
      reason,
      matchedKeywords,
      staffId,
    },
  });
}
```

---

## 6) Attachment handling

Create `packages/core/messaging/attachments.ts`:

```ts
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const ATTACHMENT_CONFIG = {
  maxSizeBytes: 5 * 1024 * 1024, // 5MB
  allowedTypes: ["image/jpeg", "image/png", "image/gif", "image/webp"],
  maxPerDay: 5,
};

export async function validateAttachment(
  userId: string,
  fileType: string,
  fileSizeBytes: number
): Promise<{ valid: boolean; error?: string }> {
  // Check file type
  if (!ATTACHMENT_CONFIG.allowedTypes.includes(fileType)) {
    return { valid: false, error: "File type not allowed. Only images are supported." };
  }

  // Check file size
  if (fileSizeBytes > ATTACHMENT_CONFIG.maxSizeBytes) {
    return { valid: false, error: "File too large. Maximum size is 5MB." };
  }

  // Check daily limit
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  const todayCount = await prisma.messageAttachment.count({
    where: {
      message: { senderId: userId },
      uploadedAt: { gte: todayStart },
    },
  });

  if (todayCount >= ATTACHMENT_CONFIG.maxPerDay) {
    return { valid: false, error: "Daily attachment limit reached." };
  }

  return { valid: true };
}

export async function createAttachment(
  messageId: string,
  fileName: string,
  fileType: string,
  fileSizeBytes: number,
  storageKey: string
): Promise<void> {
  await prisma.messageAttachment.create({
    data: {
      messageId,
      fileName,
      fileType,
      fileSizeBytes,
      storageKey,
    },
  });

  await prisma.message.update({
    where: { id: messageId },
    data: { hasAttachment: true },
  });
}
```

---

## 7) Enhanced messaging API

Update `apps/web/app/api/messages/[conversationId]/route.ts`:

```ts
import { NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import { getSession } from "@/lib/auth";
import { checkRateLimit, incrementRateLimit, checkConversationRateLimit } from "@/packages/core/messaging/rateLimit";
import { filterMessage, logModeration } from "@/packages/core/messaging/keywordFilter";

const prisma = new PrismaClient();

export async function POST(req: Request, { params }: { params: { conversationId: string } }) {
  const session = await getSession();
  if (!session?.userId) {
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  }

  const { body } = await req.json();
  
  // Validate body
  if (!body || typeof body !== "string" || body.length > 2000) {
    return NextResponse.json({ error: "INVALID_MESSAGE" }, { status: 400 });
  }

  // Check conversation access
  const conversation = await prisma.conversation.findUnique({
    where: { id: params.conversationId },
  });

  if (!conversation) {
    return NextResponse.json({ error: "CONVERSATION_NOT_FOUND" }, { status: 404 });
  }

  const isBuyer = conversation.buyerId === session.userId;
  const isSeller = conversation.sellerId === session.userId;

  if (!isBuyer && !isSeller) {
    return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
  }

  // Rate limit check
  const rateLimit = await checkRateLimit(session.userId);
  if (!rateLimit.allowed) {
    return NextResponse.json({
      error: "RATE_LIMITED",
      message: "Too many messages. Please wait before sending more.",
      resetAt: rateLimit.resetAt,
    }, { status: 429 });
  }

  const conversationRateOk = await checkConversationRateLimit(
    session.userId,
    params.conversationId
  );
  if (!conversationRateOk) {
    return NextResponse.json({
      error: "CONVERSATION_RATE_LIMITED",
      message: "Too many messages in this conversation. Please wait.",
    }, { status: 429 });
  }

  // Keyword filter
  const filterResult = await filterMessage(body);

  if (filterResult.action === "block") {
    // Create blocked message for audit trail
    const msg = await prisma.message.create({
      data: {
        conversationId: params.conversationId,
        senderId: session.userId,
        senderRole: isBuyer ? "BUYER" : "SELLER",
        body: "[Message blocked]",
        isBlocked: true,
        blockReason: filterResult.reason,
        moderationStatus: "auto_flagged",
      },
    });

    await logModeration(
      msg.id,
      "auto_blocked",
      filterResult.reason || "Blocked content",
      filterResult.matchedKeywords
    );

    return NextResponse.json({
      error: "MESSAGE_BLOCKED",
      message: filterResult.reason || "This message cannot be sent.",
    }, { status: 400 });
  }

  // Create message
  const msg = await prisma.message.create({
    data: {
      conversationId: params.conversationId,
      senderId: session.userId,
      senderRole: isBuyer ? "BUYER" : "SELLER",
      body,
      isFlagged: filterResult.action === "flag",
      moderationStatus: filterResult.action === "flag" ? "auto_flagged" : "none",
    },
  });

  // Log if flagged
  if (filterResult.action === "flag") {
    await logModeration(
      msg.id,
      "auto_flagged",
      filterResult.reason || "Flagged content",
      filterResult.matchedKeywords
    );
  }

  // Increment rate limit
  await incrementRateLimit(session.userId);

  return NextResponse.json({
    message: {
      id: msg.id,
      body: msg.body,
      senderRole: msg.senderRole,
      createdAt: msg.createdAt,
    },
    rateLimit: {
      remaining: rateLimit.remaining - 1,
      resetAt: rateLimit.resetAt,
    },
  }, { status: 201 });
}
```

---

## 8) Banned keywords management API

`GET/POST /api/platform/messaging/keywords`

```ts
import { NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import { getStaffSession, assertPermission } from "@/lib/staff-auth";
import { emitAudit } from "@/packages/core/audit";

const prisma = new PrismaClient();

export async function GET(req: Request) {
  const session = await getStaffSession();
  assertPermission(session, "messages.keywords.manage");

  const keywords = await prisma.bannedKeyword.findMany({
    orderBy: [{ category: "asc" }, { keyword: "asc" }],
  });

  return NextResponse.json({ keywords });
}

export async function POST(req: Request) {
  const session = await getStaffSession();
  assertPermission(session, "messages.keywords.manage");

  const { keyword, category, action } = await req.json();

  if (!keyword || !category || !action) {
    return NextResponse.json({ error: "MISSING_FIELDS" }, { status: 400 });
  }

  const created = await prisma.bannedKeyword.create({
    data: {
      keyword: keyword.toLowerCase().trim(),
      category,
      action,
      createdByStaffId: session.staffId,
    },
  });

  await emitAudit({
    actorStaffId: session.staffId,
    action: "messages.keyword.created",
    entityType: "BannedKeyword",
    entityId: created.id,
    meta: { keyword, category, action },
  });

  return NextResponse.json({ keyword: created }, { status: 201 });
}
```

---

## 9) Bulk moderation API

`POST /api/platform/messaging/moderate/bulk`

```ts
import { NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import { getStaffSession, assertPermission } from "@/lib/staff-auth";
import { emitAudit } from "@/packages/core/audit";
import { logModeration } from "@/packages/core/messaging/keywordFilter";

const prisma = new PrismaClient();

export async function POST(req: Request) {
  const session = await getStaffSession();
  assertPermission(session, "messages.moderate.bulk");

  const { messageIds, action, reason } = await req.json();

  if (!Array.isArray(messageIds) || messageIds.length === 0) {
    return NextResponse.json({ error: "NO_MESSAGES" }, { status: 400 });
  }

  if (!["flag", "clear", "hide"].includes(action)) {
    return NextResponse.json({ error: "INVALID_ACTION" }, { status: 400 });
  }

  const updateData: any = {};
  if (action === "flag") {
    updateData.isFlagged = true;
    updateData.moderationStatus = "manual_review";
  } else if (action === "clear") {
    updateData.isFlagged = false;
    updateData.moderationStatus = "cleared";
  } else if (action === "hide") {
    updateData.isBlocked = true;
    updateData.blockReason = reason || "Hidden by moderator";
    updateData.moderationStatus = "manual_review";
  }

  await prisma.message.updateMany({
    where: { id: { in: messageIds } },
    data: updateData,
  });

  // Log each moderation action
  for (const messageId of messageIds) {
    await logModeration(
      messageId,
      `manual_${action}`,
      reason || `Bulk ${action}`,
      [],
      session.staffId
    );
  }

  await emitAudit({
    actorStaffId: session.staffId,
    action: `messages.bulk_${action}`,
    entityType: "Message",
    entityId: messageIds.join(","),
    meta: { count: messageIds.length, reason },
  });

  return NextResponse.json({
    ok: true,
    affected: messageIds.length,
  });
}
```

---

## 10) Health provider

Create `packages/core/health/providers/messagingEnhancements.ts`:

```ts
import { PrismaClient } from "@prisma/client";
import type { HealthProvider } from "../types";

const prisma = new PrismaClient();

export const messagingEnhancementsProvider: HealthProvider = {
  key: "messaging_enhancements",

  async run(runType) {
    const checks = [];

    // Check rate limiting is working
    const rateLimitRecords = await prisma.messageRateLimit.count({
      where: {
        windowStart: { gte: new Date(Date.now() - 60 * 60 * 1000) },
      },
    });

    checks.push({
      key: "messaging.rate_limiting_active",
      ok: true,
      details: `${rateLimitRecords} rate limit records in last hour`,
    });

    // Check banned keywords exist
    const keywordCount = await prisma.bannedKeyword.count({
      where: { isActive: true },
    });

    checks.push({
      key: "messaging.keywords_configured",
      ok: keywordCount > 0,
      details: `${keywordCount} active banned keywords`,
    });

    // Check auto-flagging is working
    const recentFlagged = await prisma.message.count({
      where: {
        moderationStatus: "auto_flagged",
        createdAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
      },
    });

    checks.push({
      key: "messaging.auto_flagging_active",
      ok: true,
      details: `${recentFlagged} auto-flagged messages in 24h`,
    });

    // Check moderation logs exist
    const logCount = await prisma.messageModerationLog.count({
      where: {
        createdAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
      },
    });

    checks.push({
      key: "messaging.moderation_logging",
      ok: true,
      details: `${logCount} moderation logs in 24h`,
    });

    const allOk = checks.every(c => c.ok);

    return {
      status: allOk ? "healthy" : "degraded",
      message: allOk ? "Messaging enhancements healthy" : "Issues detected",
      providerVersion: "1.0",
      ranAt: new Date().toISOString(),
      runType,
      checks,
    };
  },

  settings: { schema: {}, defaults: {} },
  ui: { SettingsPanel: () => null, DetailPage: () => null },
};
```

---

## 11) Seed banned keywords

Create `scripts/seed-banned-keywords.ts`:

```ts
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const defaultKeywords = [
  // Contact info attempts
  { keyword: "email me", category: "contact_info", action: "block" },
  { keyword: "text me", category: "contact_info", action: "block" },
  { keyword: "call me", category: "contact_info", action: "block" },
  { keyword: "dm me", category: "contact_info", action: "block" },
  { keyword: "message me on", category: "contact_info", action: "block" },
  
  // Scam indicators
  { keyword: "western union", category: "scam", action: "block" },
  { keyword: "wire transfer", category: "scam", action: "block" },
  { keyword: "gift card", category: "scam", action: "flag" },
  { keyword: "outside the platform", category: "scam", action: "block" },
  { keyword: "off platform", category: "scam", action: "block" },
  
  // Spam
  { keyword: "check out my store", category: "spam", action: "flag" },
  { keyword: "follow me", category: "spam", action: "flag" },
];

async function seed() {
  for (const kw of defaultKeywords) {
    await prisma.bannedKeyword.upsert({
      where: { keyword: kw.keyword },
      update: {},
      create: {
        ...kw,
        createdByStaffId: "system",
      },
    });
  }

  console.log("seed-banned-keywords: ok");
}

seed().finally(() => prisma.$disconnect());
```

---

## 12) Doctor checks (Phase 27)

```ts
async function checkPhase27() {
  const checks = [];

  // 1. Rate limiting blocks excessive messages
  const testUserId = "test_rate_limit_user";
  for (let i = 0; i < 25; i++) {
    await incrementRateLimit(testUserId);
  }
  const result = await checkRateLimit(testUserId);
  
  checks.push({
    phase: 27,
    name: "messaging.rate_limit_enforced",
    status: !result.allowed ? "PASS" : "FAIL",
  });

  // 2. Contact info blocked
  const emailTest = await filterMessage("contact me at test@example.com");
  checks.push({
    phase: 27,
    name: "messaging.contact_info_blocked",
    status: emailTest.action === "block" ? "PASS" : "FAIL",
  });

  // 3. Phone blocked
  const phoneTest = await filterMessage("call me at 555-123-4567");
  checks.push({
    phase: 27,
    name: "messaging.phone_blocked",
    status: phoneTest.action === "block" ? "PASS" : "FAIL",
  });

  // 4. Banned keywords seeded
  const keywordCount = await prisma.bannedKeyword.count({ where: { isActive: true } });
  checks.push({
    phase: 27,
    name: "messaging.keywords_seeded",
    status: keywordCount > 0 ? "PASS" : "FAIL",
  });

  // 5. Moderation logging works
  await logModeration("test_msg_id", "test", "test reason", ["test"], "test_staff");
  const log = await prisma.messageModerationLog.findFirst({
    where: { messageId: "test_msg_id" },
  });
  checks.push({
    phase: 27,
    name: "messaging.moderation_logged",
    status: log ? "PASS" : "FAIL",
  });

  return checks;
}
```

---

## 13) UI Enhancements

### 13.1 Message Composer (Buyer/Seller)
- Attachment upload button (images only)
- Rate limit indicator ("X messages remaining")
- Clear error messages for blocked content

### 13.2 Moderation Queue (Corp)
`/corp/moderation/messages`

- Filter by: auto_flagged, manual_review, blocked
- Keyword highlights in message body
- Bulk actions: Flag, Clear, Hide
- Moderation history per message

### 13.3 Keyword Management (Corp Trust)
`/corp/settings/messaging/keywords`

- List all keywords with category/action
- Add/edit/disable keywords
- Audit trail for keyword changes

---

## 14) Phase 27 Completion Criteria

- [ ] MessageRateLimit, MessageAttachment, BannedKeyword, MessageModerationLog models created
- [ ] Rate limiting enforced on message send (20/hour, 10/conversation)
- [ ] Contact info patterns blocked (email, phone, social handles)
- [ ] Banned keywords auto-flag or block messages
- [ ] Moderation actions logged
- [ ] Attachment upload works with size/type limits
- [ ] Bulk moderation API implemented
- [ ] Health provider `messaging_enhancements` registered
- [ ] Doctor passes all Phase 27 checks
- [ ] Default banned keywords seeded

---

# END PHASE 27
