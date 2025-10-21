import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export const CURRENCY_CONFIG: Record<string, {
  code: string;
  symbol: string;
  name: string;
  locale: string;
}> = {
  LKR: { code: 'LKR', symbol: 'Rs.', name: 'Sri Lankan Rupee', locale: 'en-US' },
  USD: { code: 'USD', symbol: '$', name: 'US Dollar', locale: 'en-US' },
  EUR: { code: 'EUR', symbol: '€', name: 'Euro', locale: 'en-EU' },
  GBP: { code: 'GBP', symbol: '£', name: 'British Pound', locale: 'en-GB' },
  INR: { code: 'INR', symbol: '₹', name: 'Indian Rupee', locale: 'en-IN' },
  AUD: { code: 'AUD', symbol: 'A$', name: 'Australian Dollar', locale: 'en-AU' },
};

export function formatCurrency(
  amount: number,
  currency: string = "LKR",
  symbol?: string,
  decimalPlaces: number = 2
): string {
  const config = CURRENCY_CONFIG[currency] || CURRENCY_CONFIG.LKR;
  const currencySymbol = symbol || config.symbol;
  
  const formatted = amount.toLocaleString('en-US', {
    minimumFractionDigits: decimalPlaces,
    maximumFractionDigits: decimalPlaces,
  });
  
  return `${currencySymbol} ${formatted}`;
}
