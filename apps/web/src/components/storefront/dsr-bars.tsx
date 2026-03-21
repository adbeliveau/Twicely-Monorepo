interface DSRBarsProps {
  avgItemAsDescribed: number | null;
  avgShippingSpeed: number | null;
  avgCommunication: number | null;
  avgPackaging: number | null;
}

const DSR_LABELS: Record<string, string> = {
  avgItemAsDescribed: 'Item as Described',
  avgShippingSpeed: 'Shipping Speed',
  avgCommunication: 'Communication',
  avgPackaging: 'Packaging',
};

export function DSRBars({
  avgItemAsDescribed,
  avgShippingSpeed,
  avgCommunication,
  avgPackaging,
}: DSRBarsProps) {
  const metrics = [
    { key: 'avgItemAsDescribed', value: avgItemAsDescribed },
    { key: 'avgShippingSpeed', value: avgShippingSpeed },
    { key: 'avgCommunication', value: avgCommunication },
    { key: 'avgPackaging', value: avgPackaging },
  ];

  const hasAnyData = metrics.some((m) => m.value !== null);
  if (!hasAnyData) {
    return (
      <p className="text-sm text-gray-500">No detailed ratings yet.</p>
    );
  }

  return (
    <div className="space-y-3">
      {metrics.map(({ key, value }) => (
        <div key={key} className="space-y-1">
          <div className="flex items-center justify-between text-sm">
            <span className="text-gray-700">{DSR_LABELS[key]}</span>
            <span className="font-medium text-gray-900">
              {value !== null ? value.toFixed(1) : '—'}
            </span>
          </div>
          <div className="h-2 w-full rounded-full bg-gray-100">
            {value !== null && (
              <div
                className="h-2 rounded-full bg-violet-500 transition-all"
                style={{ width: `${(value / 5) * 100}%` }}
              />
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
