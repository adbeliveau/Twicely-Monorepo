'use server';

import { z } from 'zod';
import { staffAuthorize } from '@twicely/casl/staff-authorize';
import { ForbiddenError } from '@twicely/casl/authorize';
import { getAnalyticsTimeSeries, type TimeSeriesPoint } from '@/lib/queries/admin-analytics';

const fetchTimeSeriesSchema = z.object({
  metric: z.enum(['gmv', 'orders', 'users', 'fees']),
  periodDays: z.union([z.literal(7), z.literal(30), z.literal(90)]),
}).strict();

export async function fetchAnalyticsTimeSeries(
  metric: 'gmv' | 'orders' | 'users' | 'fees',
  periodDays: number
): Promise<TimeSeriesPoint[]> {
  const { ability } = await staffAuthorize();

  if (!ability.can('read', 'Analytics')) {
    throw new ForbiddenError('Analytics read access required');
  }

  const parsed = fetchTimeSeriesSchema.safeParse({ metric, periodDays });
  if (!parsed.success) {
    throw new Error('Invalid metric or periodDays value');
  }

  return getAnalyticsTimeSeries(parsed.data.metric, parsed.data.periodDays);
}
