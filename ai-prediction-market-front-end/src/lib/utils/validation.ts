// Input validation utilities

/**
 * Check if a string is a valid Solana address
 */
export function isValidSolanaAddress(address: string): boolean {
  if (!address) return false;
  // Solana addresses are base58 encoded and 32-44 characters
  const base58Regex = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;
  return base58Regex.test(address);
}

/**
 * Check if a string is a valid URL
 */
export function isValidUrl(url: string): boolean {
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
}

/**
 * Check if a number is a valid amount (positive, finite)
 */
export function isValidAmount(amount: number): boolean {
  return Number.isFinite(amount) && amount > 0;
}

/**
 * Check if slippage is within valid range
 */
export function isValidSlippage(slippage: number): boolean {
  return Number.isFinite(slippage) && slippage >= 0.1 && slippage <= 50;
}

/**
 * Validate market creation input
 */
export interface MarketValidationResult {
  isValid: boolean;
  errors: Record<string, string>;
}

export function validateMarketCreation(params: {
  name: string;
  metadataUri: string;
  bParameter: number;
}): MarketValidationResult {
  const errors: Record<string, string> = {};

  if (!params.name || params.name.trim().length === 0) {
    errors.name = 'Market name is required';
  } else if (params.name.length > 200) {
    errors.name = 'Market name must be less than 200 characters';
  }

  if (!params.metadataUri || !isValidUrl(params.metadataUri)) {
    errors.metadataUri = 'Valid metadata URL is required';
  }

  if (!params.bParameter || params.bParameter < 1) {
    errors.bParameter = 'B parameter must be at least 1';
  }

  return {
    isValid: Object.keys(errors).length === 0,
    errors,
  };
}

/**
 * Validate swap input
 */
export function validateSwapInput(params: {
  amount: number;
  slippage: number;
  balance: number;
}): MarketValidationResult {
  const errors: Record<string, string> = {};

  if (!isValidAmount(params.amount)) {
    errors.amount = 'Please enter a valid amount';
  } else if (params.amount > params.balance) {
    errors.amount = 'Insufficient balance';
  }

  if (!isValidSlippage(params.slippage)) {
    errors.slippage = 'Slippage must be between 0.1% and 50%';
  }

  return {
    isValid: Object.keys(errors).length === 0,
    errors,
  };
}
