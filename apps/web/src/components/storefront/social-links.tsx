'use client';

import Link from 'next/link';
import { Instagram, Twitter, Youtube, Facebook, Globe, ExternalLink } from 'lucide-react';

interface SocialLinksProps {
  links: Record<string, string>;
  className?: string;
}

const PLATFORM_CONFIG: Record<string, { icon: React.ElementType; label: string }> = {
  instagram: { icon: Instagram, label: 'Instagram' },
  twitter: { icon: Twitter, label: 'Twitter' },
  youtube: { icon: Youtube, label: 'YouTube' },
  facebook: { icon: Facebook, label: 'Facebook' },
  tiktok: { icon: Globe, label: 'TikTok' },
  website: { icon: Globe, label: 'Website' },
};

export function SocialLinks({ links, className = '' }: SocialLinksProps) {
  const entries = Object.entries(links).filter(([, url]) => url && url.trim());
  if (entries.length === 0) return null;

  return (
    <div className={`flex flex-wrap items-center gap-3 ${className}`}>
      {entries.map(([platform, url]) => {
        const config = PLATFORM_CONFIG[platform.toLowerCase()];
        const Icon = config?.icon ?? ExternalLink;
        const label = config?.label ?? platform;
        return (
          <Link
            key={platform}
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 text-sm text-gray-600 hover:text-violet-600 transition-colors"
            title={label}
          >
            <Icon className="h-4 w-4" />
            <span className="sr-only sm:not-sr-only">{label}</span>
          </Link>
        );
      })}
    </div>
  );
}
