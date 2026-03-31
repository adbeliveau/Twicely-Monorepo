import { betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { db } from '@twicely/db';
import { user, session, account, verification } from '@twicely/db/schema';
import { logger } from '@twicely/logger';

export const auth = betterAuth({
  database: drizzleAdapter(db, {
    provider: 'pg',
    schema: { user, session, account, verification },
  }),
  user: {
    additionalFields: {
      displayName: {
        type: 'string',
        required: false,
      },
      username: {
        type: 'string',
        required: false,
      },
      bio: {
        type: 'string',
        required: false,
      },
      phone: {
        type: 'string',
        required: false,
      },
      phoneVerified: {
        type: 'boolean',
        required: false,
        defaultValue: false,
      },
      avatarUrl: {
        type: 'string',
        required: false,
      },
      defaultAddressId: {
        type: 'string',
        required: false,
      },
      isSeller: {
        type: 'boolean',
        required: false,
        defaultValue: false,
      },
      buyerQualityTier: {
        type: 'string',
        required: false,
        defaultValue: 'GREEN',
      },
      marketingOptIn: {
        type: 'boolean',
        required: false,
        defaultValue: false,
      },
      isBanned: {
        type: 'boolean',
        required: false,
        defaultValue: false,
      },
      dashboardLayoutJson: {
        type: 'string',
        required: false,
      },
      deletionRequestedAt: {
        type: 'string',
        required: false,
      },
      referredByAffiliateId: {
        type: 'string',
        required: false,
      },
      creditBalanceCents: {
        type: 'number',
        required: false,
        defaultValue: 0,
      },
      bannedAt: {
        type: 'string',
        required: false,
      },
      bannedReason: {
        type: 'string',
        required: false,
      },
    },
  },
  emailAndPassword: {
    enabled: true,
    minPasswordLength: 10,
    maxPasswordLength: 128,
    requireEmailVerification: true,
    sendResetPassword: async ({ user, url }) => {
      logger.info('Password reset email sent', { to: user.email });
      // TODO: Send via Resend — url contains the reset token
      void url; // Suppress unused warning until Resend integration
    },
  },
  emailVerification: {
    sendVerificationEmail: async ({ user, url }) => {
      logger.info('Email verification sent', { to: user.email });
      // TODO: Send via Resend — url contains the verification token
      void url; // Suppress unused warning until Resend integration
    },
  },
  session: {
    cookieCache: {
      enabled: true,
      maxAge: 60 * 5, // 5 minutes
    },
    expiresIn: 60 * 60 * 24 * 7, // 7 days
    updateAge: 60 * 60 * 24, // 1 day
  },
  rateLimit: {
    window: 60, // 1 minute
    max: 10, // 10 requests per minute
  },
  advanced: {
    cookiePrefix: 'twicely',
    useSecureCookies: process.env.NODE_ENV === 'production',
  },
  trustedOrigins: [
    process.env.BETTER_AUTH_URL,
    process.env.NEXT_PUBLIC_APP_URL,
    ...(process.env.NODE_ENV !== 'production'
      ? ['http://localhost:*', 'http://twicely.co:*', 'http://hub.twicely.co:*']
      : []),
  ].filter((v): v is string => Boolean(v)),
});

export type Session = typeof auth.$Infer.Session;

// Extended user type with marketplace fields
export interface UserAdditionalFields {
  displayName?: string | null;
  username?: string | null;
  bio?: string | null;
  phone?: string | null;
  phoneVerified?: boolean;
  avatarUrl?: string | null;
  defaultAddressId?: string | null;
  isSeller?: boolean;
  buyerQualityTier?: string;
  marketingOptIn?: boolean;
  isBanned?: boolean;
  dashboardLayoutJson?: string | null;
  deletionRequestedAt?: string | null;
  referredByAffiliateId?: string | null;
  creditBalanceCents?: number;
  bannedAt?: string | null;
  bannedReason?: string | null;
}

export type ExtendedUser = Session['user'] & UserAdditionalFields;

export interface ExtendedSession {
  session: Session['session'];
  user: ExtendedUser;
}
