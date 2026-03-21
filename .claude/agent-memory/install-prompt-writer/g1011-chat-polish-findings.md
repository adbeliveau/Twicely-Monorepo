# G10.11 Chat Component Polish — Research Findings

## Current V3 Messaging State (4 components)

### Existing files
- `src/components/messaging/conversation-list.tsx` (94 lines) — inbox rows, avatar, unread dot, listing thumbnail
- `src/components/messaging/conversation-thread.tsx` (149 lines) — message bubbles, listing context card, flag banner, compose/closed footer
- `src/components/messaging/message-composer.tsx` (85 lines) — textarea, send button, Paperclip (disabled), char count
- `src/components/messaging/message-seller-button.tsx` (116 lines) — listing page CTA, inline compose form

### Existing pages
- `src/app/(hub)/my/messages/page.tsx` (41 lines) — SSR inbox page
- `src/app/(hub)/my/messages/[conversationId]/page.tsx` (47 lines) — SSR conversation page
- `src/app/(hub)/my/messages/loading.tsx` + `[conversationId]/loading.tsx`

### Existing backend
- `src/lib/actions/messaging-actions.ts` — createConversation, sendMessage
- `src/lib/actions/messaging-manage.ts` — markAsRead, archiveConversation, reportMessage
- `src/lib/queries/messaging.ts` — getConversations, getConversationMessages, getUnreadCount, getConversationForListing
- `src/lib/validations/messaging.ts` — Zod schemas for all messaging actions
- `src/lib/notifications/message-notifier.ts` — notifyNewMessage (email/push notifications)
- `src/lib/messaging/local-quick-replies.ts` — quick replies for LOCAL meetup only (hardcoded 4 templates)
- `src/lib/realtime/centrifugo-publisher.ts` — publishToChannel(), sellerChannel()

### Key gaps vs spec (Feature Lock-In §19, §15)

1. **Paperclip is permanently disabled** — `title="Image sharing coming soon"`. Spec §19: "Image sharing: buyer/seller can send up to 4 images per message." Must be wired.

2. **No typing indicator** — Spec §19: "Typing indicator: 'Seller is typing...' via Centrifugo." Missing from composer and thread. Also missing: `POST /api/messaging/typing` API route or a publish-to-channel call.

3. **No real-time message delivery** — Spec §19: "Real-time delivery: messages appear instantly via Centrifugo WebSocket." V3 uses `router.refresh()` after sendMessage. Missing: client-side Centrifugo subscription on `private-conversation.{conversationId}`.

4. **No read receipt display** — Spec §19: "Read receipts: sender sees 'Read' when recipient opens the conversation." `readAt` exists on message table and `markAsRead` server action exists, but no UI shows "Read" under sent messages.

5. **No seller Quick Replies** — Spec §19: "Quick Replies (seller): saved canned responses. Seller manages their own quick reply library." No `sellerQuickReply` table in schema (NOT SPECIFIED in schema doc). This is a schema gap. Two options: (A) static hardcoded defaults only (no library management), (B) new table. Owner decision needed.

6. **No conversation filter tabs** — V2 had "All / Buying / Selling" filter tabs on the inbox. V3 inbox shows everything flat. `getConversations()` already accepts `role: 'buyer' | 'seller' | 'both'` — just needs UI tabs.

7. **Last message preview absent** — ConversationList shows listing title but NOT the last message text snippet. V2 showed "You: Is this still available?" style preview. `ConversationSummary` has no `lastMessagePreview` field. Query needs update.

8. **No two-column split layout** — V2's "chat-app feel" was a two-column layout: conversation list on left (sidebar), thread on right. V3 uses separate pages (navigates away). Page Registry §6 shows `/m/[conversationId]` as a separate page — the split layout is an enhancement to the page, not a new route.

9. **Conversation subject shown in header, not other party's name+avatar** — ConversationThread header shows `conversation.subject` (which is the listing title) with no avatar. V2 showed the other party's name and avatar prominently.

10. **"Closed" status uses wrong copy** — ConversationList badge says "Closed" for READ_ONLY. Spec §19: "Read-only = both parties can see full history but cannot send new messages." No canonical copy for the label — "Read-only" or "Closed" both defensible.

## Schema Analysis

### No schema changes needed for core polish
- `conversation` (§9.1) and `message` (§9.2) tables are fully aligned with the spec.
- `attachments: text[].array()` on `message` table exists and validated by `sendMessageSchema` (max 4 URLs). Only the UI was disabled.
- `isRead`, `readAt` columns exist. `markAsRead` action already wires. Just need UI indicator.

### Schema gap: no sellerQuickReply table
- Feature Lock-in §19 says "Seller manages their own quick reply library."
- Schema doc has NO `sellerQuickReply` or `messagingTemplate` table.
- Resolution: This step implements STATIC hardcoded quick reply suggestions (5 pre-defined, same for all sellers). No DB required. The "manage your own library" feature is deferred (NOT SPECIFIED in schema doc, so no table can be created without owner sign-off).

