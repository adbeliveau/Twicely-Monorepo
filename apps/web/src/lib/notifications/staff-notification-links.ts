/**
 * Resolve a notification template key + data to the appropriate hub route.
 * Used by the HubNotificationDropdown to generate links for each notification.
 */

interface NotificationData {
  caseId?: string;
  caseNumber?: string;
  actionId?: string;
  orderId?: string;
  orderNumber?: string;
  returnRequestId?: string;
  disputeCaseId?: string;
  [key: string]: unknown;
}

/**
 * Given a notification templateKey and its dataJson, return the hub route
 * the notification should link to.
 */
export function resolveNotificationLink(
  templateKey: string,
  dataJson: Record<string, unknown>
): string {
  const data = dataJson as NotificationData;

  // Helpdesk templates -> case detail page
  if (templateKey.startsWith('helpdesk.')) {
    const caseId = data.caseId ?? data.caseNumber;
    if (caseId) return `/hd/cases/${caseId}`;
    return '/hd';
  }

  // Enforcement templates -> enforcement detail or list
  if (templateKey.startsWith('enforcement.')) {
    const actionId = data.actionId;
    if (actionId) return `/mod/enforcement/${actionId}`;
    return '/mod/enforcement';
  }

  // Order templates -> order detail
  if (templateKey.startsWith('order.')) {
    const orderId = data.orderId;
    if (orderId) return `/tx/orders/${orderId}`;
    return '/tx/orders';
  }

  // Return templates -> returns list
  if (templateKey.startsWith('return.')) {
    return '/mod/returns';
  }

  // Dispute templates -> dispute detail or list
  if (templateKey.startsWith('dispute.')) {
    const disputeId = data.disputeCaseId;
    if (disputeId) return `/mod/disputes/${disputeId}`;
    return '/mod/disputes';
  }

  // Protection claims
  if (templateKey.startsWith('protection.')) {
    return '/mod/disputes';
  }

  // Local pickup fraud
  if (templateKey.startsWith('local.fraud.')) {
    return '/mod';
  }

  // KYC / identity verification
  if (templateKey.startsWith('kyc.')) {
    return '/usr/sellers/verification';
  }

  // Default: notification management page
  return '/notifications';
}

/**
 * Derive a short display title from the notification templateKey.
 * Falls back to subject if available, otherwise a human-readable key label.
 */
export function resolveNotificationTitle(
  templateKey: string,
  subject: string | null
): string {
  if (subject) return subject;

  const titleMap: Record<string, string> = {
    'helpdesk.case.created': 'New support case',
    'helpdesk.case.agent_reply': 'Agent reply',
    'helpdesk.agent.assigned': 'Case assigned to you',
    'helpdesk.agent.sla_warning': 'SLA warning',
    'helpdesk.agent.sla_breach': 'SLA breached',
    'helpdesk.agent.mention': 'Mentioned in case',
    'helpdesk.case.watcher_update': 'Watched case update',
    'helpdesk.case.reopened': 'Case reopened',
    'enforcement.appeal_submitted': 'New appeal to review',
    'enforcement.coaching': 'Enforcement coaching',
    'enforcement.warning': 'Enforcement warning',
    'enforcement.restriction': 'Account restricted',
    'order.confirmed': 'Order confirmed',
    'order.shipped': 'Order shipped',
    'order.delivered': 'Order delivered',
    'order.canceled': 'Order canceled',
    'order.refunded': 'Order refunded',
    'dispute.opened': 'Dispute opened',
    'dispute.resolved': 'Dispute resolved',
    'return.requested': 'Return requested',
    'return.approved': 'Return approved',
  };

  return titleMap[templateKey] ?? templateKey.replace(/\./g, ' ');
}
