import Link from 'next/link';
import { NewsletterSignup } from '@/components/shared/newsletter-signup';

const footerSections = [
  {
    title: 'Buy',
    links: [
      { label: 'Browse', href: '/s' },
      { label: 'Categories', href: '/c' },
      { label: 'How It Works', href: '/p/how-it-works' },
    ],
  },
  {
    title: 'Sell',
    links: [
      { label: 'Start Selling', href: '/sell' },
      { label: 'Fees', href: '/p/fees' },
      { label: 'Seller Dashboard', href: '/my/selling' },
    ],
  },
  {
    title: 'Company',
    links: [
      { label: 'About', href: '/about' },
      { label: 'Help Center', href: '/h' },
      { label: 'Policies', href: '/p/policies' },
    ],
  },
  {
    title: 'Legal',
    links: [
      { label: 'Terms of Service', href: '/p/terms' },
      { label: 'Privacy Policy', href: '/p/privacy' },
      { label: 'Buyer Protection', href: '/p/buyer-protection' },
    ],
  },
];

export function MarketplaceFooter() {
  const currentYear = new Date().getFullYear();

  return (
    <footer role="contentinfo" className="hidden border-t bg-muted/40 md:block">
      <div className="container px-4 py-12 md:px-6">
        <nav aria-label="Footer navigation">
          <div className="grid grid-cols-2 gap-8 md:grid-cols-4">
            {footerSections.map((section) => (
              <div key={section.title}>
                <h3 className="mb-3 text-sm font-semibold">{section.title}</h3>
                <ul className="space-y-2">
                  {section.links.map((link) => (
                    <li key={link.href}>
                      <Link
                        href={link.href}
                        className="text-sm text-muted-foreground hover:text-foreground"
                      >
                        {link.label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </nav>
        <div className="mb-6 flex flex-col items-center gap-3">
          <p className="text-sm font-medium">Get updates from Twicely</p>
          <NewsletterSignup source="HOMEPAGE_FOOTER" />
        </div>
        <div className="mt-8 border-t pt-8">
          <p className="text-center text-sm text-muted-foreground">
            © {currentYear} Twicely. All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  );
}
