import { betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { db } from '@twicely/db';
import { user, session, account, verification } from '@/lib/db/schema/auth';
import { logger } from '@twicely/logger';
import { sendEmail } from '@twicely/email/send';
import { createElement } from 'react';

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
      completedPurchaseCount: {
        type: 'number',
        required: false,
        defaultValue: 0,
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
    sendResetPassword: async ({ user: u, url }) => {
      logger.info('Password reset email sending', { to: u.email });
      await sendEmail({
        to: u.email,
        subject: 'Reset your Twicely password',
        react: createElement('div', null,
          createElement('h2', null, 'Reset Your Password'),
          createElement('p', null, `Hi ${u.name ?? 'there'}, click the link below to reset your password.`),
          createElement('a', { href: url, style: { color: '#2563eb' } }, 'Reset Password'),
          createElement('p', { style: { fontSize: '12px', color: '#6b7280' } }, 'This link expires in 1 hour. If you did not request this, ignore this email.'),
        ),
      });
    },
  },
  emailVerification: {
    sendVerificationEmail: async ({ user: u, url }) => {
      logger.info('Email verification sending', { to: u.email });
      await sendEmail({
        to: u.email,
        subject: 'Verify your Twicely email',
        react: createElement('div', null,
          createElement('h2', null, 'Verify Your Email'),
          createElement('p', null, `Hi ${u.name ?? 'there'}, click the link below to verify your email address.`),
          createElement('a', { href: url, style: { color: '#2563eb' } }, 'Verify Email'),
          createElement('p', { style: { fontSize: '12px', color: '#6b7280' } }, 'If you did not create a Twicely account, ignore this email.'),
        ),
      });
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
    process.env.BETTER_AUTH_URL || 'http://localhost:3000',
  ],
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
  completedPurchaseCount?: number;
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
