import { createOrdersFromCart } from './create-order';
import type { CreateOrderInput, OrderCreationResult } from './order-gmv';

/**
 * Create a single order (for single-seller checkout).
 */
export async function createOrder(input: CreateOrderInput): Promise<OrderCreationResult> {
  const results = await createOrdersFromCart(input);
  return results[0] ?? { success: false, error: 'No order created' };
}
