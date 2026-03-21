interface ShippingAddressProps {
  address: {
    name: string;
    address1: string;
    address2?: string;
    city: string;
    state: string;
    zip: string;
    country: string;
  };
}

export function ShippingAddressCard({ address }: ShippingAddressProps) {
  return (
    <div className="rounded-lg border bg-white p-6">
      <h2 className="font-semibold mb-4">Shipping Address</h2>
      <div className="text-sm">
        <p className="font-medium">{address.name}</p>
        <p className="text-gray-600">{address.address1}</p>
        {address.address2 && (
          <p className="text-gray-600">{address.address2}</p>
        )}
        <p className="text-gray-600">
          {address.city}, {address.state} {address.zip}
        </p>
        <p className="text-gray-600">{address.country}</p>
      </div>
    </div>
  );
}
