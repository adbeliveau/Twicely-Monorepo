export default function Loading() {
  return (
    <div className="animate-pulse space-y-6 p-6">
      <div className="grid gap-8 md:grid-cols-2">
        <div className="aspect-square rounded-lg bg-gray-200" />
        <div className="space-y-4">
          <div className="h-8 w-3/4 rounded bg-gray-200" />
          <div className="h-6 w-1/3 rounded bg-gray-200" />
          <div className="h-4 w-full rounded bg-gray-200" />
          <div className="h-4 w-2/3 rounded bg-gray-200" />
          <div className="h-12 w-full rounded bg-gray-200" />
        </div>
      </div>
    </div>
  );
}
