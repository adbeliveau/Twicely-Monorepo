/**
 * SLA deadline calculator for helpdesk cases.
 * Reads SLA policies from DB and calculates due dates.
 */
import { db } from '@twicely/db';
import { helpdeskSlaPolicy } from '@twicely/db/schema';
import { eq } from 'drizzle-orm';
import { getPlatformSetting } from '@/lib/queries/platform-settings';

type CasePriority = 'CRITICAL' | 'URGENT' | 'HIGH' | 'NORMAL' | 'LOW';

export interface SlaDueDates {
  firstResponseDue: Date;
  resolutionDue: Date;
}

interface BusinessHoursConfig {
  start: string; // "HH:mm"
  end: string;   // "HH:mm"
  timezone: string;
  workDays: number[]; // [1,2,3,4,5] = Mon-Fri
}

/**
 * Add business minutes to a date, skipping non-business hours.
 * For calendar-minute calculations, simply adds minutes directly.
 */
function parseTime(timeStr: string): [number, number] {
  const parts = timeStr.split(':').map(Number);
  return [parts[0] ?? 0, parts[1] ?? 0];
}

function addBusinessMinutes(from: Date, minutes: number, config: BusinessHoursConfig): Date {
  const [startH, startM] = parseTime(config.start);
  const [endH, endM] = parseTime(config.end);
  const businessMinutesPerDay = (endH * 60 + endM) - (startH * 60 + startM);
  let remaining = minutes;
  let current = new Date(from);

  while (remaining > 0) {
    const dayOfWeek = current.getDay(); // 0=Sun,6=Sat
    const isWorkDay = config.workDays.includes(dayOfWeek);

    if (!isWorkDay) {
      current = new Date(current.getTime() + 24 * 60 * 60 * 1000);
      current.setHours(startH, startM, 0, 0);
      continue;
    }

    const todayStart = new Date(current);
    todayStart.setHours(startH, startM, 0, 0);
    const todayEnd = new Date(current);
    todayEnd.setHours(endH, endM, 0, 0);

    // If before business start, jump to start
    if (current < todayStart) {
      current = todayStart;
    }

    // If after business end, go to next work day start
    if (current >= todayEnd) {
      current = new Date(current.getTime() + 24 * 60 * 60 * 1000);
      current.setHours(startH, startM, 0, 0);
      continue;
    }

    const minutesLeftToday = Math.floor((todayEnd.getTime() - current.getTime()) / 60000);
    if (remaining <= minutesLeftToday) {
      current = new Date(current.getTime() + remaining * 60000);
      remaining = 0;
    } else {
      remaining -= minutesLeftToday;
      current = new Date(current.getTime() + 24 * 60 * 60 * 1000);
      current.setHours(startH, startM, 0, 0);
    }
  }

  // Clamp to avoid unused variable warning
  void businessMinutesPerDay;
  return current;
}

/**
 * Calculate SLA due dates for a given priority and creation time.
 */
export async function calculateSlaDue(
  priority: CasePriority,
  createdAt: Date
): Promise<SlaDueDates> {
  const policy = await db
    .select()
    .from(helpdeskSlaPolicy)
    .where(eq(helpdeskSlaPolicy.priority, priority))
    .limit(1);

  const policyRow = policy[0];
  if (!policyRow) {
    // Default fallback: 8h first response, 48h resolution
    return {
      firstResponseDue: new Date(createdAt.getTime() + 8 * 60 * 60 * 1000),
      resolutionDue: new Date(createdAt.getTime() + 48 * 60 * 60 * 1000),
    };
  }

  const { firstResponseMinutes, resolutionMinutes, businessHoursOnly } = policyRow;

  if (!businessHoursOnly) {
    return {
      firstResponseDue: new Date(createdAt.getTime() + firstResponseMinutes * 60 * 1000),
      resolutionDue: new Date(createdAt.getTime() + resolutionMinutes * 60 * 1000),
    };
  }

  // Business hours calculation
  const [bhStart, bhEnd, bhTz, bhWorkDays] = await Promise.all([
    getPlatformSetting<string>('helpdesk.businessHours.start', '09:00'),
    getPlatformSetting<string>('helpdesk.businessHours.end', '18:00'),
    getPlatformSetting<string>('helpdesk.businessHours.timezone', 'America/New_York'),
    getPlatformSetting<number[]>('helpdesk.businessHours.workDays', [1, 2, 3, 4, 5]),
  ]);

  const config: BusinessHoursConfig = {
    start: bhStart ?? '09:00',
    end: bhEnd ?? '18:00',
    timezone: bhTz ?? 'America/New_York',
    workDays: bhWorkDays ?? [1, 2, 3, 4, 5],
  };

  return {
    firstResponseDue: addBusinessMinutes(createdAt, firstResponseMinutes, config),
    resolutionDue: addBusinessMinutes(createdAt, resolutionMinutes, config),
  };
}
