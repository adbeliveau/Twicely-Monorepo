import { db } from '@twicely/db';
import { bannedKeyword } from '@twicely/db/schema';
import { getPlatformSetting } from '@twicely/db/queries/platform-settings';
import { and, eq } from 'drizzle-orm';
import { logger } from '@twicely/logger';

/**
 * Built-in contact info patterns — always checked regardless of DB keywords.
 */
export const CONTACT_PATTERNS: RegExp[] = [
  /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/gi,
  /\b\d{3}[-.\s]?\d{3}[-.\s]?\d{4}\b/g,
  /\b\+\d{1,3}[-.\s]?\d{6,14}\b/g,
  /@[a-zA-Z0-9_]{1,15}\b/g,
  /\b(instagram|snapchat|whatsapp|telegram|facebook|venmo|cashapp|paypal)\b/gi,
  /https?:\/\/[^\s]+/gi,
];

const MAX_STORED_REGEX_LENGTH = 256;

function compileStoredKeywordRegex(keyword: string): RegExp {
  if (keyword.length > MAX_STORED_REGEX_LENGTH) {
    throw new Error('Stored keyword regex is too long');
  }
  const regexFactory = RegExp;
  return regexFactory(keyword, 'gi');
}

export type FilterResult = {
  action: 'allow' | 'flag' | 'block';
  matchedKeywords: string[];
  reason?: string;
};

/**
 * Filter a message body against built-in contact patterns and DB-stored banned keywords.
 * Returns the strictest action found (block > flag > allow).
 */
export async function filterMessage(body: string): Promise<FilterResult> {
  const enabled = await getPlatformSetting('messaging.keywordFilter.enabled', true);

  if (!enabled) {
    return { action: 'allow', matchedKeywords: [] };
  }

  const matchedKeywords: string[] = [];
  let highestAction: 'allow' | 'flag' | 'block' = 'allow';

  // Check built-in contact patterns
  for (const pattern of CONTACT_PATTERNS) {
    // Reset lastIndex for global regexes
    pattern.lastIndex = 0;
    const match = pattern.exec(body);
    if (match) {
      matchedKeywords.push(match[0]);
      // Contact info patterns always trigger 'flag' at minimum
      if (highestAction === 'allow') {
        highestAction = 'flag';
      }
    }
  }

  // Check DB-stored banned keywords
  try {
    const keywords = await db
      .select()
      .from(bannedKeyword)
      .where(and(eq(bannedKeyword.isActive, true)));

    for (const kw of keywords) {
      let matched = false;

      if (kw.isRegex) {
        try {
          const regex = compileStoredKeywordRegex(kw.keyword);
          matched = regex.test(body);
        } catch {
          logger.warn('Invalid regex in banned keyword', { keywordId: kw.id, keyword: kw.keyword });
          continue;
        }
      } else {
        matched = body.toLowerCase().includes(kw.keyword.toLowerCase());
      }

      if (matched) {
        matchedKeywords.push(kw.keyword);

        if (kw.action === 'block') {
          highestAction = 'block';
        } else if (kw.action === 'flag' && highestAction !== 'block') {
          highestAction = 'flag';
        }
      }
    }
  } catch (err) {
    logger.error('Failed to fetch banned keywords from DB', { error: err });
    // Fail open for DB errors — still return contact pattern matches
  }

  if (matchedKeywords.length === 0) {
    return { action: 'allow', matchedKeywords: [] };
  }

  const reason =
    highestAction === 'block'
      ? 'Message blocked: prohibited content detected'
      : 'Message flagged for review: potential policy violation';

  logger.info('Message filtered', {
    action: highestAction,
    matchCount: matchedKeywords.length,
  });

  return { action: highestAction, matchedKeywords, reason };
}
