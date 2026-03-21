import type { ReactElement } from 'react';
import type { TemplateKey } from './templates';

import OfferDeclinedEmail from '@twicely/email/templates/offer-declined';
import OfferAcceptedEmail from '@twicely/email/templates/offer-accepted';
import OfferReceivedEmail from '@twicely/email/templates/offer-received';
import OfferCounteredEmail from '@twicely/email/templates/offer-countered';
import OfferExpiredEmail from '@twicely/email/templates/offer-expired';
import OrderConfirmedEmail from '@twicely/email/templates/order-confirmed';
import OrderShippedEmail from '@twicely/email/templates/order-shipped';
import PriceDropEmail from '@twicely/email/templates/price-drop';
import WatcherOfferEmail from '@twicely/email/templates/watcher-offer';
import CategoryAlertEmail from '@twicely/email/templates/category-alert';
import TrialEndingEmail from '@twicely/email/templates/trial-ending';
import TrialExpiredEmail from '@twicely/email/templates/trial-expired';
import ReturnRequestEmail from '@twicely/email/templates/return-request';
import ReturnApprovedEmail from '@twicely/email/templates/return-approved';
import ReturnDeclinedEmail from '@twicely/email/templates/return-declined';
import QaNewQuestionEmail from '@twicely/email/templates/qa-new-question';
import QaAnswerReceivedEmail from '@twicely/email/templates/qa-answer-received';
import NewMessageEmail from '@twicely/email/templates/new-message';
import PriceAlertTriggeredEmail from '@twicely/email/templates/price-alert-triggered';
import PriceAlertBackInStockEmail from '@twicely/email/templates/price-alert-back-in-stock';
import ShippingQuoteRequestedEmail from '@twicely/email/templates/shipping-quote-requested';
import ShippingQuoteReceivedEmail from '@twicely/email/templates/shipping-quote-received';
import ShippingQuoteDisputedEmail from '@twicely/email/templates/shipping-quote-disputed';
import ShippingQuotePenaltyEmail from '@twicely/email/templates/shipping-quote-penalty';
import ShippingQuoteDeadlineMissedEmail from '@twicely/email/templates/shipping-quote-deadline-missed';

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://twicely.co';

