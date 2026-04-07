import Link from 'next/link';
import { Logo } from './logo';

const footerSections = [
  {
    title: 'Shop',
    links: [
      { label: 'Women', href: '/c/womens-clothing' },
      { label: 'Men', href: '/c/mens-clothing' },
      { label: 'Luxury', href: '/c/luxury' },
      { label: 'Sneakers', href: '/c/sneakers' },
      { label: 'Home + Local', href: '/c/home' },
    ],
  },
  {
    title: 'Sell',
    links: [
      { label: 'Start selling', href: '/become-seller' },
      { label: 'Import listings', href: '/my/selling/crosslist/import' },
      { label: 'Seller tools', href: '/my/selling' },
      { label: 'Drops', href: '/explore' },
      { label: 'Analytics', href: '/my/selling/analytics' },
    ],
  },
  {
    title: 'Trust',
    links: [
      { label: 'Buyer protection', href: '/p/buyer-protection' },
      { label: 'Verified sellers', href: '/p/how-it-works' },
      { label: 'Authentication', href: '/p/how-it-works' },
      { label: 'Returns policy', href: '/p/terms' },
    ],
  },
  {
    title: 'Company',
    links: [
      { label: 'About', href: '/about' },
      { label: 'Help center', href: '/h' },
      { label: 'Careers', href: '/about' },
      { label: 'Contact', href: '/h/contact' },
    ],
  },
];

export function MarketplaceFooter() {
  const currentYear = new Date().getFullYear();

  return (
    <footer role="contentinfo" className="hidden py-12 md:block">
      <div className="mx-auto max-w-[1380px] px-7">
        <div className="bg-white border border-gray-200 rounded-[28px] p-10 shadow-[0_4px_16px_rgba(20,20,20,0.06)] dark:bg-gray-800 dark:border-gray-700">
          <div className="grid grid-cols-[2fr_1fr_1fr_1fr_1fr] gap-8">
            {/* Brand column */}
            <div>
              <Logo />
              <p className="mt-2.5 text-[13.5px] text-gray-500 leading-relaxed max-w-[240px] dark:text-gray-400">
                The premium resale marketplace. Buy cleaner secondhand listings. Sell once, reach everywhere.
              </p>
            </div>

            {/* Link columns */}
            {footerSections.map((section) => (
              <div key={section.title}>
                <h5 className="text-[11px] font-extrabold tracking-[0.16em] uppercase text-gray-900 mb-3.5 dark:text-white">
                  {section.title}
                </h5>
                <ul className="space-y-2.5">
                  {section.links.map((link) => (
                    <li key={link.label}>
                      <Link
                        href={link.href}
                        className="text-[13.5px] font-semibold text-gray-500 hover:text-brand-500 transition-colors dark:text-gray-400"
                      >
                        {link.label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>

          {/* Bottom bar */}
          <div className="mt-6 pt-5 border-t border-gray-200 flex justify-between items-center dark:border-gray-600">
            <p className="text-[12.5px] font-semibold text-gray-400 dark:text-gray-500">
              &copy; {currentYear} Twicely &middot; Buy. Sell. Repeat.
            </p>
            <p className="text-[12.5px] font-semibold text-gray-400 dark:text-gray-500">
              Made for resale done right.
            </p>
          </div>
        </div>
      </div>
    </footer>
  );
}
