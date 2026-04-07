import Link from 'next/link';
import Image from 'next/image';

// Stock photos from Unsplash for each category slug
const CATEGORY_IMAGES: Record<string, string> = {
  electronics:
    'https://images.unsplash.com/photo-1468495244123-6c6c332eeece?w=600&h=400&fit=crop&q=80',
  'apparel-accessories':
    'https://images.unsplash.com/photo-1445205170230-053b83016050?w=600&h=400&fit=crop&q=80',
  'collectibles-luxury':
    'https://images.unsplash.com/photo-1600003014755-ba31aa59c4b6?w=600&h=400&fit=crop&q=80',
  'home-garden':
    'https://images.unsplash.com/photo-1616486338812-3dadae4b4ace?w=600&h=400&fit=crop&q=80',
  'womens-clothing':
    'https://images.unsplash.com/photo-1558171813-01342dfc331c?w=600&h=400&fit=crop&q=80',
  'mens-clothing':
    'https://images.unsplash.com/photo-1507680434567-5739c80be1ac?w=600&h=400&fit=crop&q=80',
  luxury:
    'https://images.unsplash.com/photo-1600003014755-ba31aa59c4b6?w=600&h=400&fit=crop&q=80',
  sneakers:
    'https://images.unsplash.com/photo-1552346154-21d32810aba3?w=600&h=400&fit=crop&q=80',
  home: 'https://images.unsplash.com/photo-1616486338812-3dadae4b4ace?w=600&h=400&fit=crop&q=80',
  kids: 'https://images.unsplash.com/photo-1596461404969-9ae70f2830c1?w=600&h=400&fit=crop&q=80',
  accessories:
    'https://images.unsplash.com/photo-1606760227091-3dd870d97f1d?w=600&h=400&fit=crop&q=80',
  beauty:
    'https://images.unsplash.com/photo-1596462502278-27bfdc403348?w=600&h=400&fit=crop&q=80',
  vintage:
    'https://images.unsplash.com/photo-1558618666-fcd25c85f82e?w=600&h=400&fit=crop&q=80',
  sports:
    'https://images.unsplash.com/photo-1461896836934-bd45ba76e830?w=600&h=400&fit=crop&q=80',
};

const FALLBACK_IMAGE =
  'https://images.unsplash.com/photo-1441986300917-64674bd600d8?w=600&h=400&fit=crop&q=80';

interface CategoryData {
  id: string;
  name: string;
  slug: string;
  listingCount: number;
}

interface Props {
  categories: CategoryData[];
}

export function LandingCategories({ categories }: Props) {
  const topCategories = [...categories]
    .sort((a, b) => b.listingCount - a.listingCount)
    .slice(0, 8);

  if (topCategories.length === 0) return null;

  // Responsive columns: use what we have
  const colClass =
    topCategories.length <= 3
      ? 'grid-cols-1 sm:grid-cols-2 md:grid-cols-3'
      : topCategories.length <= 4
        ? 'grid-cols-2 md:grid-cols-4'
        : topCategories.length <= 6
          ? 'grid-cols-2 md:grid-cols-3 lg:grid-cols-6'
          : 'grid-cols-2 md:grid-cols-3 lg:grid-cols-4';

  return (
    <section className="bg-white py-14 reveal">
      <div className="mx-auto max-w-[1380px] px-7">
        <div className="flex items-end justify-between mb-7 gap-4">
          <div>
            <div className="section-label">Browse</div>
            <div className="section-title">Find what you love</div>
          </div>
          <Link href="/c" className="btn-ghost">
            Browse all &rarr;
          </Link>
        </div>
        <div className={`grid ${colClass} gap-4`}>
          {topCategories.map((cat) => {
            const imageUrl = CATEGORY_IMAGES[cat.slug] || FALLBACK_IMAGE;
            return (
              <Link
                key={cat.id}
                href={`/c/${cat.slug}`}
                className="group relative overflow-hidden rounded-[20px] border border-[var(--l-border)] bg-white transition-all duration-200 hover:-translate-y-1 hover:shadow-[0_12px_32px_rgba(20,20,20,0.1)] hover:border-[var(--mg)]"
              >
                <div className="relative h-[160px] overflow-hidden">
                  <Image
                    src={imageUrl}
                    alt={cat.name}
                    fill
                    className="object-cover transition-transform duration-300 group-hover:scale-105"
                    sizes="(max-width: 768px) 50vw, (max-width: 1024px) 33vw, 250px"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent" />
                  <div className="absolute bottom-3 left-4 right-4">
                    <div className="text-[15px] font-black text-white tracking-tight">
                      {cat.name}
                    </div>
                    <div className="text-[11px] font-semibold text-white/70">
                      {cat.listingCount.toLocaleString()} items
                    </div>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      </div>
    </section>
  );
}
