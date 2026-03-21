export default function MessagesLoading() {
  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      <div className="h-8 w-36 bg-gray-200 rounded mb-8 animate-pulse" />
      <div className="divide-y divide-gray-200 rounded-lg border border-gray-200 bg-white">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="flex items-start gap-3 p-4">
            {/* Avatar skeleton */}
            <div className="h-10 w-10 rounded-full bg-gray-200 animate-pulse shrink-0" />
            {/* Content skeleton */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between mb-2">
                <div className="h-4 w-32 bg-gray-200 rounded animate-pulse" />
                <div className="h-3 w-16 bg-gray-100 rounded animate-pulse" />
              </div>
              <div className="h-3 w-48 bg-gray-100 rounded animate-pulse" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
