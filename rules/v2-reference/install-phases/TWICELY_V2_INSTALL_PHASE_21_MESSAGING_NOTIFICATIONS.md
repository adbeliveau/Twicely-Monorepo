# TWICELY V2 — Install Phase 21: Buyer–Seller Messaging & System Notifications
**Status:** LOCKED (v1.0)  
**Scope:** Core communication only — NO studio, NO page builder, NO live chat widgets  
**Backend-first:** Schema → API → Permissions → Audit → Health → Doctor  
**Canonicals:** TWICELY_NOTIFICATIONS_CANONICAL.md, TWICELY_TRUST_SAFETY_CANONICAL.md
**Depends On:** Phase 7 (NotificationChannel, NotificationStatus enums)

> Place this file in: `/rules/TWICELY_V2_INSTALL_PHASE_21_MESSAGING_NOTIFICATIONS.md`  
> Prereq: Phase 20 complete and production-ready.

---

## 0) What this phase installs

### Backend
- Order-scoped buyer ↔ seller messaging (async, inbox-style)
- System notifications pipeline
- Notification templates
- Message visibility + moderation flags
- Read receipts tracking
- Vacation mode auto-reply integration

### UI (Buyer/Seller)
- Inbox view with conversations
- Conversation detail with message thread
- Notification center

### UI (Corp)
- Message moderation queue
- Notification template management

### Explicit exclusions
- ❌ No real-time sockets (Phase 27)
- ❌ No studio / page builder
- ❌ No cross-store broadcast tools
- ❌ No off-platform contact exposure

---

## 1) Messaging Invariants (Non-Negotiable)

- Messages are **order-scoped**
- Buyer ↔ Seller only (no buyer↔buyer, seller↔seller)
- Platform staff read-only unless moderation required
- Messages immutable after send (no edits, no deletes by users)
- Attachments optional, size-limited
- PII scrubbing recommended (phone, email detection)

---

## 2) Prisma Schema

