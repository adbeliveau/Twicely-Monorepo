interface UsageMappingCardProps {
  usageKey: string;
  description: string | null;
  serviceType: string;
  primaryInstanceName: string;
  fallbackInstanceName: string | null;
  autoFailover: boolean;
  enabled: boolean;
}

export function UsageMappingCard({
  usageKey,
  description,
  serviceType,
  primaryInstanceName,
  fallbackInstanceName,
  autoFailover,
  enabled,
}: UsageMappingCardProps) {
  return (
    <div className={`rounded-lg border bg-white p-4 ${enabled ? 'border-gray-200' : 'border-gray-100 opacity-60'}`}>
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-gray-900">{usageKey}</h3>
        <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-600">{serviceType}</span>
      </div>
      {description && <p className="mt-1 text-xs text-gray-500">{description}</p>}

      <div className="mt-3 space-y-1">
        <div className="flex items-center gap-2 text-xs">
          <span className="font-medium text-gray-600">Primary:</span>
          <span className="text-gray-900">{primaryInstanceName}</span>
        </div>
        {fallbackInstanceName && (
          <div className="flex items-center gap-2 text-xs">
            <span className="font-medium text-gray-600">Fallback:</span>
            <span className="text-gray-900">{fallbackInstanceName}</span>
          </div>
        )}
        <div className="flex items-center gap-2 text-xs">
          <span className="font-medium text-gray-600">Auto-failover:</span>
          <span className={autoFailover ? 'text-green-600' : 'text-gray-400'}>
            {autoFailover ? 'Enabled' : 'Disabled'}
          </span>
        </div>
      </div>
    </div>
  );
}
