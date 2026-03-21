export default function ConversationLoading() {
  return (
    <div className="max-w-3xl mx-auto h-full flex flex-col">
      {/* Header skeleton */}
      <div className="flex items-center gap-3 border-b px-4 py-3 bg-white">
        <div className="h-5 w-5 bg-gray-200 rounded animate-pulse" />
        <div className="h-5 w-48 bg-gray-200 rounded animate-pulse" />
      </div>

      {/* Message bubbles skeleton */}
      <div className="flex-1 px-4 py-4 space-y-4">
        {/* Left bubble */}
        <div className="flex justify-start">
          <div className="h-7 w-7 rounded-full bg-gray-200 animate-pulse mr-2 self-end" />
          <div className="rounded-lg bg-gray-100 animate-pulse h-12 w-56" />
        </div>
        {/* Right bubble */}
        <div className="flex justify-end">
          <div className="rounded-lg bg-gray-100 animate-pulse h-10 w-48" />
          <div className="h-7 w-7 rounded-full bg-gray-200 animate-pulse ml-2 self-end" />
        </div>
        {/* Left bubble */}
        <div className="flex justify-start">
          <div className="h-7 w-7 rounded-full bg-gray-200 animate-pulse mr-2 self-end" />
          <div className="rounded-lg bg-gray-100 animate-pulse h-16 w-64" />
        </div>
        {/* Right bubble */}
        <div className="flex justify-end">
          <div className="rounded-lg bg-gray-100 animate-pulse h-8 w-36" />
          <div className="h-7 w-7 rounded-full bg-gray-200 animate-pulse ml-2 self-end" />
        </div>
      </div>

      {/* Compose area skeleton */}
      <div className="border-t px-4 py-4">
        <div className="h-20 bg-gray-100 rounded animate-pulse mb-2" />
        <div className="h-8 w-16 bg-gray-200 rounded animate-pulse ml-auto" />
      </div>
    </div>
  );
}