export function getEmailComponent(key: TemplateKey, data: Record<string, string>): ReactElement | null {
  switch (key) {
    case 'offer.declined':
      return (
        <OfferDeclinedEmail
          buyerName={data.recipientName ?? 'there'}
          itemTitle={data.itemTitle ?? 'Item'}
          offerAmountFormatted={data.offerAmountFormatted ?? '$0.00'}
          listingUrl={data.listingUrl ?? BASE_URL}
        />
      );
    case 'offer.accepted':
      return (
        <OfferAcceptedEmail
          buyerName={data.recipientName ?? 'there'}
          itemTitle={data.itemTitle ?? 'Item'}
          offerAmountFormatted={data.offerAmountFormatted ?? '$0.00'}
          orderUrl={data.orderUrl ?? BASE_URL}
        />
      );
    case 'offer.received':
      return (
        <OfferReceivedEmail
          sellerName={data.recipientName ?? 'there'}
          itemTitle={data.itemTitle ?? 'Item'}
          offerAmountFormatted={data.offerAmountFormatted ?? '$0.00'}
          offersUrl={data.offersUrl ?? `${BASE_URL}/my/selling/offers`}
        />
      );
    case 'offer.countered':
      return (
        <OfferCounteredEmail
          recipientName={data.recipientName ?? 'there'}
          itemTitle={data.itemTitle ?? 'Item'}
          counterAmountFormatted={data.counterAmountFormatted ?? '$0.00'}
          offersUrl={data.offersUrl ?? BASE_URL}
        />
      );
    case 'offer.expired':
      return (
        <OfferExpiredEmail
          buyerName={data.recipientName ?? 'there'}
          itemTitle={data.itemTitle ?? 'Item'}
          offerAmountFormatted={data.offerAmountFormatted ?? '$0.00'}
          listingUrl={data.listingUrl ?? BASE_URL}
        />
      );
    case 'order.confirmed':
      return (
        <OrderConfirmedEmail
          buyerName={data.recipientName ?? 'there'}
          orderNumber={data.orderNumber ?? 'ORD-000'}
          totalFormatted={data.totalFormatted ?? '$0.00'}
          orderUrl={data.orderUrl ?? BASE_URL}
        />
      );
    case 'order.shipped':
      return (
        <OrderShippedEmail
          buyerName={data.recipientName ?? 'there'}
          orderNumber={data.orderNumber ?? 'ORD-000'}
          trackingUrl={data.trackingUrl || null}
          orderUrl={data.orderUrl ?? BASE_URL}
        />
      );
    case 'watchlist.price_drop':
      return (
        <PriceDropEmail
          recipientName={data.recipientName ?? 'there'}
          itemTitle={data.itemTitle ?? 'Item'}
          oldPriceFormatted={data.oldPriceFormatted ?? '$0.00'}
          newPriceFormatted={data.newPriceFormatted ?? '$0.00'}
          listingUrl={data.listingUrl ?? BASE_URL}
        />
      );
    case 'watchlist.watcher_offer':
      return (
        <WatcherOfferEmail
          recipientName={data.recipientName ?? 'there'}
          itemTitle={data.itemTitle ?? 'Item'}
          originalPriceFormatted={data.originalPriceFormatted ?? '$0.00'}
          discountedPriceFormatted={data.discountedPriceFormatted ?? '$0.00'}
          listingUrl={data.listingUrl ?? BASE_URL}
        />
      );
    case 'search.new_match':
      return (
        <CategoryAlertEmail
          recipientName={data.recipientName ?? 'there'}
          categoryName={data.categoryName ?? 'Category'}
          itemTitle={data.itemTitle ?? 'Item'}
          priceFormatted={data.priceFormatted ?? '$0.00'}
          listingUrl={data.listingUrl ?? BASE_URL}
        />
      );
    case 'subscription.trial_ending':
      return (
        <TrialEndingEmail
          recipientName={data.recipientName ?? 'there'}
          productName={data.productName ?? 'Twicely'}
          daysRemaining={parseInt(data.daysRemaining ?? '3', 10)}
          trialEndDate={data.trialEndDate ?? ''}
          upgradeUrl={data.upgradeUrl ?? `${BASE_URL}/my/selling/subscription`}
        />
      );
    case 'subscription.trial_expired':
      return (
        <TrialExpiredEmail
          recipientName={data.recipientName ?? 'there'}
          productName={data.productName ?? 'Twicely'}
          upgradeUrl={data.upgradeUrl ?? `${BASE_URL}/my/selling/subscription`}
        />
      );
    case 'return.requested':
      return (
        <ReturnRequestEmail
          sellerName={data.recipientName ?? 'there'}
          orderNumber={data.orderNumber ?? 'ORD-000'}
          itemTitle={data.itemTitle ?? 'Item'}
          reason={data.reason ?? 'Return'}
          description={data.description ?? ''}
          responseDueDate={data.responseDueDate ?? ''}
          returnUrl={data.returnUrl ?? `${BASE_URL}/my/selling/returns`}
        />
      );
    case 'return.approved':
      return (
        <ReturnApprovedEmail
          buyerName={data.recipientName ?? 'there'}
          orderNumber={data.orderNumber ?? 'ORD-000'}
          itemTitle={data.itemTitle ?? 'Item'}
          returnInstructions={data.returnInstructions ?? 'Please ship the item back within 7 days using the provided label.'}
          returnUrl={data.returnUrl ?? `${BASE_URL}/my/buying/returns`}
        />
      );
    case 'return.declined':
      return (
        <ReturnDeclinedEmail
          buyerName={data.recipientName ?? 'there'}
          orderNumber={data.orderNumber ?? 'ORD-000'}
          itemTitle={data.itemTitle ?? 'Item'}
          declineReason={data.declineReason ?? 'The return request did not meet the seller\'s return policy.'}
          escalateUrl={data.escalateUrl ?? `${BASE_URL}/my/buying/returns`}
          helpUrl={data.helpUrl ?? `${BASE_URL}/h`}
        />
      );
    case 'qa.new_question':
      return (
        <QaNewQuestionEmail
          recipientName={data.recipientName ?? 'there'}
          askerName={data.askerName ?? 'Someone'}
          itemTitle={data.itemTitle ?? 'Item'}
          questionText={data.questionText ?? ''}
          listingUrl={data.listingUrl ?? BASE_URL}
        />
      );
    case 'qa.answer_received':
      return (
        <QaAnswerReceivedEmail
          recipientName={data.recipientName ?? 'there'}
          itemTitle={data.itemTitle ?? 'Item'}
          answerText={data.answerText ?? ''}
          listingUrl={data.listingUrl ?? BASE_URL}
        />
      );
    case 'messaging.new_message':
      return (
        <NewMessageEmail
          senderName={data.senderName ?? 'Someone'}
          itemTitle={data.itemTitle ?? 'Item'}
          messagePreview={data.messagePreview ?? ''}
          conversationUrl={data.conversationUrl ?? `${BASE_URL}/my/messages`}
        />
      );
    case 'price_alert.triggered':
      return (
        <PriceAlertTriggeredEmail
          itemTitle={data.itemTitle ?? 'Item'}
          oldPriceCents={data.oldPriceCents ?? '0'}
          newPriceCents={data.newPriceCents ?? '0'}
          listingUrl={data.listingUrl ?? BASE_URL}
        />
      );
    case 'price_alert.back_in_stock':
      return (
        <PriceAlertBackInStockEmail
          itemTitle={data.itemTitle ?? 'Item'}
          listingUrl={data.listingUrl ?? BASE_URL}
        />
      );
    case 'shipping_quote.requested':
      return (
        <ShippingQuoteRequestedEmail
          orderNumber={data.orderNumber ?? 'ORD-000'}
          itemCount={data.itemCount ?? '1'}
          deadlineFormatted={data.deadlineFormatted ?? ''}
          maxShippingFormatted={data.maxShippingFormatted ?? ''}
          quotesUrl={data.quotesUrl ?? `${BASE_URL}/my/selling/orders`}
        />
      );
    case 'shipping_quote.received':
      return (
        <ShippingQuoteReceivedEmail
          orderNumber={data.orderNumber ?? 'ORD-000'}
          sellerName={data.sellerName ?? 'Seller'}
          quotedAmountFormatted={data.quotedAmountFormatted ?? '$0.00'}
          savingsFormatted={data.savingsFormatted ?? '$0.00'}
          orderUrl={data.orderUrl ?? `${BASE_URL}/my/buying/orders`}
        />
      );
    case 'shipping_quote.disputed':
      return (
        <ShippingQuoteDisputedEmail
          orderNumber={data.orderNumber ?? 'ORD-000'}
          buyerName={data.buyerName ?? 'Buyer'}
          supportUrl={data.supportUrl ?? `${BASE_URL}/h`}
        />
      );
    case 'shipping_quote.penalty_applied':
      return (
        <ShippingQuotePenaltyEmail
          orderNumber={data.orderNumber ?? 'ORD-000'}
          originalShippingFormatted={data.originalShippingFormatted ?? '$0.00'}
          discountedShippingFormatted={data.discountedShippingFormatted ?? '$0.00'}
          savingsFormatted={data.savingsFormatted ?? '$0.00'}
          orderUrl={data.orderUrl ?? `${BASE_URL}/my/buying/orders`}
        />
      );
    case 'shipping_quote.deadline_missed':
      return (
        <ShippingQuoteDeadlineMissedEmail
          orderNumber={data.orderNumber ?? 'ORD-000'}
          penaltyPercent={data.penaltyPercent ?? '0'}
          discountedShippingFormatted={data.discountedShippingFormatted ?? '$0.00'}
          quotesUrl={data.quotesUrl ?? `${BASE_URL}/my/selling/orders`}
        />
      );
    // Stub cases for templates that use in-app only or will be added later
    case 'order.delivered':
    case 'order.canceled':
    case 'return.shipped':
    case 'return.received':
    case 'return.auto_approved':
    case 'dispute.opened':
    case 'dispute.resolved':
    case 'protection.claim_submitted':
    case 'shipping.exception':
    case 'shipping_quote.accepted':
      return null;
    default:
      return null;
  }
}
