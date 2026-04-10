/**
 * Tax receipt generator — itemized receipts for orders
 */

export type ReceiptInput = {
  orderId: string;
  orderNumber: string;
  subtotalCents: number;
  shippingCents: number;
  taxCents: number;
  totalCents: number;
  taxBreakdown: { jurisdiction: string; rateBasisPoints: number; taxCents: number }[];
  buyerName: string;
  buyerAddress: string;
  sellerName: string;
  purchasedAt: Date;
};

export type ReceiptOutput = {
  html: string;
  plainText: string;
};

export function generateReceipt(input: ReceiptInput): ReceiptOutput {
  const { orderNumber, subtotalCents, shippingCents, taxCents, totalCents, taxBreakdown, buyerName, sellerName, purchasedAt } = input;

  const formatCents = (cents: number): string => `$${(cents / 100).toFixed(2)}`;
  const dateStr = purchasedAt.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });

  const taxLines = taxBreakdown.map(t =>
    `  ${t.jurisdiction}: ${(t.rateBasisPoints / 100).toFixed(2)}% = ${formatCents(t.taxCents)}`
  ).join('\n');

  const plainText = [
    `TWICELY - Order Receipt`,
    `Order #${orderNumber}`,
    `Date: ${dateStr}`,
    ``,
    `Buyer: ${buyerName}`,
    `Seller: ${sellerName}`,
    ``,
    `Subtotal: ${formatCents(subtotalCents)}`,
    `Shipping: ${formatCents(shippingCents)}`,
    taxLines ? `Tax:\n${taxLines}` : `Tax: ${formatCents(taxCents)}`,
    ``,
    `Total: ${formatCents(totalCents)}`,
  ].join('\n');

  const html = `<div class="receipt">
<h2>Twicely - Order Receipt</h2>
<p>Order #${orderNumber} &mdash; ${dateStr}</p>
<table>
<tr><td>Subtotal</td><td>${formatCents(subtotalCents)}</td></tr>
<tr><td>Shipping</td><td>${formatCents(shippingCents)}</td></tr>
<tr><td>Tax</td><td>${formatCents(taxCents)}</td></tr>
<tr><td><strong>Total</strong></td><td><strong>${formatCents(totalCents)}</strong></td></tr>
</table>
</div>`;

  return { html, plainText };
}
