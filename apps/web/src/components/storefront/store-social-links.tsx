'use client';

import { Instagram, Youtube, Globe } from 'lucide-react';
import { Button } from '@twicely/ui/button';

// TikTok and X icons (not in lucide-react standard set)
function TikTokIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor">
      <path d="M19.59 6.69a4.83 4.83 0 01-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 01-5.2 1.74 2.89 2.89 0 012.31-4.64 2.93 2.93 0 01.88.13V9.4a6.84 6.84 0 00-1-.05A6.33 6.33 0 005 20.1a6.34 6.34 0 0010.86-4.43v-7a8.16 8.16 0 004.77 1.52v-3.4a4.85 4.85 0 01-1-.1z" />
    </svg>
  );
}

function XIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor">
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
    </svg>
  );
}

interface StoreSocialLinksProps {
  instagram?: string | null;
  youtube?: string | null;
  tiktok?: string | null;
  twitter?: string | null;
  website?: string | null;
}

export function StoreSocialLinks({ instagram, youtube, tiktok, twitter, website }: StoreSocialLinksProps) {
  const links = [
    { url: instagram, icon: Instagram, label: 'Instagram' },
    { url: youtube, icon: Youtube, label: 'YouTube' },
    { url: tiktok, icon: TikTokIcon, label: 'TikTok' },
    { url: twitter, icon: XIcon, label: 'X (Twitter)' },
    { url: website, icon: Globe, label: 'Website' },
  ].filter((link) => link.url);

  if (links.length === 0) return null;

  return (
    <div className="flex gap-1">
      {links.map(({ url, icon: Icon, label }) => (
        <Button key={label} variant="ghost" size="icon" asChild className="h-8 w-8">
          <a href={url!} target="_blank" rel="noopener noreferrer" aria-label={label}>
            <Icon className="h-4 w-4" />
          </a>
        </Button>
      ))}
    </div>
  );
}
