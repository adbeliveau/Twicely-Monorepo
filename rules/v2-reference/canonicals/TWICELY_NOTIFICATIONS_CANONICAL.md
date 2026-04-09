# TWICELY_NOTIFICATIONS_CANONICAL.md
**Status:** LOCKED (v1)  
**Scope:** System notifications, messaging triggers, template management, and delivery guarantees.  
**Audience:** Backend, frontend, platform, AI agents.

---

## 1. Purpose

This canonical defines **when, why, and how Twicely communicates** with users.

---

## 2. Core Principles

1. **Transactional > promotional**
2. **Idempotent delivery**
3. **Right message, right time**
4. **No silent failures**
5. **Templates are configurable**
6. **User preferences respected**

---

## 3. Notification Types

### 3.1 Transactional (Required)
| Key | Recipient | Description |
|---|---|---|
| order.placed | buyer | Order confirmation |
| order.paid | seller | Payment received |
| order.shipped | buyer | Shipment created |
| order.delivered | buyer | Delivery confirmed |
| order.canceled | both | Order canceled |
| refund.issued | buyer | Refund processed |
| payout.sent | seller | Payout completed |
| payout.failed | seller | Payout failed |

### 3.2 Engagement (Optional)
| Key | Recipient | Description |
|---|---|---|
| review.requested | buyer | Ask for review |
| review.received | seller | New review notification |
| watchlist.price_drop | buyer | Price dropped |
| watchlist.ending_soon | buyer | Listing ending |
| saved_search.new_results | buyer | New matches |
| message.new | both | New message |

### 3.3 System
| Key | Recipient | Description |
|---|---|---|
| account.verified | user | Verification complete |
| account.suspended | user | Account suspended |
| policy.updated | all | Policy changes |

---

## 4. Channels

| Channel | Required | Use Case |
|---|---|---|
| In-App | Yes | All notifications |
| Email | Yes | Transactional, digest |
| Push | Optional | Time-sensitive |
| SMS | Optional | Critical only |

### 4.1 Channel Selection
- Transactional: In-App + Email (always)
- Engagement: Per user preference
- System: In-App + Email

---

## 5. Notification Templates

### 5.1 Template Model

```ts
type NotificationTemplate = {
  id: string;
  key: string;              // Unique identifier, e.g., "order.shipped"
  name: string;             // Human-readable name
  description?: string;
  category: string;         // orders, payments, reviews, etc.
  
  // Channel-specific content
  inAppTitle: string;
  inAppBody: string;
  inAppActionUrl?: string;
  inAppActionLabel?: string;
  
  emailSubject?: string;
  emailBodyHtml?: string;
  emailBodyText?: string;
  emailFromName?: string;
  
  pushTitle?: string;
  pushBody?: string;
  pushImageUrl?: string;
  
  smsBody?: string;
  
  // Configuration
  enabledChannels: ("IN_APP" | "EMAIL" | "PUSH" | "SMS")[];
  defaultChannel: string;
  
  // Variables
  variablesSchema: TemplateVariable[];
  
  // Status
  isActive: boolean;
  isSystemTemplate: boolean;  // Cannot be deleted
};

type TemplateVariable = {
  name: string;
  type: "string" | "number" | "date" | "currency" | "url";
  description: string;
  required: boolean;
  example?: string;
};
```

### 5.2 Template Variables

Templates use `{{variable}}` syntax:

```
Subject: Your order {{orderNumber}} has shipped!
Body: Hi {{buyerName}}, great news! Your order is on the way.
      Track it here: {{trackingUrl}}
```

Common variables:
| Variable | Type | Description |
|---|---|---|
| buyerName | string | Buyer's display name |
| sellerName | string | Seller's display name |
| orderNumber | string | Order reference |
| orderTotal | currency | Formatted total |
| trackingNumber | string | Carrier tracking |
| trackingUrl | url | Tracking link |
| itemTitle | string | Item name |

### 5.3 Template Management

- Platform admins manage templates via Settings UI
- System templates (isSystemTemplate: true) cannot be deleted
- All template changes are audited
- Preview available before save

---

## 6. User Preferences

### 6.1 Preference Model

```ts
type NotificationPreference = {
  userId: string;
  type: string;           // Notification type key
  inAppEnabled: boolean;
  emailEnabled: boolean;
  pushEnabled: boolean;
  smsEnabled: boolean;
};
```

### 6.2 Preference Rules
- Transactional notifications cannot be fully disabled
- Users may disable non-essential channels
- Preferences checked before sending

---

## 7. Sending Notifications

### 7.1 Emit Function

```ts
async function emitNotification(args: {
  userId: string;
  type: string;
  data: Record<string, any>;
  actionUrl?: string;
}): Promise<Notification[]> {
  // 1. Get template
  const template = await getTemplate(args.type);
  
  // 2. Get user preferences
  const prefs = await getUserPreferences(args.userId, args.type);
  
  // 3. Determine channels
  const channels = filterEnabledChannels(template, prefs);
  
  // 4. Render content
  const content = renderTemplate(template, args.data);
  
  // 5. Create notifications
  const notifications = await createNotifications(args.userId, channels, content);
  
  // 6. Queue delivery
  await queueDelivery(notifications);
  
  return notifications;
}
```

### 7.2 Rendering

```ts
function renderTemplate(template: string, data: Record<string, any>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key) => {
    const value = data[key];
    if (value === undefined) return `{{${key}}}`;
    return formatValue(value, getVariableType(key));
  });
}
```

---

## 8. Idempotency

Notifications MUST:
- Include idempotency keys
- Never double-send for same event
- Track delivery status

```ts
emitNotification({
  userId,
  type: "order.shipped",
  idempotencyKey: `order:${orderId}:shipped`,
  data: { orderNumber, trackingNumber }
});
```

---

## 9. Delivery Status

| Status | Description |
|---|---|
| PENDING | Created, not yet sent |
| SENT | Handed to provider |
| DELIVERED | Confirmed delivered |
| READ | User viewed (in-app) |
| FAILED | Delivery failed |

---

## 10. Failure Handling

- Retries with exponential backoff
- Max 3 retry attempts
- Dead-letter queue for persistent failures
- Failures visible in Platform Health
- Alerts for high failure rates

---

## 11. RBAC

| Action | Permission |
|---|---|
| View own notifications | user |
| View notification logs | admin |
| Resend notification | support |
| Edit templates | settings.notifications.edit |
| View templates | settings.notifications.view |

---

## 12. Audit Requirements

Audit events for:
- Template created/updated/deleted
- Notification sent
- Delivery failures
- Preference changes

---

## 13. Out of Scope

- Marketing campaigns
- Bulk messaging
- A/B testing
- Analytics on open rates

---

## 14. Final Rule

If a notification matters, it must be **guaranteed, traceable, and observable**.

Templates are the single source of truth for notification content.
