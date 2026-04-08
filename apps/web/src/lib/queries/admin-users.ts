/**
 * Admin User Management Queries (E3.2 / I2.1)
 * User list, search, and enriched detail queries for /usr
 */

import { db } from '@twicely/db';
import {
  user, sellerProfile, businessInfo, storeSubscription, listerSubscription,
  sellerBalance, address, storefront,
} from '@twicely/db/schema';
import { eq, or, ilike, count, desc, sql, and, asc } from 'drizzle-orm';
import { escapeLike } from '@twicely/utils/escape-like';

// ─── Types ────────────────────────────────────────────────────────────────────

interface UserListItem {
  id: string;
  name: string;
  email: string;
  isSeller: boolean;
  isBanned: boolean;
  createdAt: Date;
  orderCount: number;
  sellerType: string | null;
  storeTier: string | null;
  performanceBand: string | null;
}

interface UserListResult {
  users: UserListItem[];
  total: number;
}

export interface UserDetailFull {
  id: string;
  name: string;
  email: string;
  username: string | null;
  displayName: string | null;
  phone: string | null;
  phoneVerified: boolean;
  emailVerified: boolean;
  avatarUrl: string | null;
  isSeller: boolean;
  isBanned: boolean;
  bannedAt: Date | null;
  bannedReason: string | null;
  completedPurchaseCount: number;
  marketingOptIn: boolean;
  creditBalanceCents: number;
  deletionRequestedAt: Date | null;
  createdAt: Date;
  seller: {
    id: string;
    sellerType: string;
    storeTier: string;
    listerTier: string;
    bundleTier: string;
    hasAutomation: boolean;
    financeTier: string;
    performanceBand: string;
    sellerScore: number;
    trustScore: number;
    status: string;
    payoutsEnabled: boolean;
    stripeAccountId: string | null;
    stripeOnboarded: boolean;
    handlingTimeDays: number;
    vacationMode: boolean;
    activatedAt: Date | null;
    verifiedAt: Date | null;
    enforcementLevel: string | null;
    warningExpiresAt: Date | null;
    bandOverride: string | null;
    bandOverrideExpiresAt: Date | null;
    bandOverrideReason: string | null;
    bandOverrideBy: string | null;
    boostCreditCents: number;
    isNew: boolean;
  } | null;
  business: {
    businessName: string;
    businessType: string;
    city: string;
    state: string;
    country: string;
    phone: string | null;
    website: string | null;
  } | null;
  storeSubscription: {
    tier: string;
    status: string;
    currentPeriodEnd: Date | null;
    cancelAtPeriodEnd: boolean;
    stripeSubscriptionId: string | null;
    trialEndsAt: Date | null;
  } | null;
  listerSubscription: {
    tier: string;
    status: string;
    currentPeriodEnd: Date | null;
    cancelAtPeriodEnd: boolean;
  } | null;
  balance: {
    pendingCents: number;
    availableCents: number;
    reservedCents: number;
  } | null;
  addresses: Array<{
    id: string;
    label: string | null;
    city: string;
    state: string;
    zip: string;
    isDefault: boolean;
  }>;
  storefront: {
    slug: string | null;
    name: string | null;
    isPublished: boolean;
  } | null;
}

// ─── Queries ─────────────────────────────────────────────────────────────────

export async function getAdminUserList(opts: {
  page: number;
  pageSize: number;
  search?: string;
  sellerOnly?: boolean;
  status?: 'active' | 'banned';
  sellerType?: string;
  storeTier?: string;
  performanceBand?: string;
  sort?: 'newest' | 'oldest' | 'name';
}): Promise<UserListResult> {
  const { page, pageSize, search, sellerOnly, status, sort } = opts;
  const offset = (page - 1) * pageSize;

  const conditions = [];
  if (search) {
    const escaped = escapeLike(search);
    conditions.push(or(
      ilike(user.name, `%${escaped}%`),
      ilike(user.email, `%${escaped}%`),
      ilike(user.username, `%${escaped}%`)
    ));
  }
  if (sellerOnly) conditions.push(eq(user.isSeller, true));
  if (status === 'active') conditions.push(eq(user.isBanned, false));
  if (status === 'banned') conditions.push(eq(user.isBanned, true));

  const where = conditions.length > 0 ? and(...conditions) : undefined;
  const orderBy = sort === 'oldest' ? asc(user.createdAt) : sort === 'name' ? asc(user.name) : desc(user.createdAt);

  const [totalResult] = await db
    .select({ count: count() })
    .from(user)
    .leftJoin(sellerProfile, eq(sellerProfile.userId, user.id))
    .where(where);

  const rows = await db
    .select({
      id: user.id,
      name: user.name,
      email: user.email,
      isSeller: user.isSeller,
      isBanned: user.isBanned,
      createdAt: user.createdAt,
      orderCount: sql<number>`(SELECT COUNT(*) FROM "order" WHERE buyer_id = ${user.id})`,
      sellerType: sellerProfile.sellerType,
      storeTier: sellerProfile.storeTier,
      performanceBand: sellerProfile.performanceBand,
    })
    .from(user)
    .leftJoin(sellerProfile, eq(sellerProfile.userId, user.id))
    .where(where)
    .orderBy(orderBy)
    .limit(pageSize)
    .offset(offset);

  return {
    users: rows.map((r) => ({ ...r, orderCount: Number(r.orderCount) })),
    total: totalResult?.count ?? 0,
  };
}

