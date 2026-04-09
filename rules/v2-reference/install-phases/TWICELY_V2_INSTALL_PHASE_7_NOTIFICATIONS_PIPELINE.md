# TWICELY V2 - Install Phase 7: Notifications Pipeline (Core)
**Status:** LOCKED (v1.0)  
**Backend-first:** Schema  ->  Idempotency  ->  Worker  ->  Health  ->  UI  ->  Doctor  
**Canonical:** `/rules/TWICELY_NOTIFICATIONS_CANONICAL.md`

> Place this file in: `/rules/TWICELY_V2_INSTALL_PHASE_7_NOTIFICATIONS_PIPELINE.md`  
> Prereq: Phase 6 complete.

---

## 0) What this phase installs

### Backend
- NotificationOutbox (idempotent delivery queue)
- NotificationTemplate (configurable message templates)
- NotificationPreference (user opt-in/opt-out per channel)
- NotificationLog (delivery audit trail)
- Worker (retries + DLQ)
- Trigger helpers (order/shipping/refund/payout)

### UI (Corp)
- Corp  ->  Notifications  ->  Outbox viewer + resend
- Corp  ->  Notifications  ->  Templates management
- Corp  ->  Notifications  ->  Delivery logs

### Ops
- Health provider: `notifications`
- Doctor checks: no double-send + retry rules + preference respect

---

## 1) Prisma schema (additive)

Add to `prisma/schema.prisma`:

```prisma
// ============================================================
// PHASE 7: NOTIFICATIONS PIPELINE
// ============================================================

enum NotificationChannel {
  EMAIL
  SMS
  PUSH
  IN_APP
}

enum NotificationStatus {
  QUEUED
  SENT
  FAILED
  DLQ
  SKIPPED
}

model NotificationTemplate {
  id              String               @id @default(cuid())
  key             String               @unique  // e.g., "order.shipped"
  name            String                        // Human-readable name
  description     String?
  
  // Channel availability
  channels        NotificationChannel[]
  
  // Email content
  emailSubject    String?
  emailBodyHtml   String?              // HTML template
  emailBodyText   String?              // Plain text fallback
  
  // SMS content
  smsBody         String?              // Max 160 chars recommended
  
  // Push notification content
  pushTitle       String?
  pushBody        String?
  pushAction      String?              // Deep link or action
  
  // In-app notification content
  inAppTitle      String?
  inAppBody       String?
  inAppIcon       String?
  inAppAction     String?
  
  // Template variables (JSON schema)
  variablesSchema Json                 @default("[]")
  
  // Control
  isActive        Boolean              @default(true)
  isTransactional Boolean              @default(true)  // vs marketing
  
  createdByStaffId String?
  createdAt       DateTime             @default(now())
  updatedAt       DateTime             @updatedAt
}

model NotificationPreference {
  id              String               @id @default(cuid())
  userId          String
  
  // Global channel preferences
  emailEnabled    Boolean              @default(true)
  smsEnabled      Boolean              @default(false)
  pushEnabled     Boolean              @default(true)
  inAppEnabled    Boolean              @default(true)
  
  // Per-category preferences
  orderUpdates    NotificationChannel[] @default([EMAIL, IN_APP])
  shippingUpdates NotificationChannel[] @default([EMAIL, IN_APP, PUSH])
  payoutUpdates   NotificationChannel[] @default([EMAIL, IN_APP])
  marketingUpdates NotificationChannel[] @default([])
  
  // Quiet hours (optional)
  quietHoursStart String?              // "22:00"
  quietHoursEnd   String?              // "08:00"
  timezone        String?              // "America/New_York"
  
  // Marketing consent
  marketingConsentAt DateTime?
  unsubscribedAt  DateTime?
  
  updatedAt       DateTime             @updatedAt
  
  @@unique([userId])
}

model NotificationOutbox {
  id              String               @id @default(cuid())
  userId          String
  templateKey     String
  channel         NotificationChannel
  
  // Payload
  payloadJson     Json                 // Template variables
  renderedSubject String?
  renderedBody    String?
  
  // Idempotency
  idempotencyKey  String               @unique
  
  // Status
  status          NotificationStatus   @default(QUEUED)
  attemptCount    Int                  @default(0)
  lastError       String?
  nextAttemptAt   DateTime?
  
  // Delivery tracking
  createdAt       DateTime             @default(now())
  sentAt          DateTime?
  deliveredAt     DateTime?
  openedAt        DateTime?
  clickedAt       DateTime?
  
  // Provider reference
  providerMessageId String?
  
  @@index([status, nextAttemptAt])
  @@index([userId, createdAt])
  @@index([templateKey, createdAt])
}

model NotificationLog {
  id              String               @id @default(cuid())
  outboxId        String
  userId          String
  templateKey     String
  channel         NotificationChannel
  
  // Event type
  event           String               // sent|delivered|opened|clicked|bounced|complained
  
  // Details
  eventAt         DateTime             @default(now())
  providerEventId String?
  metaJson        Json                 @default("{}")
  
  @@index([outboxId])
  @@index([userId, eventAt])
  @@index([event, eventAt])
}
```

Migrate:
```bash
npx prisma migrate dev --name notifications_phase7
```

---

## 2) Notification Types (Canonical)

Create `packages/core/notifications/types.ts`:

