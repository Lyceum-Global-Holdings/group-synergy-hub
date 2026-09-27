import { endOfMonth, format, startOfMonth, subMonths } from "date-fns";

const day = (d: Date) => format(d, "yyyy-MM-dd");

export function evaluationPeriods(today: Date = new Date()) {
  const lastMonth = subMonths(today, 1);
  return [
    { label: "Last month", from: day(startOfMonth(lastMonth)), to: day(endOfMonth(lastMonth)) },
    { label: "This month so far", from: day(startOfMonth(today)), to: day(today) },
    { label: "Last 3 months", from: day(startOfMonth(subMonths(today, 3))), to: day(endOfMonth(lastMonth)) },
  ];
}