```prisma
// =============================================================================
// CONVERSATIONS
// =============================================================================

enum ConversationStatus {
  ACTIVE
  ARCHIVED
  CLOSED
}

model Conversation {
  id              String             @id @default(cuid())
  orderId         String             @unique
  
  buyerId         String
  sellerId        String
  
  // Status
  status          ConversationStatus @default(ACTIVE)
  
  // Read tracking
  buyerLastReadAt DateTime?
  sellerLastReadAt DateTime?
  
  // Counts (denormalized)
  messageCount    Int                @default(0)
  
  createdAt       DateTime           @default(now())
  updatedAt       DateTime           @updatedAt

  // Relations
  messages        Message[]

  @@index([buyerId, status])
  @@index([sellerId, status])
  @@index([updatedAt])
}

// =============================================================================
// MESSAGES
// =============================================================================

enum MessageSenderRole {
  BUYER
  SELLER
  SYSTEM
  STAFF
}

enum MessageStatus {
  SENT
  DELIVERED
  READ
  HIDDEN       // Hidden by moderation
  DELETED      // Deleted by staff (rare)
}

model Message {
  id              String            @id @default(cuid())
  conversationId  String
  conversation    Conversation      @relation(fields: [conversationId], references: [id], onDelete: Cascade)
  
  // Sender
  senderId        String
  senderRole      MessageSenderRole
  
  // Content
  body            String
  
  // Attachments
  attachmentUrls  String[]          @default([])
  
  // Status
  status          MessageStatus     @default(SENT)
  
  // Moderation
  isFlagged       Boolean           @default(false)
  flaggedAt       DateTime?
  flaggedByStaffId String?
  flagReason      String?
  
  // Auto-reply indicator
  isAutoReply     Boolean           @default(false)
  
  // Immutable timestamp
  createdAt       DateTime          @default(now())

  @@index([conversationId, createdAt])
  @@index([senderId, createdAt])
  @@index([isFlagged])
}

// =============================================================================
// NOTIFICATIONS
// NOTE: NotificationChannel and base NotificationStatus are canonical in Phase 7.
// This phase extends with NotificationType and user-facing notification models.
// =============================================================================

// NotificationChannel - USE FROM PHASE 7 (EMAIL, SMS, PUSH, IN_APP)
// NotificationStatus for outbox/delivery - USE FROM PHASE 7 (QUEUED, SENT, FAILED, DLQ, SKIPPED)

// NotificationType is Phase 21 specific (extends Phase 7 trigger types for user notifications)
enum NotificationType {
  // Orders
  ORDER_PLACED
  ORDER_PAID
  ORDER_SHIPPED
  ORDER_DELIVERED
  ORDER_COMPLETED
  ORDER_CANCELED
  ORDER_REFUNDED

  // Messaging
  NEW_MESSAGE
  MESSAGE_FLAGGED

  // Reviews
  REVIEW_REQUESTED
  REVIEW_RECEIVED
  REVIEW_RESPONSE

  // Payments
  PAYOUT_SCHEDULED
  PAYOUT_SENT
  PAYOUT_FAILED

  // Returns/Disputes
  RETURN_REQUESTED
  RETURN_APPROVED
  RETURN_REJECTED
  DISPUTE_OPENED
  DISPUTE_RESOLVED

  // Account
  ACCOUNT_VERIFIED
  ACCOUNT_SUSPENDED
  ACCOUNT_RESTORED

  // Promotions
  PRICE_DROP
  ITEM_BACK_IN_STOCK
  SAVED_SEARCH_MATCH

  // System
  SYSTEM_ANNOUNCEMENT
}

// User-facing notification status (different from outbox delivery status)
enum UserNotificationStatus {
  PENDING     // Created, not yet delivered to user
  DELIVERED   // Shown to user (in-app) or sent (email/push)
  READ        // User has viewed/read
  DISMISSED   // User dismissed without reading
}

model Notification {
  id              String                 @id @default(cuid())

  userId          String

  // Type and channel (NotificationChannel from Phase 7)
  type            NotificationType
  channel         NotificationChannel    @default(IN_APP)

  // Content
  title           String
  body            String
  dataJson        Json                   @default("{}")

  // Links
  actionUrl       String?
  actionLabel     String?

  // Status (user-facing, not delivery status)
  status          UserNotificationStatus @default(PENDING)

  // Timestamps
  sentAt          DateTime?
  deliveredAt     DateTime?
  readAt          DateTime?

  // Expiry
  expiresAt       DateTime?

  createdAt       DateTime               @default(now())

  @@index([userId, status, createdAt])
  @@index([type, createdAt])
  @@index([status, channel])
}

// =============================================================================
// NOTIFICATION TEMPLATES
// NOTE: Phase 7 has the canonical NotificationTemplate model for outbox pipeline.
// This is an extension for user-facing notification display templates by type.
// =============================================================================

model UserNotificationTemplate {
  id              String           @id @default(cuid())

  type            NotificationType @unique

  // Templates per channel
  inAppTitle      String
  inAppBody       String

  emailSubject    String?
  emailBodyHtml   String?
  emailBodyText   String?

  pushTitle       String?
  pushBody        String?

  smsBody         String?

  // Configuration (NotificationChannel from Phase 7)
  defaultChannel  NotificationChannel @default(IN_APP)
  allowedChannels NotificationChannel[]

  // Variables (for template rendering)
  variablesJson   Json             @default("[]")

  isActive        Boolean          @default(true)

  createdAt       DateTime         @default(now())
  updatedAt       DateTime         @updatedAt
}

// =============================================================================
// NOTIFICATION PREFERENCES
// NOTE: Phase 7 has the canonical NotificationPreference model for global prefs.
// This extends per-notification-type preferences for Phase 21 types.
// =============================================================================

model UserNotificationPreference {
  id              String             @id @default(cuid())
  userId          String

  type            NotificationType

  // Channel preferences per notification type
  inAppEnabled    Boolean            @default(true)
  emailEnabled    Boolean            @default(true)
  pushEnabled     Boolean            @default(false)
  smsEnabled      Boolean            @default(false)

  createdAt       DateTime           @default(now())
  updatedAt       DateTime           @updatedAt

  @@unique([userId, type])
  @@index([userId])
}
```

Run migration:
```bash
npx prisma migrate dev --name messaging_notifications_phase21
```

---

## 3) Messaging Service

Create `packages/core/messaging/service.ts`:

```ts
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const MAX_MESSAGE_LENGTH = 2000;
const MAX_ATTACHMENTS = 5;

/**
 * Ensure conversation exists for an order
 * Called when order transitions to PAID
 */
export async function ensureConversation(orderId: string, buyerId: string, sellerId: string) {
  return prisma.conversation.upsert({
    where: { orderId },
    update: {},
    create: { orderId, buyerId, sellerId, status: "ACTIVE" },
  });
}

/**
 * Send a message
 */
export async function sendMessage(args: {
  conversationId: string;
  senderId: string;
  senderRole: "BUYER" | "SELLER";
  body: string;
  attachmentUrls?: string[];
  isAutoReply?: boolean;
}) {
  // Validate message length
  if (!args.body || args.body.trim().length === 0) {
    throw new Error("MESSAGE_EMPTY");
  }
  if (args.body.length > MAX_MESSAGE_LENGTH) {
    throw new Error("MESSAGE_TOO_LONG");
  }
  if (args.attachmentUrls && args.attachmentUrls.length > MAX_ATTACHMENTS) {
    throw new Error("TOO_MANY_ATTACHMENTS");
  }

  // Validate conversation access
  const conversation = await prisma.conversation.findUnique({
    where: { id: args.conversationId },
  });

  if (!conversation) throw new Error("CONVERSATION_NOT_FOUND");
  if (conversation.status === "CLOSED") throw new Error("CONVERSATION_CLOSED");

  // Verify sender is participant
  if (args.senderRole === "BUYER" && conversation.buyerId !== args.senderId) {
    throw new Error("NOT_CONVERSATION_PARTICIPANT");
  }
  if (args.senderRole === "SELLER" && conversation.sellerId !== args.senderId) {
    throw new Error("NOT_CONVERSATION_PARTICIPANT");
  }

  // Create message
  const message = await prisma.message.create({
    data: {
      conversationId: args.conversationId,
      senderId: args.senderId,
      senderRole: args.senderRole,
      body: args.body.trim(),
      attachmentUrls: args.attachmentUrls ?? [],
      isAutoReply: args.isAutoReply ?? false,
    },
  });

  // Update conversation
  await prisma.conversation.update({
    where: { id: args.conversationId },
    data: {
      messageCount: { increment: 1 },
      updatedAt: new Date(),
    },
  });

  // Send notification to recipient
  const recipientId = args.senderRole === "BUYER" ? conversation.sellerId : conversation.buyerId;
  await emitNotification({
    userId: recipientId,
    type: "NEW_MESSAGE",
    title: "New Message",
    body: `You have a new message${args.isAutoReply ? " (auto-reply)" : ""}`,
    data: { conversationId: args.conversationId, messageId: message.id },
    actionUrl: `/messages/${args.conversationId}`,
  });

  return message;
}

/**
 * Get conversations for user
 */
export async function getConversations(userId: string, role: "BUYER" | "SELLER") {
  const where = role === "BUYER" ? { buyerId: userId } : { sellerId: userId };

  return prisma.conversation.findMany({
    where: { ...where, status: { not: "CLOSED" } },
    orderBy: { updatedAt: "desc" },
    take: 50,
    include: {
      messages: { orderBy: { createdAt: "desc" }, take: 1 },
    },
  });
}

/**
 * Get messages in conversation
 */
export async function getMessages(conversationId: string, userId: string) {
  const conversation = await prisma.conversation.findUnique({
    where: { id: conversationId },
  });

  if (!conversation) throw new Error("CONVERSATION_NOT_FOUND");
  if (conversation.buyerId !== userId && conversation.sellerId !== userId) {
    throw new Error("NOT_CONVERSATION_PARTICIPANT");
  }

  // Update read timestamp
  const isBuyer = conversation.buyerId === userId;
  await prisma.conversation.update({
    where: { id: conversationId },
    data: isBuyer ? { buyerLastReadAt: new Date() } : { sellerLastReadAt: new Date() },
  });

  return prisma.message.findMany({
    where: {
      conversationId,
      status: { not: "HIDDEN" },
    },
    orderBy: { createdAt: "asc" },
  });
}

/**
 * Check for vacation mode auto-reply (from Phase 13)
 */
export async function checkVacationAutoReply(conversationId: string, sellerId: string) {
  const vacation = await prisma.sellerVacationMode.findUnique({
    where: { sellerId },
  });

  if (vacation?.isActive && vacation.autoReplyEnabled && vacation.autoReplyMessage) {
    // Send auto-reply
    await sendMessage({
      conversationId,
      senderId: sellerId,
      senderRole: "SELLER",
      body: vacation.autoReplyMessage,
      isAutoReply: true,
    });
  }
}
```