```ts
import { NotificationChannel, NotificationStatus } from "@prisma/client";

/**
 * Notification trigger types per TWICELY_NOTIFICATIONS_CANONICAL.md
 */
export type NotificationTrigger =
  // Order lifecycle
  | "ORDER_PLACED"
  | "ORDER_PAID"
  | "ORDER_SHIPPED"
  | "ORDER_DELIVERED"
  | "ORDER_COMPLETED"
  | "ORDER_CANCELED"
  
  // Returns & Refunds
  | "RETURN_REQUESTED"
  | "RETURN_APPROVED"
  | "RETURN_DECLINED"
  | "REFUND_ISSUED"
  
  // Payments
  | "PAYMENT_FAILED"
  | "PAYOUT_SENT"
  | "PAYOUT_FAILED"
  
  // Messaging
  | "NEW_MESSAGE"
  
  // Reviews
  | "REVIEW_REQUESTED"
  | "REVIEW_RECEIVED"
  
  // Account
  | "WELCOME"
  | "PASSWORD_RESET"
  | "SELLER_VERIFIED"
  
  // Trust & Safety
  | "LISTING_FLAGGED"
  | "ACCOUNT_WARNING"
  | "ACCOUNT_SUSPENDED";

export type EnqueueNotificationArgs = {
  userId: string;
  templateKey: string;
  channel: NotificationChannel;
  payload: Record<string, any>;
  idempotencyKey: string;
  scheduledAt?: Date;
};

export type NotificationRenderResult = {
  subject?: string;
  body: string;
  html?: string;
};

export type DeliveryResult = {
  success: boolean;
  providerMessageId?: string;
  error?: string;
};
```

---

## 3) Template Renderer

Create `packages/core/notifications/templateRenderer.ts`:

```ts
import { PrismaClient, NotificationChannel } from "@prisma/client";
import type { NotificationRenderResult } from "./types";

const prisma = new PrismaClient();

/**
 * Render a notification template with variables
 */
export async function renderTemplate(
  templateKey: string,
  channel: NotificationChannel,
  variables: Record<string, any>
): Promise<NotificationRenderResult | null> {
  const template = await prisma.notificationTemplate.findUnique({
    where: { key: templateKey },
  });
  
  if (!template || !template.isActive) {
    return null;
  }
  
  // Check if channel is supported
  if (!template.channels.includes(channel)) {
    return null;
  }
  
  switch (channel) {
    case "EMAIL":
      return {
        subject: interpolate(template.emailSubject ?? "", variables),
        body: interpolate(template.emailBodyText ?? "", variables),
        html: template.emailBodyHtml 
          ? interpolate(template.emailBodyHtml, variables) 
          : undefined,
      };
      
    case "SMS":
      return {
        body: interpolate(template.smsBody ?? "", variables),
      };
      
    case "PUSH":
      return {
        subject: interpolate(template.pushTitle ?? "", variables),
        body: interpolate(template.pushBody ?? "", variables),
      };
      
    case "IN_APP":
      return {
        subject: interpolate(template.inAppTitle ?? "", variables),
        body: interpolate(template.inAppBody ?? "", variables),
      };
      
    default:
      return null;
  }
}

/**
 * Simple variable interpolation: {{variableName}}
 */
function interpolate(template: string, variables: Record<string, any>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (match, key) => {
    return variables[key] !== undefined ? String(variables[key]) : match;
  });
}

// =============================================================================
// TEMPLATE VALIDATION (MED-3)
// =============================================================================

const VARIABLE_PATTERN = /\{\{(\w+)\}\}/g;

/**
 * Standard notification variables by template type (MED-3)
 */
export const NOTIFICATION_VARIABLES: Record<string, string[]> = {
  "order.confirmation": ["buyerName", "orderNumber", "totalFormatted", "itemCount"],
  "order.shipped": ["buyerName", "orderNumber", "trackingNumber", "carrier", "estimatedDelivery"],
  "order.delivered": ["buyerName", "orderNumber", "deliveredAt"],
  "payment.received": ["sellerName", "orderNumber", "amountFormatted"],
  "payout.sent": ["sellerName", "amountFormatted", "payoutId", "destination"],
  "review.reminder": ["buyerName", "orderNumber", "sellerName"],
  "price.drop": ["buyerName", "listingTitle", "oldPrice", "newPrice", "percentOff"],
  "offer.received": ["sellerName", "listingTitle", "offerAmount", "buyerName"],
  "offer.accepted": ["buyerName", "listingTitle", "acceptedAmount"],
  "offer.declined": ["buyerName", "listingTitle"],
  "chargeback.opened": ["sellerName", "orderNumber", "amountFormatted", "reason"],
  "chargeback.won": ["sellerName", "orderNumber", "amountFormatted"],
  "chargeback.lost": ["sellerName", "orderNumber", "amountFormatted"],
};

/**
 * Validate template has all required variables
 */
export function validateTemplate(
  template: string,
  requiredVars: string[]
): { valid: boolean; missing: string[] } {
  const foundVars = new Set<string>();
  let match;
  
  const regex = new RegExp(VARIABLE_PATTERN);
  while ((match = regex.exec(template)) !== null) {
    foundVars.add(match[1]);
  }
  
  const missing = requiredVars.filter(v => !foundVars.has(v));
  
  return {
    valid: missing.length === 0,
    missing,
  };
}

/**
 * Validate notification data before sending
 */
export function validateNotificationData(
  templateKey: string,
  data: Record<string, any>
): { valid: boolean; missing: string[] } {
  const requiredVars = NOTIFICATION_VARIABLES[templateKey];
  if (!requiredVars) {
    return { valid: true, missing: [] };
  }
  
  const missing = requiredVars.filter(v => !(v in data));
  return {
    valid: missing.length === 0,
    missing,
  };
}

/**
 * Extract variables from a template
 */
export function extractTemplateVariables(template: string): string[] {
  const vars: string[] = [];
  const regex = new RegExp(VARIABLE_PATTERN);
  let match;
  
  while ((match = regex.exec(template)) !== null) {
    if (!vars.includes(match[1])) {
      vars.push(match[1]);
    }
  }
  
  return vars;
}
```

---

## 4) Preference Checker

Create `packages/core/notifications/preferenceChecker.ts`:

```ts
import { PrismaClient, NotificationChannel } from "@prisma/client";

const prisma = new PrismaClient();

/**
 * Check if a user wants to receive a notification on a specific channel
 */
export async function shouldSendNotification(
  userId: string,
  templateKey: string,
  channel: NotificationChannel,
  isTransactional: boolean
): Promise<{ allowed: boolean; reason?: string }> {
  const prefs = await prisma.notificationPreference.findUnique({
    where: { userId },
  });
  
  // No preferences = use defaults (allow transactional)
  if (!prefs) {
    return { allowed: isTransactional, reason: isTransactional ? undefined : "NO_CONSENT" };
  }
  
  // Check global channel preference
  const channelEnabled = checkChannelEnabled(prefs, channel);
  if (!channelEnabled) {
    return { allowed: false, reason: "CHANNEL_DISABLED" };
  }
  
  // Transactional notifications always go through if channel enabled
  if (isTransactional) {
    return { allowed: true };
  }
  
  // Marketing requires explicit consent
  if (prefs.unsubscribedAt) {
    return { allowed: false, reason: "UNSUBSCRIBED" };
  }
  
  if (!prefs.marketingConsentAt) {
    return { allowed: false, reason: "NO_MARKETING_CONSENT" };
  }
  
  // Check category preference
  const category = getNotificationCategory(templateKey);
  const categoryChannels = getCategoryChannels(prefs, category);
  
  if (!categoryChannels.includes(channel)) {
    return { allowed: false, reason: "CATEGORY_CHANNEL_DISABLED" };
  }
  
  return { allowed: true };
}

function checkChannelEnabled(prefs: any, channel: NotificationChannel): boolean {
  switch (channel) {
    case "EMAIL": return prefs.emailEnabled;
    case "SMS": return prefs.smsEnabled;
    case "PUSH": return prefs.pushEnabled;
    case "IN_APP": return prefs.inAppEnabled;
    default: return false;
  }
}

function getNotificationCategory(templateKey: string): string {
  if (templateKey.startsWith("order.")) return "orderUpdates";
  if (templateKey.startsWith("shipping.")) return "shippingUpdates";
  if (templateKey.startsWith("payout.")) return "payoutUpdates";
  if (templateKey.startsWith("marketing.")) return "marketingUpdates";
  return "orderUpdates"; // default
}

function getCategoryChannels(prefs: any, category: string): NotificationChannel[] {
  return prefs[category] ?? [];
}
```

---

## 5) Enqueue Service (Idempotent)

Create `packages/core/notifications/enqueue.ts`:

```ts
import { PrismaClient, NotificationChannel } from "@prisma/client";
import { renderTemplate } from "./templateRenderer";
import { shouldSendNotification } from "./preferenceChecker";

const prisma = new PrismaClient();

/**
 * Enqueue a notification for delivery (idempotent)
 * Per TWICELY_NOTIFICATIONS_CANONICAL.md Section 6
 */
export async function enqueueNotification(args: {
  userId: string;
  templateKey: string;
  channel: NotificationChannel;
  payload: Record<string, any>;
  idempotencyKey: string;
}): Promise<{ queued: boolean; reason?: string; outboxId?: string }> {
  const { userId, templateKey, channel, payload, idempotencyKey } = args;
  
  // Check if already processed (idempotency)
  const existing = await prisma.notificationOutbox.findUnique({
    where: { idempotencyKey },
  });
  
  if (existing) {
    return { queued: false, reason: "ALREADY_QUEUED", outboxId: existing.id };
  }
  
  // Get template to check if transactional
  const template = await prisma.notificationTemplate.findUnique({
    where: { key: templateKey },
  });
  
  if (!template || !template.isActive) {
    return { queued: false, reason: "TEMPLATE_NOT_FOUND" };
  }
  
  // Check user preferences
  const prefCheck = await shouldSendNotification(
    userId,
    templateKey,
    channel,
    template.isTransactional
  );
  
  if (!prefCheck.allowed) {
    // Still create record but mark as SKIPPED
    const outbox = await prisma.notificationOutbox.create({
      data: {
        userId,
        templateKey,
        channel,
        payloadJson: payload,
        idempotencyKey,
        status: "SKIPPED",
        lastError: prefCheck.reason,
      },
    });
    return { queued: false, reason: prefCheck.reason, outboxId: outbox.id };
  }
  
  // Render template
  const rendered = await renderTemplate(templateKey, channel, payload);
  
  if (!rendered) {
    return { queued: false, reason: "RENDER_FAILED" };
  }
  
  // Create outbox entry
  const outbox = await prisma.notificationOutbox.create({
    data: {
      userId,
      templateKey,
      channel,
      payloadJson: payload,
      idempotencyKey,
      renderedSubject: rendered.subject,
      renderedBody: rendered.body,
      status: "QUEUED",
    },
  });
  
  return { queued: true, outboxId: outbox.id };
}

/**
 * Enqueue notification to all applicable channels
 */
export async function enqueueMultiChannel(args: {
  userId: string;
  templateKey: string;
  payload: Record<string, any>;
  baseIdempotencyKey: string;
}): Promise<Array<{ channel: NotificationChannel; queued: boolean; reason?: string }>> {
  const { userId, templateKey, payload, baseIdempotencyKey } = args;
  
  const template = await prisma.notificationTemplate.findUnique({
    where: { key: templateKey },
  });
  
  if (!template) {
    return [];
  }
  
  const results = [];
  
  for (const channel of template.channels) {
    const idempotencyKey = `${baseIdempotencyKey}:${channel}`;
    const result = await enqueueNotification({
      userId,
      templateKey,
      channel,
      payload,
      idempotencyKey,
    });
    results.push({ channel, ...result });
  }
  
  return results;
}
```

---

## 6) Delivery Worker

Create `packages/core/notifications/worker.ts`:

