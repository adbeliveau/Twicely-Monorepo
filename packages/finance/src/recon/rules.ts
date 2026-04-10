/**
 * Finance Reconciliation Rules
 * Severity classification, auto-resolve logic, and rule CRUD.
 * Canonical 31 Section 5.2.
 */

import { db } from "@twicely/db";
import { reconRule } from "@twicely/db/schema";
import { eq } from "drizzle-orm";
import { createId } from "@paralleldrive/cuid2";

import type { Variance, Severity, VarianceType } from "./types";

/** Classify severity per Canonical 31 Section 5.2 */
export function classifyVarianceSeverity(variance: Variance): Severity {
  const absCents = Math.abs(variance.varianceAmountCents);

  if (variance.type === "TIMING_DIFFERENCE") return "LOW";
  if (variance.type === "AMOUNT_MISMATCH" && absCents < 100) return "LOW";
  if (variance.type === "AMOUNT_MISMATCH" && absCents < 10000) return "MEDIUM";
  if (variance.type === "ORPHANED_LEDGER_ENTRY") return "CRITICAL";
  if (variance.type === "DUPLICATE_STRIPE_EVENT") return "HIGH";
  if (absCents >= 10000) return "HIGH";
  return "MEDIUM";
}

/** Determine if a variance should be auto-resolved (Canonical 31 Section 8.1) */
export function shouldAutoResolve(variance: Variance, autoResolveRoundingCents: number): boolean {
  if (variance.type === "TIMING_DIFFERENCE") return true;
  if (
    variance.type === "AMOUNT_MISMATCH" &&
    Math.abs(variance.varianceAmountCents) < autoResolveRoundingCents
  ) {
    return true;
  }
  return false;
}

export async function getReconRules() {
  return db.select().from(reconRule).orderBy(reconRule.name);
}

export async function upsertReconRule(input: {
  id?: string;
  name: string;
  description?: string;
  varianceType: VarianceType;
  thresholdCents: number;
  thresholdPercent?: number;
  autoResolveBelow: number;
  isActive?: boolean;
}) {
  if (input.id) {
    const [updated] = await db
      .update(reconRule)
      .set({
        name: input.name,
        description: input.description ?? null,
        varianceType: input.varianceType,
        thresholdCents: input.thresholdCents,
        thresholdPercent: input.thresholdPercent ?? null,
        autoResolveBelow: input.autoResolveBelow,
        isActive: input.isActive ?? true,
        updatedAt: new Date(),
      })
      .where(eq(reconRule.id, input.id))
      .returning();
    return updated;
  }

  const [inserted] = await db
    .insert(reconRule)
    .values({
      id: createId(),
      name: input.name,
      description: input.description ?? null,
      varianceType: input.varianceType,
      thresholdCents: input.thresholdCents,
      thresholdPercent: input.thresholdPercent ?? null,
      autoResolveBelow: input.autoResolveBelow,
      isActive: input.isActive ?? true,
    })
    .returning();
  return inserted;
}

export async function seedDefaultRules() {
  const defaults: Array<{
    name: string;
    varianceType: VarianceType;
    thresholdCents: number;
    autoResolveBelow: number;
    description: string;
  }> = [
    {
      name: "Amount Mismatch Rounding",
      varianceType: "AMOUNT_MISMATCH",
      thresholdCents: 100,
      autoResolveBelow: 100,
      description: "Auto-resolve amount mismatches below $1",
    },
    {
      name: "Timing Difference",
      varianceType: "TIMING_DIFFERENCE",
      thresholdCents: 0,
      autoResolveBelow: 999999999,
      description: "Auto-resolve all timing differences within 48h lookback",
    },
    {
      name: "Unmatched Stripe Event",
      varianceType: "UNMATCHED_STRIPE_EVENT",
      thresholdCents: 10000,
      autoResolveBelow: 0,
      description: "Flag unmatched Stripe events; never auto-resolve",
    },
    {
      name: "Orphaned Ledger Entry",
      varianceType: "ORPHANED_LEDGER_ENTRY",
      thresholdCents: 0,
      autoResolveBelow: 0,
      description: "Flag orphaned ledger entries; never auto-resolve",
    },
    {
      name: "Duplicate Stripe Event",
      varianceType: "DUPLICATE_STRIPE_EVENT",
      thresholdCents: 0,
      autoResolveBelow: 0,
      description: "Flag duplicate Stripe events; never auto-resolve",
    },
  ];

  for (const rule of defaults) {
    const existing = await db
      .select({ id: reconRule.id })
      .from(reconRule)
      .where(eq(reconRule.name, rule.name))
      .limit(1);

    if (existing.length === 0) {
      await db.insert(reconRule).values({
        id: createId(),
        name: rule.name,
        varianceType: rule.varianceType,
        thresholdCents: rule.thresholdCents,
        autoResolveBelow: rule.autoResolveBelow,
        description: rule.description,
      });
    }
  }
}

export async function getAutoResolveThreshold(varianceType: VarianceType): Promise<number> {
  const [rule] = await db
    .select({ autoResolveBelow: reconRule.autoResolveBelow })
    .from(reconRule)
    .where(eq(reconRule.varianceType, varianceType))
    .limit(1);
  return rule?.autoResolveBelow ?? 0;
}
