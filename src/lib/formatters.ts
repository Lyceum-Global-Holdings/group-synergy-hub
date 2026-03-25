import { formatCurrency } from "@/lib/utils";
import { format, parseISO } from "date-fns";

export function useFormatCurrency() {
  return (amount: number | null | undefined, currency?: string) => {
    if (amount == null) return "—";
    return formatCurrency(amount, currency);
  };
}

export function useFormatDate() {
  return (date: string | null | undefined, fmt: string = "dd MMM yyyy") => {
    if (!date) return "—";
    try {
      return format(parseISO(date), fmt);
    } catch {
      return date;
    }
  };
}
