# E2.2 Messaging Patterns & Edge Cases

## Mock Setup for Messaging Actions

All messaging actions import from `messaging-helpers` — always mock it:
```typescript
vi.mock('../messaging-helpers', () => ({
  getRateLimitPerHour: (...args: unknown[]) => mockGetRateLimitPerHour(...args),
  getMessageCountLastHour: (...args: unknown[]) => mockGetMessageCountLastHour(...args),
  isParticipant: (...args: unknown[]) => mockIsParticipant(...args),
  fetchConversation: (...args: unknown[]) => mockFetchConversation(...args),
}));
```

`messaging-manage.ts` imports `authorize` and `sub` from `@/lib/casl` (NOT `@/lib/casl/authorize`).
`messaging-actions.ts` imports `authorize` from `@/lib/casl/authorize`. Mock BOTH:
```typescript
vi.mock('@/lib/casl', () => ({ authorize: mockAuthFn, sub: (s, c) => ({s, c}) }));
vi.mock('@/lib/casl/authorize', () => ({ authorize: mockAuthFn }));
```

## Edge Cases

### Phone Pattern Limitation
`PHONE_PATTERN = /\b\d{3}[-.\s]?\d{3}[-.\s]?\d{4}\b/` — the `\b` word boundary before digits
fails when preceded by `)`. So `(555) 123-4567` is NOT detected. Test must document this correctly.

### checkMessageSafety Returns
- All flag types return the same `flagReason`: `'Off-platform transaction detected'`
- Keywords use `.includes()` — matches substrings within words (e.g. "btc" in "btcoin" would match)
- `isFlagged: false` means `flagReason: null` (not empty string)

### createConversation Sequence
- 2 db.select calls: listing query → existing conversation query
- 2 db.insert calls: conversation insert → message insert
- Returns `conversationId` (not `messageId`) on happy path
- Off-platform detection NOT run during createConversation (only in sendMessage)

### sendMessage Sequence
- `fetchConversation()` helper (not a raw db call) → isParticipant() check
- Block check: `Promise.all([isBuyerBlocked(sellerId, buyerId), isBuyerBlocked(buyerId, sellerId)])`
- Rate limit check: `Promise.all([getMessageCountLastHour(), getRateLimitPerHour()])`
- Off-platform: `checkMessageSafety(body)` — flags if true but does NOT block send
- 1 db.insert for message, 1 db.update for unread counts
- Returns `messageId` (not `conversationId`) on happy path

### markAsRead Sequence
- 2 db.update calls: one for unread counts, one for marking messages isRead=true

### archiveConversation CASL Check
- Buyer: `ability.can('update', sub('Conversation', { buyerId: userId }))`
- Seller: `ability.can('update', sub('Conversation', { sellerId: conv.sellerId }))`
- Both use `sub()` from `@/lib/casl`

### reportMessage Sequence
- 1 db.select for message, then fetchConversation helper, then isParticipant check
- 1 db.update to flag the conversation (NOT the message itself)
- Does NOT create helpdesk case (deferred to Phase G9)

## Query Patterns

### getConversations
- Uses subquery sql`` for buyer/seller names (NOT a join to user table in main query)
- Buyer: otherPartyId=sellerId, otherPartyName=otherSellerName, unreadCount=buyerUnreadCount
- Seller: otherPartyId=buyerId, otherPartyName=otherBuyerName, unreadCount=sellerUnreadCount
- makeChain must include `['from', 'leftJoin', 'innerJoin', 'where', 'orderBy', 'limit']`

### getConversationMessages
- First select: conversation (ends at `.limit()`) with leftJoin on listing + listingImage
- Second select: messages (ends at `.orderBy()`) with innerJoin on user
- Non-participant check done in code: `if (conv.buyerId !== userId && conv.sellerId !== userId) return null`

### getUnreadCount
- Makes exactly 2 db.select calls: buyer sum → seller sum
- Uses `sum()` aggregation — result row may have `total: null` when no rows (guard with `?? 0`)
- Queries end at `.from().where()` (no .limit()) — use `makeWhereTerminalChain`

### getConversationForListing
- Returns conversationId string or null
- Only returns non-null when status === 'OPEN' (ARCHIVED, READ_ONLY both return null)
- Ends at `.from().where().limit()` — use `makeLimitChain`

### getFlaggedConversations (messaging-admin.ts)
- Ends at `.from().where().orderBy().limit()` — terminal method is `.limit()`
- Maps null buyerName/sellerName → 'Unknown' (fallback in code)
- Makes exactly 1 db.select() call
- subject, flagReason, lastMessageAt are all nullable

## E2.3 UI Component Patterns

### messaging-helpers.ts test isolation
- `isParticipant` is a pure synchronous function — no mocking needed
- `getRateLimitPerHour` ends at `.from().where().limit()` — use `makeLimitChain`
- `getMessageCountLastHour` ends at `.from().where()` awaited directly — use `makeWhereChain` (returns promise from `.where()`)
- `fetchConversation` ends at `.from().where().limit()` — use `makeLimitChain`
- `getRateLimitPerHour` default is 20 when value is not typeof number (string "30" → 20, null → 20)

### ListingActionButtons gating logic
- `!isOwnListing`: gates WatchButton, PriceAlertButton, MakeOffer, WatcherOffer, MessageSeller
- `!isUnavailable`: gates ListingAuthActions, MakeOffer, WatcherOffer, MessageSeller
- Unavailable banner: shown ONLY when isUnavailable=true (independent section)
- ListingAuthActions uses isUnavailable only (NOT isOwnListing) — owner can still see buy button area

### MessageSellerButton
- Login callback: `/auth/login?callbackUrl=/i/${listingSlug}` — uses /i/ NOT /listing/
- Conversation URL: `/my/messages/${conversationId}` — uses /my/messages/ NOT /m/
- Inline form shown when: isLoggedIn=true AND existingConversationId=null AND clicked=true
- Cancel clears body and error state, sets showForm=false