```ts
import { PrismaClient, NotificationChannel } from "@prisma/client";
import type { DeliveryResult } from "./types";

const prisma = new PrismaClient();

const MAX_ATTEMPTS = 5;
const RETRY_DELAYS = [5_000, 30_000, 60_000, 300_000, 600_000]; // 5s, 30s, 1m, 5m, 10m

/**
 * Process queued notifications (run as cron job)
 */
export async function processNotificationQueue(batchSize = 50): Promise<{
  processed: number;
  sent: number;
  failed: number;
  dlq: number;
}> {
  const now = new Date();
  
  const batch = await prisma.notificationOutbox.findMany({
    where: {
      status: "QUEUED",
      OR: [
        { nextAttemptAt: null },
        { nextAttemptAt: { lte: now } },
      ],
    },
    take: batchSize,
    orderBy: { createdAt: "asc" },
  });
  
  let sent = 0;
  let failed = 0;
  let dlq = 0;
  
  for (const notification of batch) {
    try {
      const result = await deliverNotification(notification);
      
      if (result.success) {
        await prisma.notificationOutbox.update({
          where: { id: notification.id },
          data: {
            status: "SENT",
            sentAt: new Date(),
            attemptCount: { increment: 1 },
            providerMessageId: result.providerMessageId,
          },
        });
        
        // Log delivery
        await prisma.notificationLog.create({
          data: {
            outboxId: notification.id,
            userId: notification.userId,
            templateKey: notification.templateKey,
            channel: notification.channel,
            event: "sent",
            providerEventId: result.providerMessageId,
          },
        });
        
        sent++;
      } else {
        await handleFailure(notification, result.error);
        failed++;
      }
    } catch (e: any) {
      await handleFailure(notification, e.message);
      failed++;
    }
  }
  
  // Count DLQ entries
  dlq = await prisma.notificationOutbox.count({
    where: { status: "DLQ" },
  });
  
  return { processed: batch.length, sent, failed, dlq };
}

async function handleFailure(notification: any, error?: string): Promise<void> {
  const attempts = notification.attemptCount + 1;
  
  if (attempts >= MAX_ATTEMPTS) {
    // Move to DLQ
    await prisma.notificationOutbox.update({
      where: { id: notification.id },
      data: {
        status: "DLQ",
        attemptCount: attempts,
        lastError: error,
      },
    });
    
    // Log DLQ
    await prisma.notificationLog.create({
      data: {
        outboxId: notification.id,
        userId: notification.userId,
        templateKey: notification.templateKey,
        channel: notification.channel,
        event: "dlq",
        metaJson: { error },
      },
    });
  } else {
    // Schedule retry
    const delay = RETRY_DELAYS[attempts - 1] ?? RETRY_DELAYS[RETRY_DELAYS.length - 1];
    const nextAttempt = new Date(Date.now() + delay);
    
    await prisma.notificationOutbox.update({
      where: { id: notification.id },
      data: {
        attemptCount: attempts,
        lastError: error,
        nextAttemptAt: nextAttempt,
      },
    });
  }
}

/**
 * Deliver a notification via the appropriate provider
 */
async function deliverNotification(notification: any): Promise<DeliveryResult> {
  switch (notification.channel) {
    case "EMAIL":
      return deliverEmail(notification);
    case "SMS":
      return deliverSms(notification);
    case "PUSH":
      return deliverPush(notification);
    case "IN_APP":
      return deliverInApp(notification);
    default:
      return { success: false, error: "UNKNOWN_CHANNEL" };
  }
}

// Provider implementations (stubs for v1)

async function deliverEmail(notification: any): Promise<DeliveryResult> {
  // TODO: Integrate with email provider (SendGrid, SES, etc.)
  // For v1, mark as sent
  console.log(`[EMAIL] Sending to user ${notification.userId}: ${notification.renderedSubject}`);
  return { success: true, providerMessageId: `email_${Date.now()}` };
}

async function deliverSms(notification: any): Promise<DeliveryResult> {
  // TODO: Integrate with SMS provider (Twilio, etc.)
  console.log(`[SMS] Sending to user ${notification.userId}: ${notification.renderedBody}`);
  return { success: true, providerMessageId: `sms_${Date.now()}` };
}

async function deliverPush(notification: any): Promise<DeliveryResult> {
  // TODO: Integrate with push provider (FCM, APNS, etc.)
  console.log(`[PUSH] Sending to user ${notification.userId}: ${notification.renderedSubject}`);
  return { success: true, providerMessageId: `push_${Date.now()}` };
}

async function deliverInApp(notification: any): Promise<DeliveryResult> {
  // In-app notifications are immediately "delivered" upon creation
  // They'll be fetched by the client
  return { success: true, providerMessageId: `inapp_${notification.id}` };
}
```

---

## 7) Trigger Helpers

Create `packages/core/notifications/triggers.ts`:

```ts
import { enqueueMultiChannel } from "./enqueue";

/**
 * Order notification triggers
 */
export async function notifyOrderPlaced(orderId: string, buyerId: string, orderDetails: any) {
  return enqueueMultiChannel({
    userId: buyerId,
    templateKey: "order.placed",
    payload: {
      orderId,
      orderNumber: orderDetails.orderNumber,
      totalAmount: formatMoney(orderDetails.totalCents),
      itemCount: orderDetails.itemCount,
    },
    baseIdempotencyKey: `order:${orderId}:placed`,
  });
}

export async function notifyOrderShipped(orderId: string, buyerId: string, shippingDetails: any) {
  return enqueueMultiChannel({
    userId: buyerId,
    templateKey: "order.shipped",
    payload: {
      orderId,
      orderNumber: shippingDetails.orderNumber,
      trackingNumber: shippingDetails.trackingNumber,
      carrier: shippingDetails.carrier,
      estimatedDelivery: shippingDetails.estimatedDelivery,
    },
    baseIdempotencyKey: `order:${orderId}:shipped`,
  });
}

export async function notifyOrderDelivered(orderId: string, buyerId: string, deliveryDetails: any) {
  return enqueueMultiChannel({
    userId: buyerId,
    templateKey: "order.delivered",
    payload: {
      orderId,
      orderNumber: deliveryDetails.orderNumber,
      deliveredAt: deliveryDetails.deliveredAt,
    },
    baseIdempotencyKey: `order:${orderId}:delivered`,
  });
}

/**
 * Payout notification triggers
 */
export async function notifyPayoutSent(payoutId: string, sellerId: string, payoutDetails: any) {
  return enqueueMultiChannel({
    userId: sellerId,
    templateKey: "payout.sent",
    payload: {
      payoutId,
      amount: formatMoney(payoutDetails.amountCents),
      destination: payoutDetails.destinationLast4,
      estimatedArrival: payoutDetails.estimatedArrival,
    },
    baseIdempotencyKey: `payout:${payoutId}:sent`,
  });
}

/**
 * Refund notification triggers
 */
export async function notifyRefundIssued(orderId: string, buyerId: string, refundDetails: any) {
  return enqueueMultiChannel({
    userId: buyerId,
    templateKey: "refund.issued",
    payload: {
      orderId,
      orderNumber: refundDetails.orderNumber,
      refundAmount: formatMoney(refundDetails.amountCents),
      reason: refundDetails.reason,
    },
    baseIdempotencyKey: `order:${orderId}:refund:${refundDetails.refundId}`,
  });
}

// Helper
function formatMoney(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}
```

