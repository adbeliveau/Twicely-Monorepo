'use client';

import { useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@twicely/ui/button';
import { CheckoutSummary } from './checkout-summary';
import { PaymentForm } from './payment-form';
import { CheckoutStepAddress } from './checkout-step-address';
import { StripeProvider } from '@/components/providers/stripe-provider';
import { initiateCheckout, finalizeOrder, finalizeOrders } from '@/lib/actions/checkout';
import type { CartWithItems } from '@/lib/queries/cart';
import type { AddressData } from '@/lib/queries/address';
import { ArrowLeft, Loader2 } from 'lucide-react';

interface OrderPaymentInfo {
  orderId: string;
  clientSecret: string;
  paymentIntentId: string;
  amountCents: number;
}

interface CheckoutFlowProps {
  cart: CartWithItems;
  addresses: AddressData[];
  authBuyerFeeCents: number;
  authOfferThresholdCents: number;
}

type CheckoutStep = 1 | 2 | 3;

export function CheckoutFlow({ cart, addresses, authBuyerFeeCents, authOfferThresholdCents }: CheckoutFlowProps) {
  const router = useRouter();
  const [step, setStep] = useState<CheckoutStep>(1);
  const [selectedAddressId, setSelectedAddressId] = useState<string | null>(
    addresses.find((a) => a.isDefault)?.id ?? addresses[0]?.id ?? null
  );
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [orderPayments, setOrderPayments] = useState<OrderPaymentInfo[]>([]);
  const [currentPaymentIndex, setCurrentPaymentIndex] = useState(0);
  const [completedPaymentIntentIds, setCompletedPaymentIntentIds] = useState<string[]>([]);
  const [orderIds, setOrderIds] = useState<string[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // B3.4: Local pickup selection (only when cart supports it)
  const [fulfillmentChoice, setFulfillmentChoice] = useState<'shipping' | 'local_pickup'>('shipping');
  // B3.5: Authentication offer for $500+ items
  const [authenticationRequested, setAuthenticationRequested] = useState(false);
  // D2.3: Applied coupon discount
  const [appliedDiscount, setAppliedDiscount] = useState<{
    promotionId: string;
    promotionName: string;
    discountCents: number;
    freeShipping: boolean;
    couponCode: string;
    appliedToSellerId: string;
  } | null>(null);

  const selectedAddress = addresses.find((a) => a.id === selectedAddressId);
  const isLocalPickup = fulfillmentChoice === 'local_pickup';
  const isMultiSeller = orderPayments.length > 1;
  const currentOrderPayment = orderPayments[currentPaymentIndex];

  // B3.5: Show auth offer if any cart item meets the threshold (e.g. $500+)
  const showAuthOffer = cart.groups.some((group) =>
    group.items.some((item) => item.unitPriceCents >= authOfferThresholdCents)
  );

  const handleContinueToPayment = async () => {
    if (!selectedAddressId || !selectedAddress) {
      setError('Please select a shipping address');
      return;
    }

    // Reuse existing PI if user goes back and forward again
    if ((clientSecret || orderPayments.length > 0) && orderIds.length > 0) {
      setStep(2);
      return;
    }

    setIsProcessing(true);
    setError(null);

    const result = await initiateCheckout({
      cartId: cart.cartId,
      shippingAddress: {
        name: selectedAddress.name,
        address1: selectedAddress.address1,
        address2: selectedAddress.address2,
        city: selectedAddress.city,
        state: selectedAddress.state,
        zip: selectedAddress.zip,
        country: selectedAddress.country,
        phone: selectedAddress.phone,
      },
      isLocalPickup,
      authenticationRequested: showAuthOffer && authenticationRequested,
      // D2.3: Pass coupon data if applied
      coupon: appliedDiscount ? {
        promotionId: appliedDiscount.promotionId,
        couponCode: appliedDiscount.couponCode,
        discountCents: appliedDiscount.discountCents,
        freeShipping: appliedDiscount.freeShipping,
        appliedToSellerId: appliedDiscount.appliedToSellerId,
      } : undefined,
    });

    setIsProcessing(false);

    if (!result.success) {
      setError(result.error ?? 'Failed to initiate checkout');
      return;
    }

    setOrderIds(result.orderIds!);

    // Multi-seller checkout: use orderPayments array
    if (result.orderPayments && result.orderPayments.length > 1) {
      setOrderPayments(result.orderPayments);
      setCurrentPaymentIndex(0);
    } else {
      // Single-seller: use clientSecret directly
      setClientSecret(result.clientSecret!);
    }

    setStep(2);
  };

  const handlePaymentSuccess = useCallback(
    async (paymentIntentId: string) => {
      // For multi-seller checkout, track completed payments
      if (isMultiSeller) {
        const newCompletedIds = [...completedPaymentIntentIds, paymentIntentId];
        setCompletedPaymentIntentIds(newCompletedIds);

        // Check if all payments are done
        if (newCompletedIds.length < orderPayments.length) {
          // Move to next payment
          setCurrentPaymentIndex(currentPaymentIndex + 1);
          return;
        }

        // All payments complete, finalize all orders
        setStep(3);
        setIsProcessing(true);

        const result = await finalizeOrders(newCompletedIds);

        if (result.success) {
          router.push(`/checkout/confirmation/${orderIds[0]}`);
        } else {
          setError(result.error ?? 'Payment processing failed');
          setIsProcessing(false);
        }
      } else {
        // Single-seller checkout
        setStep(3);
        setIsProcessing(true);

        const result = await finalizeOrder(paymentIntentId);

        if (result.success) {
          router.push(`/checkout/confirmation/${orderIds[0]}`);
        } else {
          setError(result.error ?? 'Payment processing failed');
          setIsProcessing(false);
        }
      }
    },
    [orderIds, orderPayments, currentPaymentIndex, completedPaymentIntentIds, isMultiSeller, router]
  );

  const handleBack = () => {
    if (step === 1) {
      router.push('/cart');
    } else if (step === 2) {
      setStep(1);
      setClientSecret(null);
      setOrderPayments([]);
      setCurrentPaymentIndex(0);
      setCompletedPaymentIntentIds([]);
    }
  };

  // B3.4: For local pickup, shipping is $0
  const effectiveShippingCents = isLocalPickup ? 0 : cart.shippingCents;
  // B3.5: Add auth fee if buyer opted in
  const authFeeCents = showAuthOffer && authenticationRequested ? authBuyerFeeCents : 0;
  // D2.3: Apply coupon discount
  const discountCents = appliedDiscount?.discountCents ?? 0;
  const totalCents = Math.max(0, cart.subtotalCents + effectiveShippingCents + authFeeCents - discountCents);

  // Get current client secret (single or multi-seller)
  const currentClientSecret = isMultiSeller
    ? currentOrderPayment?.clientSecret
    : clientSecret;

  const currentOrderId = isMultiSeller
    ? currentOrderPayment?.orderId
    : orderIds[0];

  const currentTotalCents = isMultiSeller
    ? currentOrderPayment?.amountCents ?? 0
    : totalCents;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={handleBack} disabled={step === 3}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <h1 className="text-2xl font-bold">
          {step === 1 && 'Checkout'}
          {step === 2 && (isMultiSeller
            ? `Payment ${currentPaymentIndex + 1} of ${orderPayments.length}`
            : 'Payment')}
          {step === 3 && 'Processing...'}
        </h1>
      </div>

      {/* Progress */}
      <div className="flex gap-2">
        {[1, 2, 3].map((s) => (
          <div
            key={s}
            className={`h-1 flex-1 rounded-full ${
              s <= step ? 'bg-primary' : 'bg-gray-200'
            }`}
          />
        ))}
      </div>

      {/* Multi-seller notice */}
      {step === 2 && isMultiSeller && (
        <div className="rounded-lg bg-blue-50 border border-blue-200 p-4 text-sm text-blue-700">
          <p className="font-medium">Multiple Sellers</p>
          <p>Your cart contains items from {orderPayments.length} different sellers. Each order requires a separate payment.</p>
        </div>
      )}

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="grid gap-8 lg:grid-cols-3">
        {/* Main Content */}
        <div className="lg:col-span-2">
          {step === 1 && (
            <CheckoutStepAddress
              cart={cart}
              addresses={addresses}
              selectedAddressId={selectedAddressId}
              onSelectAddress={setSelectedAddressId}
              fulfillmentChoice={fulfillmentChoice}
              onSelectFulfillment={setFulfillmentChoice}
              authenticationRequested={authenticationRequested}
              onAuthenticationChange={setAuthenticationRequested}
              onDiscountApplied={setAppliedDiscount}
              onContinue={handleContinueToPayment}
              onAddressAdded={() => router.refresh()}
              isProcessing={isProcessing}
              authBuyerFeeCents={authBuyerFeeCents}
              authOfferThresholdCents={authOfferThresholdCents}
            />
          )}

          {step === 2 && currentClientSecret && currentOrderId && (
            <StripeProvider clientSecret={currentClientSecret}>
              <PaymentForm
                onSuccess={handlePaymentSuccess}
                totalCents={currentTotalCents}
                orderId={currentOrderId}
              />
            </StripeProvider>
          )}

          {step === 3 && (
            <div className="rounded-lg border bg-white p-6 text-center">
              <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4 text-primary" />
              <p className="text-muted-foreground">Processing your payment...</p>
            </div>
          )}
        </div>

        {/* Order Summary Sidebar */}
        <div className="lg:col-span-1">
          <CheckoutSummary
            cart={cart}
            selectedAddress={selectedAddress}
            discountCents={discountCents}
            authFeeCents={authFeeCents}
            isLocalPickup={isLocalPickup}
          />
        </div>
      </div>
    </div>
  );
}
