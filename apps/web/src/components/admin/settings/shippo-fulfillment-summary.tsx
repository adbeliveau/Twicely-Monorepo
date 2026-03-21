interface FulfillmentSettings {
  defaultHandlingDays: number;
  maxHandlingDays: number;
  trackingRequiredAboveCents: number;
  signatureRequiredAboveCents: number;
  defaultCarrier: string;
  labelGenerationEnabled: boolean;
  autoInsureAboveCents: number;
  returnsWindowDays: number;
}

interface Props {
  settings: FulfillmentSettings;
}

function cents(v: number): string {
  return `$${(v / 100).toFixed(2)}`;
}

function Row({ label, value }: { label: string; value: string | number | boolean }) {
  const display = typeof value === 'boolean'
    ? (value ? 'Enabled' : 'Disabled')
    : String(value);
  return (
    <div className="flex items-center justify-between border-b border-gray-100 px-4 py-2.5 last:border-b-0">
      <span className="text-sm text-gray-700">{label}</span>
      <span className="text-sm font-semibold text-gray-900">{display}</span>
    </div>
  );
}

export function ShippoFulfillmentSummary({ settings }: Props) {
  return (
    <div className="rounded-lg border border-gray-200 bg-white">
      <div className="border-b border-gray-100 px-4 py-3">
        <h3 className="text-sm font-semibold text-gray-900">Fulfillment Settings</h3>
        <p className="text-xs text-gray-400">Current platform defaults from platform_settings</p>
      </div>
      <Row label="Default Handling Time" value={`${settings.defaultHandlingDays} days`} />
      <Row label="Max Handling Time" value={`${settings.maxHandlingDays} days`} />
      <Row label="Tracking Required Above" value={cents(settings.trackingRequiredAboveCents)} />
      <Row label="Signature Required Above" value={cents(settings.signatureRequiredAboveCents)} />
      <Row label="Default Carrier" value={settings.defaultCarrier} />
      <Row label="Label Generation" value={settings.labelGenerationEnabled} />
      <Row label="Auto-Insure Above" value={cents(settings.autoInsureAboveCents)} />
      <Row label="Return Window" value={`${settings.returnsWindowDays} days`} />
    </div>
  );
}