export async function getAdminUserDetail(userId: string): Promise<UserDetailFull | null> {
  const [row] = await db
    .select({
      id: user.id, name: user.name, email: user.email, username: user.username,
      displayName: user.displayName, phone: user.phone, phoneVerified: user.phoneVerified,
      emailVerified: user.emailVerified, avatarUrl: user.avatarUrl,
      isSeller: user.isSeller, isBanned: user.isBanned, bannedAt: user.bannedAt,
      bannedReason: user.bannedReason, completedPurchaseCount: user.completedPurchaseCount,
      marketingOptIn: user.marketingOptIn, creditBalanceCents: user.creditBalanceCents,
      deletionRequestedAt: user.deletionRequestedAt, createdAt: user.createdAt,
    })
    .from(user).where(eq(user.id, userId)).limit(1);

  if (!row) return null;

  const [spRow, bizRow, addrs, sf] = await Promise.all([
    db.select().from(sellerProfile).where(eq(sellerProfile.userId, userId)).limit(1),
    db.select({
      businessName: businessInfo.businessName, businessType: businessInfo.businessType,
      city: businessInfo.city, state: businessInfo.state, country: businessInfo.country,
      phone: businessInfo.phone, website: businessInfo.website,
    }).from(businessInfo).where(eq(businessInfo.userId, userId)).limit(1),
    db.select({
      id: address.id, label: address.label, city: address.city,
      state: address.state, zip: address.zip, isDefault: address.isDefault,
    }).from(address).where(eq(address.userId, userId)).orderBy(desc(address.isDefault)),
    db.select({
      slug: storefront.slug, name: storefront.name, isPublished: storefront.isPublished,
    }).from(storefront).where(eq(storefront.ownerUserId, userId)).limit(1),
  ]);

  const sp = spRow[0] ?? null;

  const subResults = sp
    ? await Promise.all([
        db.select({
          tier: storeSubscription.tier, status: storeSubscription.status,
          currentPeriodEnd: storeSubscription.currentPeriodEnd,
          cancelAtPeriodEnd: storeSubscription.cancelAtPeriodEnd,
          stripeSubscriptionId: storeSubscription.stripeSubscriptionId,
          trialEndsAt: storeSubscription.trialEndsAt,
        }).from(storeSubscription).where(eq(storeSubscription.sellerProfileId, sp.id)).limit(1),
        db.select({
          tier: listerSubscription.tier, status: listerSubscription.status,
          currentPeriodEnd: listerSubscription.currentPeriodEnd,
          cancelAtPeriodEnd: listerSubscription.cancelAtPeriodEnd,
        }).from(listerSubscription).where(eq(listerSubscription.sellerProfileId, sp.id)).limit(1),
        db.select({
          pendingCents: sellerBalance.pendingCents, availableCents: sellerBalance.availableCents,
          reservedCents: sellerBalance.reservedCents,
        }).from(sellerBalance).where(eq(sellerBalance.userId, userId)).limit(1),
      ])
    : null;

  const storeSub = subResults?.[0] ?? [];
  const listerSub = subResults?.[1] ?? [];
  const bal = subResults?.[2] ?? [];

  const maskedStripe = sp?.stripeAccountId ? `acct_****${sp.stripeAccountId.slice(-4)}` : null;

  return {
    ...row,
    seller: sp ? {
      id: sp.id, sellerType: sp.sellerType, storeTier: sp.storeTier,
      listerTier: sp.listerTier, bundleTier: sp.bundleTier, hasAutomation: sp.hasAutomation,
      financeTier: sp.financeTier, performanceBand: sp.performanceBand,
      sellerScore: sp.sellerScore, trustScore: sp.trustScore, status: sp.status,
      payoutsEnabled: sp.payoutsEnabled, stripeAccountId: maskedStripe,
      stripeOnboarded: sp.stripeOnboarded, handlingTimeDays: sp.handlingTimeDays,
      vacationMode: sp.vacationMode, activatedAt: sp.activatedAt, verifiedAt: sp.verifiedAt,
      enforcementLevel: sp.enforcementLevel, warningExpiresAt: sp.warningExpiresAt,
      bandOverride: sp.bandOverride ?? null, bandOverrideExpiresAt: sp.bandOverrideExpiresAt,
      bandOverrideReason: sp.bandOverrideReason, bandOverrideBy: sp.bandOverrideBy,
      boostCreditCents: sp.boostCreditCents,
      isNew: sp.isNew,
    } : null,
    business: bizRow[0] ?? null,
    storeSubscription: storeSub[0] ?? null,
    listerSubscription: listerSub[0] ?? null,
    balance: bal[0] ?? null,
    addresses: addrs,
    storefront: sf[0] ?? null,
  };
}
