import type { UserDetailFull } from '@/lib/queries/admin-users';

type AddressType = 'REGISTRATION' | 'SHIPPING' | 'SHIP_FROM' | 'RETURN' | 'PICKUP';

const ADDRESS_TYPE_LABELS: Record<AddressType, { title: string; description: string }> = {
  REGISTRATION: { title: 'Registration address', description: 'Main contact address for account verification' },
  SHIPPING: { title: 'Shipping address', description: 'Default address for receiving purchases' },
  SHIP_FROM: { title: 'Ship from address', description: 'Address where packages are shipped from' },
  RETURN: { title: 'Return address', description: 'Address for buyer returns' },
  PICKUP: { title: 'Pickup address', description: 'Address for local pickup orders' },
};

interface Props {
  user: UserDetailFull;
}

export function OverviewAddressesSection({ user: u }: Props) {
  return (
    <div className="rounded-2xl bg-white shadow-sm dark:bg-gray-800">
      <div className="border-b border-gray-100 px-6 py-4 dark:border-gray-700">
        <h3 className="font-bold text-gray-900 dark:text-white">Addresses</h3>
        <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">User addresses by type</p>
      </div>
      <div className="divide-y divide-gray-100 dark:divide-gray-700">
        {(Object.keys(ADDRESS_TYPE_LABELS) as AddressType[]).map((addressType) => {
          const typeInfo = ADDRESS_TYPE_LABELS[addressType];
          // Find matching address by label (the monorepo uses label instead of type)
          const addr = u.addresses?.find((a) => a.label === addressType) ?? null;

          return (
            <div key={addressType} className="flex items-center justify-between px-6 py-4">
              <div className="flex-1">
                <p className="font-medium text-gray-900 dark:text-white">{typeInfo.title}</p>
                <p className="text-sm text-gray-500 dark:text-gray-400">{typeInfo.description}</p>
                {addr && (
                  <div className="mt-2 text-sm text-gray-700 dark:text-gray-300">
                    <p>{addr.city}, {addr.state} {addr.zip}</p>
                    <div className="mt-1 flex gap-2">
                      {addr.isDefault && (
                        <span className="rounded bg-brand-100 px-1.5 py-0.5 text-xs font-medium text-brand-700 dark:bg-brand-900/30 dark:text-brand-400">
                          Default
                        </span>
                      )}
                    </div>
                  </div>
                )}
              </div>
              <button
                className="rounded-full border border-brand-500 px-4 py-1.5 text-sm font-medium text-brand-600 hover:bg-brand-50 dark:border-brand-400 dark:text-brand-400 dark:hover:bg-brand-900/20"
                disabled
              >
                {addr ? 'Edit' : 'Add'}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