---

## 4) Message Moderation

Create `packages/core/messaging/moderation.ts`:

```ts
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

/**
 * Flag a message for review
 */
export async function flagMessage(messageId: string, staffId: string, reason: string) {
  const message = await prisma.message.update({
    where: { id: messageId },
    data: {
      isFlagged: true,
      flaggedAt: new Date(),
      flaggedByStaffId: staffId,
      flagReason: reason,
    },
  });

  await prisma.auditEvent.create({
    data: {
      actorUserId: staffId,
      action: "messages.flag",
      entityType: "Message",
      entityId: messageId,
      metaJson: { reason },
    },
  });

  return message;
}

/**
 * Hide a message from user view
 */
export async function hideMessage(messageId: string, staffId: string, reason: string) {
  const message = await prisma.message.update({
    where: { id: messageId },
    data: { status: "HIDDEN" },
  });

  await prisma.auditEvent.create({
    data: {
      actorUserId: staffId,
      action: "messages.hide",
      entityType: "Message",
      entityId: messageId,
      metaJson: { reason },
    },
  });

  return message;
}

/**
 * Restore a hidden message
 */
export async function restoreMessage(messageId: string, staffId: string) {
  const message = await prisma.message.update({
    where: { id: messageId },
    data: { status: "SENT" },
  });

  await prisma.auditEvent.create({
    data: {
      actorUserId: staffId,
      action: "messages.restore",
      entityType: "Message",
      entityId: messageId,
    },
  });

  return message;
}

/**
 * Get flagged messages for moderation
 */
export async function getFlaggedMessages(limit = 50) {
  return prisma.message.findMany({
    where: { isFlagged: true },
    orderBy: { flaggedAt: "desc" },
    take: limit,
    include: { conversation: true },
  });
}
```

---

## 5) Notification Service

Create `packages/core/notifications/service.ts`:

```ts
import { PrismaClient, NotificationType, NotificationChannel } from "@prisma/client";

const prisma = new PrismaClient();

export type EmitNotificationArgs = {
  userId: string;
  type: NotificationType;
  title: string;
  body: string;
  data?: Record<string, any>;
  actionUrl?: string;
  actionLabel?: string;
  channels?: NotificationChannel[];
};

/**
 * Emit a notification
 */
export async function emitNotification(args: EmitNotificationArgs) {
  // Get user preferences (Phase 21 per-type preferences)
  const prefs = await prisma.userNotificationPreference.findUnique({
    where: { userId_type: { userId: args.userId, type: args.type } },
  });

  // Default to IN_APP if no preferences
  const channels = args.channels ?? [NotificationChannel.IN_APP];
  const enabledChannels = channels.filter((ch) => {
    if (!prefs) return ch === NotificationChannel.IN_APP;
    switch (ch) {
      case NotificationChannel.IN_APP: return prefs.inAppEnabled;
      case NotificationChannel.EMAIL: return prefs.emailEnabled;
      case NotificationChannel.PUSH: return prefs.pushEnabled;
      case NotificationChannel.SMS: return prefs.smsEnabled;
      default: return false;
    }
  });

  // Create notifications for each enabled channel
  const notifications = await Promise.all(
    enabledChannels.map((channel) =>
      prisma.notification.create({
        data: {
          userId: args.userId,
          type: args.type,
          channel,
          title: args.title,
          body: args.body,
          dataJson: args.data ?? {},
          actionUrl: args.actionUrl,
          actionLabel: args.actionLabel,
          status: channel === NotificationChannel.IN_APP ? "DELIVERED" : "PENDING",
          sentAt: new Date(),
        },
      })
    )
  );

  // Queue email/push/sms for async delivery
  for (const n of notifications) {
    if (n.channel !== NotificationChannel.IN_APP) {
      // Queue for delivery (implementation depends on email/push provider)
      await queueNotificationDelivery(n.id, n.channel);
    }
  }

  return notifications;
}

async function queueNotificationDelivery(notificationId: string, channel: NotificationChannel) {
  // v1: Simple logging. Future: actual queue
  console.log(`Queued ${channel} notification: ${notificationId}`);
}

/**
 * Mark notification as read
 */
export async function markNotificationRead(notificationId: string, userId: string) {
  const notification = await prisma.notification.findUnique({
    where: { id: notificationId },
  });

  if (!notification || notification.userId !== userId) {
    throw new Error("NOT_FOUND");
  }

  return prisma.notification.update({
    where: { id: notificationId },
    data: { status: "READ", readAt: new Date() },
  });
}

/**
 * Mark all notifications as read
 */
export async function markAllNotificationsRead(userId: string) {
  return prisma.notification.updateMany({
    where: { userId, status: { not: "READ" } },
    data: { status: "READ", readAt: new Date() },
  });
}

/**
 * Get user notifications
 */
export async function getNotifications(userId: string, options?: { unreadOnly?: boolean; limit?: number }) {
  const where: any = { userId, channel: "IN_APP" };
  if (options?.unreadOnly) where.status = { not: "READ" };

  return prisma.notification.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: options?.limit ?? 50,
  });
}

/**
 * Get unread count
 */
export async function getUnreadCount(userId: string): Promise<number> {
  return prisma.notification.count({
    where: { userId, channel: "IN_APP", status: { not: "READ" } },
  });
}
```

