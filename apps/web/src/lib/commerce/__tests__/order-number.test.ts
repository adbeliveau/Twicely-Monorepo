import { describe, it, expect } from 'vitest';
import { generateOrderNumber } from '../order-number';

describe('generateOrderNumber', () => {
  it('matches expected format TWC-YYMMDD-XXXXX', () => {
    const orderNumber = generateOrderNumber();
    expect(orderNumber).toMatch(/^TWC-\d{6}-[A-Z0-9]{5}$/);
  });

  it('generates unique order numbers on consecutive calls', () => {
    const orderNumber1 = generateOrderNumber();
    const orderNumber2 = generateOrderNumber();
    expect(orderNumber1).not.toBe(orderNumber2);
  });

  it('includes correct date portion (YYMMDD)', () => {
    const orderNumber = generateOrderNumber();
    const now = new Date();

    const year = String(now.getFullYear()).slice(-2);
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const expectedDatePortion = `${year}${month}${day}`;

    const datePortion = orderNumber.split('-')[1];
    expect(datePortion).toBe(expectedDatePortion);
  });

  it('has TWC prefix', () => {
    const orderNumber = generateOrderNumber();
    expect(orderNumber.startsWith('TWC-')).toBe(true);
  });

  it('has 5-character random suffix with uppercase alphanumeric only', () => {
    const orderNumber = generateOrderNumber();
    const randomPart = orderNumber.split('-')[2];
    expect(randomPart).toHaveLength(5);
    expect(randomPart).toMatch(/^[A-Z0-9]{5}$/);
  });

  it('generates many unique order numbers', () => {
    const orderNumbers = new Set<string>();
    for (let i = 0; i < 100; i++) {
      orderNumbers.add(generateOrderNumber());
    }
    expect(orderNumbers.size).toBe(100);
  });
});
