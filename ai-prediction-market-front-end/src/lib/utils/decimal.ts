import { DECIMAL_MULTIPLIER, USDC_DECIMALS } from './constants';

/**
 * Convert a raw integer value (from blockchain) to a decimal float
 * @param value - Raw integer value (e.g., 1000000 for 1.0 USDC)
 * @param decimals - Number of decimal places (default: 6 for USDC)
 * @returns Float value (e.g., 1.0)
 */
export function toDecimal(value: number | bigint | { toNumber: () => number } | null | undefined, decimals = USDC_DECIMALS): number {
  if (value === null || value === undefined) return 0;

  const numValue = typeof value === 'object' && 'toNumber' in value
    ? value.toNumber()
    : Number(value);

  return numValue / (10 ** decimals);
}

/**
 * Convert a decimal float to raw integer value (for blockchain)
 * @param value - Float value (e.g., 1.0 USDC)
 * @param decimals - Number of decimal places (default: 6 for USDC)
 * @returns Raw integer value (e.g., 1000000)
 */
export function fromDecimal(value: number, decimals = USDC_DECIMALS): number {
  return Math.floor(value * (10 ** decimals));
}

/**
 * Safely extract a number from a BN-like object
 * @param value - BN object or number
 * @param fallback - Fallback value if extraction fails
 * @returns Number value
 */
export function safeToNumber(value: { toNumber: () => number } | number | null | undefined, fallback = 0): number {
  if (value === null || value === undefined) return fallback;
  if (typeof value === 'number') return value;
  try {
    return value.toNumber();
  } catch {
    return fallback;
  }
}

/**
 * Format a raw blockchain value as a decimal string
 * @param value - Raw integer value
 * @param decimals - Number of decimal places
 * @param displayDecimals - Number of decimal places to display
 * @returns Formatted string (e.g., "1.00")
 */
export function formatDecimal(
  value: number | bigint | { toNumber: () => number } | null | undefined,
  decimals = USDC_DECIMALS,
  displayDecimals = 2
): string {
  return toDecimal(value, decimals).toFixed(displayDecimals);
}
