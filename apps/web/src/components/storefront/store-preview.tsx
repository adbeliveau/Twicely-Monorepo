import { cn } from '@twicely/utils/cn';

interface StorePreviewProps {
  storeName: string;
  bannerUrl: string | null;
  logoUrl: string | null;
  accentColor: string | null;
  announcement: string | null;
  aboutHtml: string | null;
  viewport: 'desktop' | 'mobile';
}

export function StorePreview({
  storeName,
  bannerUrl,
  logoUrl,
  accentColor,
  announcement,
  aboutHtml,
  viewport,
}: StorePreviewProps) {
  const accent = accentColor || '#7C3AED';
  const initial = storeName.charAt(0).toUpperCase() || 'S';

  return (
    <div
      className={cn(
        'border rounded-lg overflow-hidden bg-white',
        viewport === 'mobile' && 'max-w-[375px] mx-auto'
      )}
    >
      {/* Banner */}
      {bannerUrl ? (
        <img
          src={bannerUrl}
          alt="Store banner"
          className="w-full aspect-[4/1] object-cover"
        />
      ) : (
        <div className="w-full h-24 bg-muted flex items-center justify-center">
          <span className="text-xs text-muted-foreground">1200 × 300</span>
        </div>
      )}

      {/* Logo */}
      <div className="relative -mt-8 ml-4">
        {logoUrl ? (
          <img
            src={logoUrl}
            alt="Store logo"
            className="h-16 w-16 rounded-full border-2 border-white object-cover"
          />
        ) : (
          <div
            className="h-16 w-16 rounded-full border-2 border-white bg-muted flex items-center justify-center text-xl font-semibold"
            style={{ color: accent }}
          >
            {initial}
          </div>
        )}
      </div>

      {/* Store Name */}
      <div className="px-4 pt-2">
        <h3 className="text-lg font-semibold" style={{ color: accent }}>
          {storeName || 'Store Name'}
        </h3>
      </div>

      {/* Announcement Bar */}
      {announcement && (
        <div
          className="w-full text-white text-sm py-2 px-4 text-center mt-3"
          style={{ backgroundColor: accent }}
        >
          {announcement}
        </div>
      )}

      {/* About Section */}
      {aboutHtml && (
        <div className="p-4 text-sm text-muted-foreground line-clamp-3">
          {aboutHtml}
        </div>
      )}

      {/* Preview Watermark */}
      <p className="text-xs text-muted-foreground/50 text-center py-2 italic">
        Preview
      </p>
    </div>
  );
}
