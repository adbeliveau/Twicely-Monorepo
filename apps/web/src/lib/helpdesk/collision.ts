/**
 * Helpdesk Agent Collision Detection
 *
 * Centrifugo-based presence tracking for agent case detail pages.
 * Detects when multiple agents are viewing or composing in the same case.
 *
 * Per TWICELY_V3_HELPDESK_CANONICAL.md §29.
 *
 * NOTE: Degrades gracefully if Centrifugo is not configured — no errors thrown.
 */

const CENTRIFUGO_API_URL = process.env.CENTRIFUGO_API_URL ?? '';
const CENTRIFUGO_API_KEY = process.env.CENTRIFUGO_API_KEY ?? '';

export type CollisionEventType =
  | 'agent_viewing'
  | 'agent_typing_reply'
  | 'agent_stopped_typing'
  | 'agent_left'
  | 'agent_sent_reply';

export interface CollisionEvent {
  type: CollisionEventType;
  agentId: string;
  agentName: string;
  caseId: string;
  timestamp: string;
}

/**
 * Publish a collision event to the case's private Centrifugo channel.
 * Silently no-ops if Centrifugo is not configured.
 */
export async function publishCollisionEvent(
  event: CollisionEvent
): Promise<void> {
  if (!CENTRIFUGO_API_URL || !CENTRIFUGO_API_KEY) return;

  const channel = `private-case.${event.caseId}`;

  try {
    await fetch(`${CENTRIFUGO_API_URL}/api/publish`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `apikey ${CENTRIFUGO_API_KEY}`,
      },
      body: JSON.stringify({
        channel,
        data: event,
      }),
    });
  } catch {
    // Centrifugo offline — degrade gracefully
  }
}

/**
 * Generate a Centrifugo subscription token for a staff member to subscribe
 * to a case's private channel.
 *
 * Returns null if Centrifugo JWT secret is not configured.
 */
export function buildCaseChannelName(caseId: string): string {
  return `private-case.${caseId}`;
}