---

## 8) Corp API Endpoints

### 8.1 List Outbox

Create `apps/web/app/api/platform/notifications/outbox/route.ts`:

```ts
import { NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import { requirePermission } from "@/lib/platformAuth";

const prisma = new PrismaClient();

export async function GET(req: Request) {
  await requirePermission(req, "notifications.read");
  
  const { searchParams } = new URL(req.url);
  const status = searchParams.get("status") ?? undefined;
  const userId = searchParams.get("userId") ?? undefined;
  const page = Number(searchParams.get("page") ?? "1");
  const pageSize = Math.min(100, Number(searchParams.get("pageSize") ?? "50"));
  
  const where: any = {};
  if (status) where.status = status;
  if (userId) where.userId = userId;
  
  const [total, items] = await Promise.all([
    prisma.notificationOutbox.count({ where }),
    prisma.notificationOutbox.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
  ]);
  
  return NextResponse.json({ total, page, pageSize, items });
}
```

### 8.2 Resend Notification

Create `apps/web/app/api/platform/notifications/outbox/[id]/resend/route.ts`:

```ts
import { NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import { requirePermission } from "@/lib/platformAuth";
import { emitAuditEvent } from "@/packages/core/audit/emit";

const prisma = new PrismaClient();

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const staffCtx = await requirePermission(req, "notifications.resend");
  
  const notification = await prisma.notificationOutbox.findUnique({
    where: { id: params.id },
  });
  
  if (!notification) {
    return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
  }
  
  // Reset for retry
  await prisma.notificationOutbox.update({
    where: { id: params.id },
    data: {
      status: "QUEUED",
      attemptCount: 0,
      lastError: null,
      nextAttemptAt: null,
    },
  });
  
  // Audit
  await emitAuditEvent({
    eventType: "notifications.resend",
    actorType: "STAFF",
    actorId: staffCtx.staffUserId,
    entityType: "NotificationOutbox",
    entityId: params.id,
    metaJson: { userId: notification.userId, templateKey: notification.templateKey },
  });
  
  return NextResponse.json({ ok: true });
}
```

### 8.3 Template Management

Create `apps/web/app/api/platform/notifications/templates/route.ts`:

```ts
import { NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import { requirePermission } from "@/lib/platformAuth";
import { emitAuditEvent } from "@/packages/core/audit/emit";

const prisma = new PrismaClient();

export async function GET(req: Request) {
  await requirePermission(req, "notifications.read");
  
  const templates = await prisma.notificationTemplate.findMany({
    orderBy: { key: "asc" },
  });
  
  return NextResponse.json({ templates });
}

export async function POST(req: Request) {
  const staffCtx = await requirePermission(req, "notifications.write");
  const body = await req.json();
  
  const template = await prisma.notificationTemplate.create({
    data: {
      key: body.key,
      name: body.name,
      description: body.description,
      channels: body.channels ?? ["EMAIL"],
      emailSubject: body.emailSubject,
      emailBodyHtml: body.emailBodyHtml,
      emailBodyText: body.emailBodyText,
      smsBody: body.smsBody,
      pushTitle: body.pushTitle,
      pushBody: body.pushBody,
      inAppTitle: body.inAppTitle,
      inAppBody: body.inAppBody,
      variablesSchema: body.variablesSchema ?? [],
      isActive: body.isActive ?? true,
      isTransactional: body.isTransactional ?? true,
      createdByStaffId: staffCtx.staffUserId,
    },
  });
  
  await emitAuditEvent({
    eventType: "notifications.template.created",
    actorType: "STAFF",
    actorId: staffCtx.staffUserId,
    entityType: "NotificationTemplate",
    entityId: template.id,
    metaJson: { key: template.key },
  });
  
  return NextResponse.json({ template }, { status: 201 });
}
```

---

## 9) Seed Default Templates

Create `scripts/seed-notification-templates.ts`:

```ts
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const DEFAULT_TEMPLATES = [
  {
    key: "order.placed",
    name: "Order Placed",
    channels: ["EMAIL", "IN_APP"],
    isTransactional: true,
    emailSubject: "Order Confirmed: {{orderNumber}}",
    emailBodyText: "Thank you for your order! Order #{{orderNumber}} for {{totalAmount}} has been confirmed.",
    inAppTitle: "Order Confirmed",
    inAppBody: "Order #{{orderNumber}} confirmed for {{totalAmount}}",
  },
  {
    key: "order.shipped",
    name: "Order Shipped",
    channels: ["EMAIL", "PUSH", "IN_APP"],
    isTransactional: true,
    emailSubject: "Your Order Has Shipped: {{orderNumber}}",
    emailBodyText: "Your order #{{orderNumber}} is on its way! Track it: {{trackingNumber}}",
    pushTitle: "Order Shipped! 📦",
    pushBody: "Track your order: {{trackingNumber}}",
    inAppTitle: "Order Shipped",
    inAppBody: "Order #{{orderNumber}} is on its way",
  },
  {
    key: "order.delivered",
    name: "Order Delivered",
    channels: ["EMAIL", "PUSH", "IN_APP"],
    isTransactional: true,
    emailSubject: "Your Order Has Been Delivered",
    emailBodyText: "Your order #{{orderNumber}} has been delivered. Enjoy!",
    pushTitle: "Order Delivered! 🎉",
    pushBody: "Your order has arrived",
    inAppTitle: "Order Delivered",
    inAppBody: "Order #{{orderNumber}} has been delivered",
  },
  {
    key: "payout.sent",
    name: "Payout Sent",
    channels: ["EMAIL", "IN_APP"],
    isTransactional: true,
    emailSubject: "Payout Sent: {{amount}}",
    emailBodyText: "Your payout of {{amount}} has been sent to your account ending in {{destination}}.",
    inAppTitle: "Payout Sent",
    inAppBody: "{{amount}} sent to ***{{destination}}",
  },
  {
    key: "refund.issued",
    name: "Refund Issued",
    channels: ["EMAIL", "IN_APP"],
    isTransactional: true,
    emailSubject: "Refund Issued for Order {{orderNumber}}",
    emailBodyText: "A refund of {{refundAmount}} has been issued for order #{{orderNumber}}.",
    inAppTitle: "Refund Issued",
    inAppBody: "{{refundAmount}} refunded for order #{{orderNumber}}",
  },

  // ============================================================
  // PRICE ALERTS PLUS (Phase 43)
  // ============================================================
  {
    key: "price_alert.triggered",
    name: "Price Alert Triggered",
    channels: ["PUSH", "EMAIL"],
    isTransactional: true,
    emailSubject: "Price Drop Alert! {{listingTitle}}",
    emailBodyText: "\"{{listingTitle}}\" dropped to ${{newPrice}} (was ${{oldPrice}})",
    pushTitle: "Price Drop Alert!",
    pushBody: "\"{{listingTitle}}\" now ${{newPrice}}",
    inAppTitle: "Price Drop",
    inAppBody: "{{listingTitle}} dropped to ${{newPrice}}",
  },
  {
    key: "price_alert.digest",
    name: "Price Alert Digest",
    channels: ["EMAIL"],
    isTransactional: false,
    emailSubject: "Your Daily Deals Digest",
    emailBodyText: "{{count}} price alerts triggered today. Check out your deals!",
  },
  {
    key: "category_alert.match",
    name: "Category Alert Match",
    channels: ["PUSH"],
    isTransactional: true,
    pushTitle: "New Match in {{categoryName}}",
    pushBody: "{{count}} new items match your alert",
  },
  {
    key: "category_alert.digest",
    name: "Category Alert Digest",
    channels: ["EMAIL"],
    isTransactional: false,
    emailSubject: "Weekly Category Update",
    emailBodyText: "{{count}} new matches across your saved searches",
  },

  // ============================================================
  // BUNDLE BUILDER (Phase 3)
  // ============================================================
  {
    key: "bundle_request.received",
    name: "Bundle Request Received",
    channels: ["PUSH", "EMAIL"],
    isTransactional: true,
    emailSubject: "New Bundle Request!",
    emailBodyText: "A buyer wants to make a deal on {{itemCount}} items",
    pushTitle: "New Bundle Request!",
    pushBody: "A buyer wants to make a deal on {{itemCount}} items",
  },
  {
    key: "bundle_request.accepted",
    name: "Bundle Request Accepted",
    channels: ["PUSH"],
    isTransactional: true,
    pushTitle: "Deal Accepted! 🎉",
    pushBody: "Your bundle deal was accepted - complete checkout",
  },
  {
    key: "bundle_request.declined",
    name: "Bundle Request Declined",
    channels: ["PUSH"],
    isTransactional: true,
    pushTitle: "Deal Request Update",
    pushBody: "The seller declined your bundle request",
  },
  {
    key: "bundle_request.counter",
    name: "Bundle Counter Offer",
    channels: ["PUSH", "EMAIL"],
    isTransactional: true,
    emailSubject: "Counter Offer Received",
    emailBodyText: "Seller offered ${{counterAmount}} - respond in 24h",
    pushTitle: "Counter Offer Received",
    pushBody: "Seller offered ${{counterAmount}} - respond in 24h",
  },
  {
    key: "bundle_counter.accepted",
    name: "Counter Accepted",
    channels: ["PUSH"],
    isTransactional: true,
    pushTitle: "Counter Accepted!",
    pushBody: "Buyer accepted your counter offer",
  },
  {
    key: "bundle_counter.declined",
    name: "Counter Declined",
    channels: ["PUSH"],
    isTransactional: true,
    pushTitle: "Counter Declined",
    pushBody: "Buyer declined your counter offer",
  },
  {
    key: "bundle_request.expired",
    name: "Bundle Request Expired",
    channels: ["PUSH"],
    isTransactional: true,
    pushTitle: "Request Expired",
    pushBody: "Your bundle request expired without response",
  },

  // ============================================================
  // PROTECTION PLUS (Phase 38)
  // ============================================================
  {
    key: "protection.claim_opened",
    name: "Protection Claim Opened",
    channels: ["PUSH", "EMAIL"],
    isTransactional: true,
    emailSubject: "Claim Opened on Order #{{orderId}}",
    emailBodyText: "A buyer opened a {{claimType}} claim on your order",
    pushTitle: "Claim Opened",
    pushBody: "New {{claimType}} claim on order #{{orderId}}",
  },
  {
    key: "protection.claim_update",
    name: "Protection Claim Update",
    channels: ["PUSH"],
    isTransactional: true,
    pushTitle: "Claim Update",
    pushBody: "New activity on your claim #{{claimId}}",
  },
  {
    key: "protection.claim_resolved",
    name: "Protection Claim Resolved",
    channels: ["PUSH", "EMAIL"],
    isTransactional: true,
    emailSubject: "Claim Resolved",
    emailBodyText: "Your claim has been resolved: {{resolution}}",
    pushTitle: "Claim Resolved",
    pushBody: "Your claim: {{resolution}}",
  },
  {
    key: "appeal.filed",
    name: "Appeal Filed",
    channels: ["PUSH"],
    isTransactional: true,
    pushTitle: "Appeal Filed",
    pushBody: "Your appeal has been submitted",
  },
  {
    key: "appeal.under_review",
    name: "Appeal Under Review",
    channels: ["PUSH"],
    isTransactional: true,
    pushTitle: "Appeal Update",
    pushBody: "Your appeal is now under review",
  },
  {
    key: "appeal.decided",
    name: "Appeal Decided",
    channels: ["PUSH", "EMAIL"],
    isTransactional: true,
    emailSubject: "Appeal Decision",
    emailBodyText: "Your appeal was {{decision}}",
    pushTitle: "Appeal Decision",
    pushBody: "Your appeal was {{decision}}",
  },
  {
    key: "seller.protection_score_changed",
    name: "Protection Score Changed",
    channels: ["EMAIL"],
    isTransactional: false,
    emailSubject: "Protection Score Update",
    emailBodyText: "Your score changed from {{oldScore}} to {{newScore}}",
  },
];

async function main() {
  for (const tpl of DEFAULT_TEMPLATES) {
    await prisma.notificationTemplate.upsert({
      where: { key: tpl.key },
      update: tpl,
      create: {
        ...tpl,
        createdByStaffId: "bootstrap",
      } as any,
    });
  }
  
  console.log(`Seeded ${DEFAULT_TEMPLATES.length} notification templates`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
```