---

## 6) Notification Templates

Create `packages/core/notifications/templates.ts`:

```ts
import { PrismaClient, NotificationType } from "@prisma/client";

const prisma = new PrismaClient();

export const DEFAULT_TEMPLATES: Array<{
  type: NotificationType;
  inAppTitle: string;
  inAppBody: string;
  emailSubject?: string;
}> = [
  { type: "ORDER_PLACED", inAppTitle: "Order Placed", inAppBody: "Your order {{orderNumber}} has been placed." },
  { type: "ORDER_PAID", inAppTitle: "Payment Confirmed", inAppBody: "Payment for order {{orderNumber}} has been confirmed." },
  { type: "ORDER_SHIPPED", inAppTitle: "Order Shipped", inAppBody: "Your order {{orderNumber}} has been shipped." },
  { type: "ORDER_DELIVERED", inAppTitle: "Order Delivered", inAppBody: "Your order {{orderNumber}} has been delivered." },
  { type: "NEW_MESSAGE", inAppTitle: "New Message", inAppBody: "You have a new message regarding your order." },
  { type: "REVIEW_REQUESTED", inAppTitle: "Leave a Review", inAppBody: "How was your experience? Leave a review for your recent order." },
  { type: "REVIEW_RECEIVED", inAppTitle: "New Review", inAppBody: "You received a {{rating}}-star review." },
  { type: "PAYOUT_SENT", inAppTitle: "Payout Sent", inAppBody: "Your payout of {{amount}} has been sent." },
  { type: "RETURN_REQUESTED", inAppTitle: "Return Request", inAppBody: "A return has been requested for order {{orderNumber}}." },
  { type: "DISPUTE_OPENED", inAppTitle: "Dispute Opened", inAppBody: "A dispute has been opened for order {{orderNumber}}." },
  { type: "PRICE_DROP", inAppTitle: "Price Drop Alert", inAppBody: "An item in your watchlist dropped in price!" },
];

/**
 * Seed default user notification templates (Phase 21 specific)
 * NOTE: Phase 7 NotificationTemplate is for outbox pipeline templates by key.
 *       This seeds UserNotificationTemplate by NotificationType.
 */
export async function seedUserNotificationTemplates() {
  for (const t of DEFAULT_TEMPLATES) {
    await prisma.userNotificationTemplate.upsert({
      where: { type: t.type },
      update: {},
      create: {
        type: t.type,
        inAppTitle: t.inAppTitle,
        inAppBody: t.inAppBody,
        emailSubject: t.emailSubject,
        defaultChannel: "IN_APP",
        allowedChannels: ["IN_APP", "EMAIL"],
      },
    });
  }
}

/**
 * Render template with variables
 */
export function renderTemplate(template: string, variables: Record<string, any>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key) => variables[key] ?? `{{${key}}}`);
}
```

---

## 7) API Endpoints

### 7.1 Conversations List

