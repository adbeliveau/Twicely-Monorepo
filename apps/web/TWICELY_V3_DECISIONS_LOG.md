# Twicely V3 Decisions Log

## Architecture

- **FVF rounding:** Calculated on aggregate per line item, not per-unit.
  Formula: `calculateFvf(priceCents × quantity, shippingCents × quantity, feeBucket, storeTier)`.
  Single `Math.round` per line item. Platform-favorable on fractional cents.