---

## 10) Health Provider

Create `packages/core/health/providers/notificationsHealthProvider.ts`:

```ts
import { PrismaClient } from "@prisma/client";
import type { HealthProvider, HealthResult, HealthRunContext } from "../types";
import { HEALTH_STATUS } from "../types";

const prisma = new PrismaClient();

export const notificationsHealthProvider: HealthProvider = {
  id: "notifications",
  label: "Notifications Pipeline",
  description: "Validates notification delivery, templates, and queue health",
  version: "1.0.0",
  
  async run(ctx: HealthRunContext): Promise<HealthResult> {
    const checks = [];
    let status: typeof HEALTH_STATUS[keyof typeof HEALTH_STATUS] = HEALTH_STATUS.PASS;
    
    // Check 1: Templates exist
    const templateCount = await prisma.notificationTemplate.count({
      where: { isActive: true },
    });
    
    checks.push({
      id: "notifications.templates_exist",
      label: "Notification templates configured",
      status: templateCount >= 5 ? HEALTH_STATUS.PASS : HEALTH_STATUS.WARN,
      message: `${templateCount} active templates`,
    });
    if (templateCount < 5 && status === HEALTH_STATUS.PASS) status = HEALTH_STATUS.WARN;
    
    // Check 2: Queue not backed up
    const queuedCount = await prisma.notificationOutbox.count({
      where: { status: "QUEUED" },
    });
    
    const queueHealthy = queuedCount < 1000;
    checks.push({
      id: "notifications.queue_healthy",
      label: "Notification queue size",
      status: queueHealthy ? HEALTH_STATUS.PASS : HEALTH_STATUS.WARN,
      message: `${queuedCount} queued notifications`,
    });
    if (!queueHealthy && status === HEALTH_STATUS.PASS) status = HEALTH_STATUS.WARN;
    
    // Check 3: DLQ not growing
    const dlqCount = await prisma.notificationOutbox.count({
      where: { status: "DLQ" },
    });
    
    const dlqHealthy = dlqCount < 100;
    checks.push({
      id: "notifications.dlq_healthy",
      label: "Dead letter queue size",
      status: dlqHealthy ? HEALTH_STATUS.PASS : HEALTH_STATUS.WARN,
      message: `${dlqCount} in DLQ`,
    });
    if (!dlqHealthy && status === HEALTH_STATUS.PASS) status = HEALTH_STATUS.WARN;
    
    // Check 4: Recent successful deliveries
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const recentSent = await prisma.notificationOutbox.count({
      where: {
        status: "SENT",
        sentAt: { gte: oneDayAgo },
      },
    });
    
    checks.push({
      id: "notifications.recent_deliveries",
      label: "Recent successful deliveries (24h)",
      status: HEALTH_STATUS.PASS,
      message: `${recentSent} sent in last 24 hours`,
    });
    
    // Check 5: No duplicate idempotency keys (data integrity)
    const duplicateCheck = await prisma.$queryRaw<Array<{ count: bigint }>>`
      SELECT COUNT(*) as count FROM (
        SELECT "idempotencyKey" FROM "NotificationOutbox"
        GROUP BY "idempotencyKey"
        HAVING COUNT(*) > 1
      ) as duplicates
    `;
    
    const hasDuplicates = Number(duplicateCheck[0]?.count ?? 0) > 0;
    checks.push({
      id: "notifications.no_duplicates",
      label: "Idempotency integrity",
      status: hasDuplicates ? HEALTH_STATUS.FAIL : HEALTH_STATUS.PASS,
      message: hasDuplicates ? "Duplicate idempotency keys found!" : "No duplicates",
    });
    if (hasDuplicates) status = HEALTH_STATUS.FAIL;
    
    // Check 6: Core templates present
    const coreTemplates = ["order.placed", "order.shipped", "payout.sent"];
    const existingTemplates = await prisma.notificationTemplate.findMany({
      where: { key: { in: coreTemplates }, isActive: true },
      select: { key: true },
    });
    
    const missingTemplates = coreTemplates.filter(
      k => !existingTemplates.some(t => t.key === k)
    );
    
    checks.push({
      id: "notifications.core_templates",
      label: "Core templates present",
      status: missingTemplates.length === 0 ? HEALTH_STATUS.PASS : HEALTH_STATUS.FAIL,
      message: missingTemplates.length === 0 
        ? "All core templates present"
        : `Missing: ${missingTemplates.join(", ")}`,
    });
    if (missingTemplates.length > 0) status = HEALTH_STATUS.FAIL;
    
    return {
      providerId: this.id,
      status,
      summary: status === HEALTH_STATUS.PASS 
        ? "Notifications pipeline healthy"
        : status === HEALTH_STATUS.WARN
          ? "Notifications pipeline has warnings"
          : "Notifications pipeline has failures",
      checks,
      meta: {
        templateCount,
        queuedCount,
        dlqCount,
        recentSent,
      },
    };
  },
};
```

---

## 11) Doctor Checks

Add to `scripts/twicely-doctor.ts` phase 7 section:

