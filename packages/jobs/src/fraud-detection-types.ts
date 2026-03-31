/**
 * Types and helpers shared across fraud detection modules.
 */

export interface FraudCheckResult {
  flagged: boolean;
  signalType: string;
  details: string;
  severity: 'WARNING' | 'SUSPEND' | 'BAN';
}

export interface FraudScanResult {
  affiliateId: string;
  signals: FraudCheckResult[];
  highestSeverity: 'NONE' | 'WARNING' | 'SUSPEND' | 'BAN';
}

/** Loopback / private IPs that should never trigger self-referral flags. */
const EXCLUDED_IPS = new Set(['127.0.0.1', '::1', 'localhost', '0.0.0.0']);

export function isExcludedIp(ip: string): boolean {
  if (EXCLUDED_IPS.has(ip) || ip.startsWith('192.168.') || ip.startsWith('10.')) return true;
  // RFC-1918: 172.16.0.0/12 (172.16.* – 172.31.*)
  if (ip.startsWith('172.')) {
    const second = parseInt(ip.split('.')[1] ?? '', 10);
    if (second >= 16 && second <= 31) return true;
  }
  return false;
}

export function getSubnet24(ip: string): string | null {
  const parts = ip.split('.');
  if (parts.length !== 4) return null;
  return `${parts[0]}.${parts[1]}.${parts[2]}.0/24`;
}

export function highestOf(
  a: 'NONE' | 'WARNING' | 'SUSPEND' | 'BAN',
  b: 'WARNING' | 'SUSPEND' | 'BAN',
): 'NONE' | 'WARNING' | 'SUSPEND' | 'BAN' {
  const rank = { NONE: 0, WARNING: 1, SUSPEND: 2, BAN: 3 } as const;
  return rank[a] >= rank[b] ? a : b;
}
