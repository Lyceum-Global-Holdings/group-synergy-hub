export interface DepreciationParams {
  purchasePrice: number;
  purchaseDate: Date;
  depreciationMethod: 'straight_line' | 'declining_balance';
  depreciationRate?: number;
  usefulLifeYears?: number;
  salvageValue?: number;
  calculationDate?: Date;
}

export interface DepreciationResult {
  accumulatedDepreciation: number;
  currentValue: number;
  annualDepreciation: number;
  monthlyDepreciation: number;
  yearsElapsed: number;
  remainingLife: number;
}

export function calculateDepreciation(params: DepreciationParams): DepreciationResult {
  const {
    purchasePrice,
    purchaseDate,
    depreciationMethod,
    depreciationRate = 0,
    usefulLifeYears = 0,
    salvageValue = 0,
    calculationDate = new Date(),
  } = params;

  // Calculate years elapsed
  const msPerYear = 365.25 * 24 * 60 * 60 * 1000;
  const yearsElapsed = (calculationDate.getTime() - purchaseDate.getTime()) / msPerYear;
  
  if (yearsElapsed <= 0) {
    return {
      accumulatedDepreciation: 0,
      currentValue: purchasePrice,
      annualDepreciation: 0,
      monthlyDepreciation: 0,
      yearsElapsed: 0,
      remainingLife: usefulLifeYears || 0,
    };
  }

  const depreciableAmount = purchasePrice - salvageValue;
  let accumulatedDepreciation = 0;
  let annualDepreciation = 0;

  if (depreciationMethod === 'straight_line') {
    if (usefulLifeYears && usefulLifeYears > 0) {
      annualDepreciation = depreciableAmount / usefulLifeYears;
      accumulatedDepreciation = Math.min(annualDepreciation * yearsElapsed, depreciableAmount);
    }
  } else if (depreciationMethod === 'declining_balance') {
    if (depreciationRate && depreciationRate > 0) {
      accumulatedDepreciation = purchasePrice * (1 - Math.pow(1 - depreciationRate / 100, yearsElapsed));
      accumulatedDepreciation = Math.min(accumulatedDepreciation, depreciableAmount);
      
      // Calculate annual depreciation for current year
      const currentBookValue = purchasePrice - accumulatedDepreciation;
      annualDepreciation = currentBookValue * (depreciationRate / 100);
    }
  }

  const currentValue = Math.max(purchasePrice - accumulatedDepreciation, salvageValue);
  const monthlyDepreciation = annualDepreciation / 12;
  const remainingLife = usefulLifeYears ? Math.max(0, usefulLifeYears - yearsElapsed) : 0;

  return {
    accumulatedDepreciation: Math.round(accumulatedDepreciation * 100) / 100,
    currentValue: Math.round(currentValue * 100) / 100,
    annualDepreciation: Math.round(annualDepreciation * 100) / 100,
    monthlyDepreciation: Math.round(monthlyDepreciation * 100) / 100,
    yearsElapsed: Math.round(yearsElapsed * 100) / 100,
    remainingLife: Math.round(remainingLife * 100) / 100,
  };
}
