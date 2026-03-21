/**
 * Quick-reply chips for the messaging composer (G10.11.3).
 *
 * Static definitions — no DB, no auth required.
 * Clicking a chip populates the message body (user can edit before sending).
 */

export const MESSAGING_QUICK_REPLIES = [
  { id: 'still-available', label: 'Still available', text: 'Yes, this item is still available!' },
  { id: 'shipping-soon', label: 'Shipping soon', text: "Thanks for your purchase! I'll ship within 24 hours." },
  { id: 'measurements', label: 'Ask measurements', text: "Could you provide the measurements for this item?" },
  { id: 'bundle', label: 'Bundle offer', text: "I'd be happy to bundle this with other items from my store. Let me know what you're interested in!" },
  { id: 'best-offer', label: 'Make an offer', text: "Feel free to make an offer! I'm open to reasonable offers." },
] as const;

export type MessagingQuickReplyId = typeof MESSAGING_QUICK_REPLIES[number]['id'];