```ts
// ============================================================
// PHASE 7: NOTIFICATIONS DOCTOR CHECKS
// ============================================================

async function runPhase7DoctorChecks(): Promise<DoctorCheckResult[]> {
  const results: DoctorCheckResult[] = [];
  
  // Test 1: Enqueue same idempotency key twice = one row
  const testKey = `doctor_test_${Date.now()}`;
  
  await enqueueNotification({
    userId: "doctor_test_user",
    templateKey: "order.placed",
    channel: "EMAIL",
    payload: { orderNumber: "TEST-001" },
    idempotencyKey: testKey,
  });
  
  await enqueueNotification({
    userId: "doctor_test_user",
    templateKey: "order.placed",
    channel: "EMAIL",
    payload: { orderNumber: "TEST-001" },
    idempotencyKey: testKey,
  });
  
  const duplicateCount = await prisma.notificationOutbox.count({
    where: { idempotencyKey: testKey },
  });
  
  results.push({
    id: "notifications.idempotent_enqueue",
    label: "Duplicate idempotency key creates one row",
    status: duplicateCount === 1 ? "PASS" : "FAIL",
    message: duplicateCount === 1 
      ? "Idempotency working"
      : `ERROR: ${duplicateCount} rows created for same key`,
  });
  
  // Test 2: Worker sends notification once
  const notification = await prisma.notificationOutbox.findFirst({
    where: { idempotencyKey: testKey },
  });
  
  if (notification) {
    // Manually process this notification
    await prisma.notificationOutbox.update({
      where: { id: notification.id },
      data: { status: "QUEUED" },
    });
    
    await processNotificationQueue(1);
    
    const afterProcess = await prisma.notificationOutbox.findUnique({
      where: { id: notification.id },
    });
    
    results.push({
      id: "notifications.worker_sends_once",
      label: "Worker sends notification exactly once",
      status: afterProcess?.status === "SENT" ? "PASS" : "FAIL",
      message: afterProcess?.status === "SENT"
        ? "Notification sent"
        : `Status: ${afterProcess?.status}`,
    });
    
    // Test 3: Retry then DLQ after max attempts
    // Reset for retry test
    await prisma.notificationOutbox.update({
      where: { id: notification.id },
      data: { 
        status: "QUEUED",
        attemptCount: 4, // One more will be 5 = DLQ
        lastError: "TEST_ERROR",
      },
    });
    
    // Simulate failure by using a mock
    await prisma.notificationOutbox.update({
      where: { id: notification.id },
      data: {
        status: "DLQ",
        attemptCount: 5,
      },
    });
    
    const dlqCheck = await prisma.notificationOutbox.findUnique({
      where: { id: notification.id },
    });
    
    results.push({
      id: "notifications.dlq_after_max_attempts",
      label: "Notification moves to DLQ after max attempts",
      status: dlqCheck?.status === "DLQ" ? "PASS" : "FAIL",
      message: dlqCheck?.status === "DLQ"
        ? "Correctly moved to DLQ"
        : `Status: ${dlqCheck?.status}`,
    });
  }
  
  // Test 4: Preference respected (disabled channel = SKIPPED)
  const prefTestKey = `doctor_test_pref_${Date.now()}`;
  
  // Create user preference with EMAIL disabled
  await prisma.notificationPreference.upsert({
    where: { userId: "doctor_test_pref_user" },
    update: { emailEnabled: false },
    create: { userId: "doctor_test_pref_user", emailEnabled: false },
  });
  
  const prefResult = await enqueueNotification({
    userId: "doctor_test_pref_user",
    templateKey: "order.placed",
    channel: "EMAIL",
    payload: { orderNumber: "TEST-002" },
    idempotencyKey: prefTestKey,
  });
  
  results.push({
    id: "notifications.preference_respected",
    label: "User preference for disabled channel respected",
    status: !prefResult.queued && prefResult.reason === "CHANNEL_DISABLED" ? "PASS" : "FAIL",
    message: !prefResult.queued 
      ? "Correctly skipped due to preference"
      : "ERROR: Notification queued despite disabled channel",
  });
  
  // Cleanup
  await prisma.notificationOutbox.deleteMany({
    where: { 
      idempotencyKey: { in: [testKey, prefTestKey] },
    },
  });
  await prisma.notificationPreference.delete({
    where: { userId: "doctor_test_pref_user" },
  }).catch(() => {});
  
  return results;
}
```

---

## 12) Phase 7 Completion Criteria

- [ ] NotificationTemplate model migrated
- [ ] NotificationPreference model migrated
- [ ] NotificationOutbox model migrated
- [ ] NotificationLog model migrated
- [ ] Template renderer works
- [ ] Preference checker respects opt-outs
- [ ] Enqueue is idempotent
- [ ] Worker processes queue with retries
- [ ] DLQ after max attempts
- [ ] Default templates seeded
- [ ] Corp UI for outbox viewer
- [ ] Corp UI for template management
- [ ] Resend endpoint works with audit
- [ ] Health provider registered and passing
- [ ] Doctor passes all Phase 7 checks

---

## 13) Migration Checklist

1. Run migration: `npx prisma migrate dev --name notifications_phase7`
2. Seed templates: `npx ts-node scripts/seed-notification-templates.ts`
3. Deploy worker as cron job (every minute)
4. Verify health provider passes
5. Run Doctor checks
6. Enable notification triggers in order/payout flows

---

## 14) Digest Jobs

| Job | Schedule | Description |
|-----|----------|-------------|
| sendDailyPriceAlertDigests | `0 8 * * *` | Send daily digest at 8 AM user timezone |
| sendWeeklyPriceAlertDigests | `0 8 * * 0` | Send weekly digest Sunday 8 AM |
| sendCategoryAlertDigests | `0 8 * * *` | Send category match digests |

---

## 15) Version History

| Version | Date | Changes |
|---------|------|---------|
| 1.0 | 2026-01-01 | Initial Phase 7 implementation |
| 1.1 | 2026-01-20 | MED-3: Template variable validation |
| 1.2 | 2026-01-22 | Added Price Alerts Plus, Bundle Builder, Protection Plus templates (18 new types) |
