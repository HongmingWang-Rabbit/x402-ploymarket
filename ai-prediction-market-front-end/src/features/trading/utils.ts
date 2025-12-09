// Trading utility functions

/**
 * Calculate the cost of buying shares using LMSR
 */
export function calculateLMSRCost(
  currentQYes: number,
  currentQNo: number,
  deltaShares: number,
  tokenType: 'yes' | 'no',
  bParameter: number
): number {
  const isYes = tokenType === 'yes';
  const newQYes = isYes ? currentQYes + deltaShares : currentQYes;
  const newQNo = isYes ? currentQNo : currentQNo + deltaShares;

  const currentCost =
    bParameter * Math.log(Math.exp(currentQYes / bParameter) + Math.exp(currentQNo / bParameter));
  const newCost =
    bParameter * Math.log(Math.exp(newQYes / bParameter) + Math.exp(newQNo / bParameter));

  return newCost - currentCost;
}

/**
 * Calculate shares received for a given cost
 */
export function calculateSharesForCost(
  currentQYes: number,
  currentQNo: number,
  cost: number,
  tokenType: 'yes' | 'no',
  bParameter: number
): number {
  // Binary search to find the number of shares
  let low = 0;
  let high = cost * 100; // Upper bound estimate
  const precision = 0.0001;

  while (high - low > precision) {
    const mid = (low + high) / 2;
    const actualCost = calculateLMSRCost(
      currentQYes,
      currentQNo,
      mid,
      tokenType,
      bParameter
    );

    if (actualCost < cost) {
      low = mid;
    } else {
      high = mid;
    }
  }

  return low;
}

/**
 * Calculate current price for a token type
 */
export function calculatePrice(
  qYes: number,
  qNo: number,
  tokenType: 'yes' | 'no',
  bParameter: number
): number {
  const expYes = Math.exp(qYes / bParameter);
  const expNo = Math.exp(qNo / bParameter);

  if (tokenType === 'yes') {
    return expYes / (expYes + expNo);
  } else {
    return expNo / (expYes + expNo);
  }
}

/**
 * Apply slippage to an amount
 */
export function applySlippage(
  amount: number,
  slippagePercent: number,
  direction: 'buy' | 'sell'
): number {
  const multiplier = direction === 'buy' ? 1 + slippagePercent / 100 : 1 - slippagePercent / 100;
  return amount * multiplier;
}

/**
 * Calculate potential profit/loss
 */
export function calculatePnL(
  entryPrice: number,
  currentPrice: number,
  shares: number
): number {
  return (currentPrice - entryPrice) * shares;
}
