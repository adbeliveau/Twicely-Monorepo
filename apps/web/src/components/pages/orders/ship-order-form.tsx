'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { shipOrder } from '@/lib/actions/orders';
import { fetchShippingRates, purchaseShippingLabel } from '@/lib/actions/shipping';
import type { ShippingRate } from '@/lib/shipping/shippo/rates';
import { Button } from '@twicely/ui/button';
import { Label } from '@twicely/ui/label';
import { Input } from '@twicely/ui/input';

interface ShipOrderFormProps {
  orderId: string;
}

export function ShipOrderForm({ orderId }: ShipOrderFormProps) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<'manual' | 'label'>('manual');
  const [carrier, setCarrier] = useState('USPS');
  const [trackingNumber, setTrackingNumber] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Label tab state
  const [rates, setRates] = useState<ShippingRate[]>([]);
  const [isLoadingRates, setIsLoadingRates] = useState(false);
  const [selectedRateId, setSelectedRateId] = useState<string | null>(null);
  const [ratesError, setRatesError] = useState<string | null>(null);

  async function loadShippingRates() {
    setIsLoadingRates(true);
    setRatesError(null);

    try {
      const result = await fetchShippingRates(orderId);

      if (!result.success || !result.rates) {
        setRatesError(result.error || 'Failed to fetch shipping rates');
        setIsLoadingRates(false);
        return;
      }

      setRates(result.rates);
      setIsLoadingRates(false);
    } catch {
      setRatesError('An unexpected error occurred');
      setIsLoadingRates(false);
    }
  }

  // Fetch rates when label tab is selected
  useEffect(() => {
    if (activeTab === 'label' && rates.length === 0 && !isLoadingRates && !ratesError) {
      loadShippingRates();
    }
  }, [activeTab, rates.length, isLoadingRates, ratesError, orderId]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);

    try {
      const result = await shipOrder(orderId, carrier, trackingNumber);

      if (!result.success) {
        setError(result.error ?? 'Failed to ship order');
        setIsSubmitting(false);
        return;
      }

      // Success - redirect to order detail
      router.push(`/my/selling/orders/${orderId}`);
    } catch {
      setError('An unexpected error occurred');
      setIsSubmitting(false);
    }
  }

  async function handlePurchaseLabel() {
    if (!selectedRateId) return;

    setRatesError(null);
    setIsSubmitting(true);

    try {
      const result = await purchaseShippingLabel(orderId, selectedRateId);

      if (!result.success) {
        setRatesError(result.error || 'Failed to purchase label');
        setIsSubmitting(false);
        return;
      }

      // Success - redirect to order detail
      if (result.redirectUrl) {
        router.push(result.redirectUrl);
      }
    } catch {
      setRatesError('An unexpected error occurred');
      setIsSubmitting(false);
    }
  }

  return (
    <div className="space-y-6">
      {/* Tab buttons */}
      <div className="border-b border-gray-200">
        <nav className="-mb-px flex space-x-8">
          <button
            type="button"
            onClick={() => setActiveTab('manual')}
            className={
              activeTab === 'manual'
                ? 'border-primary text-primary whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm'
            }
          >
            Enter Tracking
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('label')}
            className={
              activeTab === 'label'
                ? 'border-primary text-primary whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm'
            }
          >
            Buy Label
          </button>
        </nav>
      </div>

      {/* Manual tracking tab */}
      {activeTab === 'manual' && (
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Carrier */}
      <div>
        <Label htmlFor="carrier">Carrier *</Label>
        <select
          id="carrier"
          value={carrier}
          onChange={(e) => setCarrier(e.target.value)}
          className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-ring focus:ring-ring sm:text-sm"
          required
        >
          <option value="USPS">USPS</option>
          <option value="UPS">UPS</option>
          <option value="FEDEX">FedEx</option>
          <option value="OTHER">Other</option>
        </select>
      </div>

      {/* Tracking Number */}
      <div>
        <Label htmlFor="tracking">Tracking Number *</Label>
        <Input
          id="tracking"
          type="text"
          value={trackingNumber}
          onChange={(e) => setTrackingNumber(e.target.value)}
          placeholder="Enter tracking number"
          minLength={5}
          maxLength={40}
          pattern="[A-Za-z0-9-]+"
          title="Letters, numbers, and hyphens only"
          required
          className="mt-1"
        />
        <p className="mt-1 text-xs text-gray-500">
          5-40 characters, alphanumeric and hyphens only
        </p>
      </div>

      {/* Error message */}
      {error && (
        <div className="rounded-md bg-red-50 p-4">
          <p className="text-sm text-red-800">{error}</p>
        </div>
      )}

          {/* Submit button */}
          <div className="flex gap-3">
            <Button
              type="submit"
              disabled={isSubmitting}
              className="flex-1"
            >
              {isSubmitting ? 'Shipping...' : 'Ship Order'}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => router.back()}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
          </div>
        </form>
      )}

      {/* Buy label tab */}
      {activeTab === 'label' && (
        <div className="space-y-4">
          {/* Loading state */}
          {isLoadingRates && (
            <div className="rounded-lg border bg-gray-50 p-8 text-center">
              <p className="text-sm text-gray-600">Loading shipping rates...</p>
            </div>
          )}

          {/* Error state */}
          {ratesError && !isLoadingRates && (
            <div className="rounded-md bg-red-50 p-4">
              <p className="text-sm text-red-800">{ratesError}</p>
              <Button
                onClick={loadShippingRates}
                variant="outline"
                className="mt-3"
                size="sm"
              >
                Retry
              </Button>
            </div>
          )}

          {/* Rates list */}
          {!isLoadingRates && !ratesError && rates.length > 0 && (
            <>
              <div className="text-sm text-gray-600 mb-2">
                Package: 10x8x4 in, 16 oz (default dimensions)
              </div>
              <div className="space-y-3">
                {rates.map((rate) => (
                  <button
                    key={rate.objectId}
                    type="button"
                    onClick={() => setSelectedRateId(rate.objectId)}
                    className={`w-full rounded-lg border p-4 text-left transition-colors ${
                      selectedRateId === rate.objectId
                        ? 'border-primary bg-primary/10'
                        : 'border-gray-200 bg-white hover:border-gray-300'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <div className="font-medium text-gray-900">
                          {rate.carrier}
                        </div>
                        <div className="text-sm text-gray-600">
                          {rate.service}
                          {rate.estimatedDays && (
                            <span className="ml-2">
                              • {rate.estimatedDays} day{rate.estimatedDays !== 1 ? 's' : ''}
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="font-semibold text-gray-900">
                          ${rate.amount.toFixed(2)}
                        </div>
                      </div>
                    </div>
                  </button>
                ))}
              </div>

              {/* Purchase button */}
              <div className="pt-2">
                <Button
                  onClick={handlePurchaseLabel}
                  disabled={!selectedRateId || isSubmitting}
                  className="w-full"
                >
                  {isSubmitting ? 'Purchasing...' : 'Purchase Label'}
                </Button>
              </div>
            </>
          )}

          {/* Empty state */}
          {!isLoadingRates && !ratesError && rates.length === 0 && (
            <div className="rounded-lg border bg-gray-50 p-8 text-center">
              <p className="text-sm text-gray-600">No shipping rates available</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
