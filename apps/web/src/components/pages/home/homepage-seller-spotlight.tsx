import Link from 'next/link';

/**
 * Seller spotlight / CTA banner. Visual design from V2 (public) homepage.
 * Encourages visitors to start selling on Twicely.
 */
export function HomepageSellerSpotlight() {
  return (
    <section className="bg-gradient-to-r from-gray-900 to-gray-800 text-white">
      <div className="mx-auto max-w-[1584px] px-4 py-10 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 items-center gap-6 md:grid-cols-2">
          <div>
            <p className="mb-1 text-sm font-semibold uppercase tracking-wider text-blue-400">
              Seller spotlight
            </p>
            <h2 className="text-2xl font-bold sm:text-3xl">Turn your closet into cash</h2>
            <p className="mt-3 max-w-lg text-gray-300">
              Join thousands of sellers earning money on Twicely. List your items in minutes, set
              your price, and ship when sold. No upfront costs.
            </p>
            <Link
              href="/become-seller"
              className="mt-5 inline-flex items-center gap-2 rounded-full bg-white px-6 py-2.5 text-sm font-semibold text-gray-900 transition-colors hover:bg-gray-100"
            >
              Start Selling Today
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M17 8l4 4m0 0l-4 4m4-4H3" />
              </svg>
            </Link>
          </div>
          <div className="grid grid-cols-3 gap-4 text-center">
            <div>
              <p className="text-3xl font-bold">0%</p>
              <p className="mt-1 text-sm text-gray-400">Listing fees</p>
            </div>
            <div>
              <p className="text-3xl font-bold">3 Days</p>
              <p className="mt-1 text-sm text-gray-400">Avg. to sell</p>
            </div>
            <div>
              <p className="text-3xl font-bold">24hr</p>
              <p className="mt-1 text-sm text-gray-400">Fast payouts</p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