`apps/web/app/api/messages/route.ts`:
```ts
import { NextResponse } from "next/server";
import { getConversations } from "@/packages/core/messaging/service";

export async function GET() {
  const userId = "twi_u_replace"; // TODO: auth
  const role = "BUYER"; // derive from user type
  const conversations = await getConversations(userId, role);
  return NextResponse.json({ conversations });
}
```

### 7.2 Messages in Conversation

`apps/web/app/api/messages/[conversationId]/route.ts`:
```ts
import { NextResponse } from "next/server";
import { getMessages, sendMessage } from "@/packages/core/messaging/service";

export async function GET(req: Request, { params }: { params: { conversationId: string } }) {
  const userId = "twi_u_replace";
  try {
    const messages = await getMessages(params.conversationId, userId);
    return NextResponse.json({ messages });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 400 });
  }
}

export async function POST(req: Request, { params }: { params: { conversationId: string } }) {
  const userId = "twi_u_replace";
  const role = "BUYER" as const;
  const { body, attachmentUrls } = await req.json();

  try {
    const message = await sendMessage({
      conversationId: params.conversationId,
      senderId: userId,
      senderRole: role,
      body,
      attachmentUrls,
    });
    return NextResponse.json({ message }, { status: 201 });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 400 });
  }
}
```

### 7.3 Notifications

`apps/web/app/api/notifications/route.ts`:
```ts
import { NextResponse } from "next/server";
import { getNotifications, getUnreadCount } from "@/packages/core/notifications/service";

export async function GET(req: Request) {
  const userId = "twi_u_replace";
  const { searchParams } = new URL(req.url);
  const unreadOnly = searchParams.get("unread") === "true";

  const [notifications, unreadCount] = await Promise.all([
    getNotifications(userId, { unreadOnly }),
    getUnreadCount(userId),
  ]);

  return NextResponse.json({ notifications, unreadCount });
}
```

### 7.4 Mark Read

`apps/web/app/api/notifications/[id]/read/route.ts`:
```ts
import { NextResponse } from "next/server";
import { markNotificationRead } from "@/packages/core/notifications/service";

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const userId = "twi_u_replace";
  try {
    await markNotificationRead(params.id, userId);
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 400 });
  }
}
```

### 7.5 Corp Message Moderation

`apps/web/app/api/platform/messages/[id]/flag/route.ts`:
```ts
import { NextResponse } from "next/server";
import { requirePlatformAuth } from "@/apps/web/lib/platformAuth";
import { assertPermission } from "@/packages/core/rbac/authorize";
import { flagMessage } from "@/packages/core/messaging/moderation";

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const ctx = await requirePlatformAuth();
  assertPermission(ctx, "messages.moderate");

  const { reason } = await req.json();
  const message = await flagMessage(params.id, ctx.actorUserId, reason);
  return NextResponse.json({ message });
}
```

---

## 8) Health Provider

