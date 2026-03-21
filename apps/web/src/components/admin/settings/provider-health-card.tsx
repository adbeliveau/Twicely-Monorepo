interface ProviderHealthCardProps {
  title: string;
  value: number;
  status: 'green' | 'yellow' | 'red' | 'gray';
}

const STATUS_COLORS = {
  green: 'border-green-200 bg-green-50',
  yellow: 'border-yellow-200 bg-yellow-50',
  red: 'border-red-200 bg-red-50',
  gray: 'border-gray-200 bg-gray-50',
};

const VALUE_COLORS = {
  green: 'text-green-700',
  yellow: 'text-yellow-700',
  red: 'text-red-700',
  gray: 'text-gray-500',
};

export function ProviderHealthCard({ title, value, status }: ProviderHealthCardProps) {
  return (
    <div className={`rounded-lg border p-4 ${STATUS_COLORS[status]}`}>
      <p className="text-xs font-medium text-gray-600">{title}</p>
      <p className={`mt-1 text-2xl font-bold ${VALUE_COLORS[status]}`}>{value}</p>
    </div>
  );
}