### No Centrifugo client subscription infrastructure yet
- `centrifugo-publisher.ts` handles SERVER-SIDE publish only.
- No `/api/realtime/token` route exists for client-side channel subscriptions.
- No client-side Centrifugo hook exists anywhere in codebase.
- Feature Lock-in §15: channel `private-conversation.{conversationId}` exists as a named channel.
- Full Centrifugo client integration (WebSocket connection, reconnect, presence) is COMPLEX and risky for a polish step. Scope decision needed: (A) full real-time wiring, (B) optimistic UI only (instant local state update + background refresh). Owner decision needed.

## Image Attachment Upload

### Existing pattern
- `POST /api/upload` handles listing images and video — multipart form data, returns `{ success, image: { id, url } }`
- Type parameter: `type=listing-image`, `type=video`, `type=video-thumbnail`
- Need to add `type=message-attachment` to this route (or create separate route)
- upload/route.ts is 239 lines — can accommodate message-attachment handler inline or as extracted handler file

### File size limits (need platform_settings keys)
- No existing platform setting for message attachment size. Need to seed `comms.messaging.attachmentMaxBytes`.
- Spec §19: "up to 4 images per message" — already in `sendMessageSchema` (max 4 URLs array).

## Routes Involved

Per Page Registry v1.8:
- `/my/messages` — route #79 (dashboard layout, AUTH)
- `/my/messages/[conversationId]` — route #80 (dashboard layout, AUTH + own conversation)
- Note: Routes ARE in Page Registry. No new routes needed.

## CASL

Existing ability rules from `platform-abilities.ts`:
- `can(['read', 'create'], 'Message', { participantId: session.userId })` — buyer
- `can(['read'], 'Conversation', { buyerId/sellerId })` and `can(['update'], 'Conversation', {...})` — buyer/seller
- No changes needed to CASL rules.

## Test Baseline

As of G10.10 complete: 7593 tests, 613 test files. This is the correct baseline.

## Decomposition Decision

G10.11 should be split into sub-steps:

**G10.11.1 — Inbox UX: filter tabs + last message preview + last message sender**
- New `lastMessagePreview` + `lastMessageSenderIsMe` in ConversationSummary
- Inbox gets "All / Buying / Selling" tabs with URL search param `?role=`
- Pages must handle `searchParams`

**G10.11.2 — Thread UX: header polish + read receipt indicator + archive action**
- Header: other party name + avatar (not listing title)
- "Read" label under own messages when `isRead=true`
- Archive button in header (calls existing archiveConversation action)
- Report button in header (calls existing reportMessage action)

**G10.11.3 — Composer: image attachment + quick reply chips**
- Enable image upload via `POST /api/upload?type=message-attachment`
- Add `type=message-attachment` to upload route
- Quick reply chip bar above composer for sellers (static 5 suggestions)
- Platform setting seed: `comms.messaging.attachmentMaxBytes`

**G10.11.4 — Real-time: Centrifugo token API + client hook + typing indicator**
- `POST /api/realtime/subscribe` — returns Centrifugo subscription token for a channel
- `src/hooks/use-conversation-realtime.ts` — subscribes to `private-conversation.{id}`, updates local message state
- Typing indicator publish via existing centrifugo-publisher.ts
- `POST /api/messaging/typing` — debounced publish to `private-conversation.{id}` with `{ type: 'typing', userId }`

**OWNER DECISION NEEDED**: Is G10.11.4 (full Centrifugo client) in scope for this step, or should real-time be deferred to Phase H (browser extension / sockets phase)? The build tracker G10.11 description says "richer UX" which is vague. Real-time is the most impactful but also highest-effort piece.

## Spec Inconsistencies Identified

1. Feature Lock-in §19 says "Seller manages their own quick reply library" but schema doc has no `sellerQuickReply` table. These are irreconcilable without schema extension. This prompt will flag for owner decision and implement static defaults only.

2. Channel naming: local-channels.ts uses `local-tx:{id}` (colon separator). centrifugo-publisher.ts uses `private-user.{userId}` (dot separator). Feature Lock-in §15 uses `private-conversation.{conversationId}` (dot separator). Build tracker BullMQ note says "use hyphens not colons." Centrifugo channels are NOT BullMQ queues — hyphens/dots are fine for channel names per Centrifugo docs. The dot notation in Feature Lock-in §15 is canonical for conversation channels.

3. Page Registry says route is `/m/[conversationId]` in comments (#79, #80) but actual V3 implementation is at `/my/messages/[conversationId]` (per Unified Hub Canonical §2.1, convenience redirects `/m` → `/my/messages`). The pages live under `/my/messages/`. No conflict — routes are correct, page registry entry numbers 79/80 are what matters.