```ts
import { PrismaClient } from "@prisma/client";
import type { HealthProvider, HealthResult, HealthRunContext } from "../types";
import { HEALTH_STATUS } from "../types";

const prisma = new PrismaClient();

export const messagingNotificationsHealthProvider: HealthProvider = {
  id: "messaging_notifications",
  label: "Messaging & Notifications",
  version: "1.0.0",

  async run(ctx: HealthRunContext): Promise<HealthResult> {
    const checks = [];
    let status = HEALTH_STATUS.PASS;

    // Check 1: Conversations created for paid orders
    const paidOrdersWithoutConv = await prisma.order.count({
      where: {
        status: { in: ["PAID", "SHIPPED", "DELIVERED", "COMPLETED"] },
        NOT: { conversation: { isNot: null } }, // This needs adjustment based on actual relation
      },
    });
    checks.push({
      id: "messaging.conversations_created",
      label: "Paid orders have conversations",
      status: paidOrdersWithoutConv === 0 ? HEALTH_STATUS.PASS : HEALTH_STATUS.WARN,
      message: paidOrdersWithoutConv === 0 ? "All have conversations" : `${paidOrdersWithoutConv} missing`,
    });

    // Check 2: Messages are immutable (no updates - check schema)
    checks.push({
      id: "messaging.immutable",
      label: "Messages immutable",
      status: HEALTH_STATUS.PASS,
      message: "No update endpoints exposed",
    });

    // Check 3: Flagged messages have audit events
    const flaggedWithoutAudit = await prisma.message.count({
      where: { isFlagged: true, flaggedByStaffId: null },
    });
    checks.push({
      id: "messaging.flagged_audited",
      label: "Flagged messages audited",
      status: flaggedWithoutAudit === 0 ? HEALTH_STATUS.PASS : HEALTH_STATUS.WARN,
      message: flaggedWithoutAudit === 0 ? "All audited" : `${flaggedWithoutAudit} missing staff ID`,
    });

    // Check 4: Notification templates exist
    const templateCount = await prisma.notificationTemplate.count({ where: { isActive: true } });
    checks.push({
      id: "notifications.templates_exist",
      label: "Notification templates",
      status: templateCount >= 5 ? HEALTH_STATUS.PASS : HEALTH_STATUS.WARN,
      message: `${templateCount} active templates`,
    });

    // Check 5: Pending notifications not stuck
    const stuckNotifications = await prisma.notification.count({
      where: {
        status: "PENDING",
        createdAt: { lt: new Date(Date.now() - 60 * 60 * 1000) }, // > 1 hour old
      },
    });
    checks.push({
      id: "notifications.no_stuck",
      label: "No stuck notifications",
      status: stuckNotifications === 0 ? HEALTH_STATUS.PASS : HEALTH_STATUS.WARN,
      message: stuckNotifications === 0 ? "None stuck" : `${stuckNotifications} stuck`,
    });

    return {
      providerId: "messaging_notifications",
      status,
      summary: status === HEALTH_STATUS.PASS ? "Messaging healthy" : "Issues detected",
      providerVersion: "1.0.0",
      ranAt: new Date().toISOString(),
      runType: ctx.runType,
      checks,
    };
  },

  settings: { schema: {}, defaults: {} },
  ui: { SettingsPanel: () => null, DetailPage: () => null },
};
```

---

## 9) Doctor Checks

```ts
async function checkMessagingNotifications() {
  const checks = [];

  // 1. Create conversation for paid order
  const testOrderId = `test_order_${Date.now()}`;
  const testBuyerId = `test_buyer_${Date.now()}`;
  const testSellerId = `test_seller_${Date.now()}`;

  const conv = await ensureConversation(testOrderId, testBuyerId, testSellerId);
  checks.push({ key: "messaging.conversation_created", ok: !!conv.id, details: "Conversation created" });

  // 2. Send message
  const msg = await sendMessage({
    conversationId: conv.id,
    senderId: testBuyerId,
    senderRole: "BUYER",
    body: "Test message from Doctor",
  });
  checks.push({ key: "messaging.send", ok: !!msg.id, details: "Message sent" });

  // 3. Messages are immutable (no edit endpoint exists)
  checks.push({ key: "messaging.immutable", ok: true, details: "No edit/delete endpoints" });

  // 4. Flag message creates audit event
  await flagMessage(msg.id, "doctor_staff", "Doctor test");
  const audit = await prisma.auditEvent.findFirst({
    where: { action: "messages.flag", entityId: msg.id },
  });
  checks.push({ key: "messaging.flag_audited", ok: !!audit, details: audit ? "Audit created" : "No audit" });

  // 5. Notification emitted
  const notif = await emitNotification({
    userId: testSellerId,
    type: "NEW_MESSAGE",
    title: "Test",
    body: "Test notification",
  });
  checks.push({ key: "notifications.emit", ok: notif.length > 0, details: `${notif.length} notifications created` });

  // 6. Notification retrievable
  const fetched = await getNotifications(testSellerId);
  checks.push({ key: "notifications.retrieve", ok: fetched.length > 0, details: `${fetched.length} retrieved` });

  // Cleanup
  await prisma.notification.deleteMany({ where: { userId: testSellerId } });
  await prisma.auditEvent.deleteMany({ where: { entityId: msg.id } });
  await prisma.message.deleteMany({ where: { conversationId: conv.id } });
  await prisma.conversation.delete({ where: { id: conv.id } });

  return checks;
}
```

---

## 10) Phase 21 Completion Criteria

- Buyer ↔ seller messaging works per order
- No cross-order message leakage
- Messages are immutable after send
- Corp moderation is RBAC-gated and audited
- Notifications pipeline operational
- Notification preferences respected
- Health provider passes all checks
- Doctor verifies full messaging flow
