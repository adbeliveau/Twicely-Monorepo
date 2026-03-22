/**
 * Trust / value proposition bar. Visual design from V2 (public) homepage.
 * Shows Money Back Guarantee, Free Shipping, Easy Returns.
 */
export function HomepageTrustBar() {
  return (
    <section className="bg-gray-50 dark:bg-gray-800/50">
      <div className="mx-auto max-w-[1584px] px-4 py-6 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          {/* Money Back Guarantee */}
          <div className="flex items-center gap-4 rounded-xl bg-white p-5 dark:bg-gray-800">
            <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-full bg-blue-100 dark:bg-blue-900/30">
              <svg className="h-6 w-6 text-blue-600 dark:text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
              </svg>
            </div>
            <div>
              <p className="text-sm font-bold text-gray-900 dark:text-white">Money Back Guarantee</p>
              <p className="text-xs text-gray-500 dark:text-gray-400">Full refund if item not as described</p>
            </div>
          </div>

          {/* Free Shipping */}
          <div className="flex items-center gap-4 rounded-xl bg-white p-5 dark:bg-gray-800">
            <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-full bg-green-100 dark:bg-green-900/30">
              <svg className="h-6 w-6 text-green-600 dark:text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
              </svg>
            </div>
            <div>
              <p className="text-sm font-bold text-gray-900 dark:text-white">Free Shipping</p>
              <p className="text-xs text-gray-500 dark:text-gray-400">On orders over $50</p>
            </div>
          </div>

          {/* Easy Returns */}
          <div className="flex items-center gap-4 rounded-xl bg-white p-5 dark:bg-gray-800">
            <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-full bg-purple-100 dark:bg-purple-900/30">
              <svg className="h-6 w-6 text-purple-600 dark:text-purple-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
              </svg>
            </div>
            <div>
              <p className="text-sm font-bold text-gray-900 dark:text-white">Easy Returns</p>
              <p className="text-xs text-gray-500 dark:text-gray-400">30-day hassle-free returns</p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
