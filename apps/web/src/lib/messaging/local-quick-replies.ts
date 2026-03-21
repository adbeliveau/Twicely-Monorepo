/**
 * Quick-reply templates for local meetup conversations (G2.6).
 *
 * Shown as one-click buttons above the message compose area
 * when a conversation is linked to a local order.
 * The user can edit the populated text before sending.
 */

export const LOCAL_MEETUP_QUICK_REPLIES = [
  {
    id: 'on-my-way',
    label: 'On my way',
    text: "I'm on my way! Be there soon.",
  },
  {
    id: 'im-here',
    label: "I'm here",
    text: "I'm here at the meetup location.",
  },
  {
    id: 'running-late',
    label: 'Running 15 min late',
    text: "Running about 15 minutes late. Sorry for the delay!",
  },
  {
    id: 'need-reschedule',
    label: 'Need to reschedule',
    text: "I need to reschedule our meetup. When works for you?",
  },
] as const;

export type LocalQuickReplyId = (typeof LOCAL_MEETUP_QUICK_REPLIES)[number]['id'];
