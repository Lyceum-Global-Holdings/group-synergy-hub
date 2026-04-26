import { createContext, useCallback, useContext, useEffect, useMemo, useState, ReactNode } from "react";
import { useSearchParams } from "react-router-dom";
import { fromIsoDate, isSameLocalDay, toIsoDate } from "@/lib/construction/dateEffective";

interface ResourceDateContextValue {
  asOfDate: Date;
  asOfDateISO: string;
  setAsOfDate: (d: Date) => void;
  resetToToday: () => void;
  isToday: boolean;
}

const ResourceDateContext = createContext<ResourceDateContextValue | undefined>(undefined);

interface ProviderProps {
  children: ReactNode;
  /** When true, sync the date to a `?date=YYYY-MM-DD` URL parameter (default: true). */
  syncToUrl?: boolean;
}

/**
 * Provides an "as-of date" for resource allocation views.
 * Defaults to today. Optionally syncs to the `?date=` URL parameter
 * for shareable deep-links.
 */
export function ResourceDateProvider({ children, syncToUrl = true }: ProviderProps) {
  const [searchParams, setSearchParams] = useSearchParams();

  const initial = useMemo(() => {
    if (syncToUrl) {
      const fromUrl = fromIsoDate(searchParams.get("date"));
      if (fromUrl) return fromUrl;
    }
    return new Date();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const [asOfDate, setAsOfDateState] = useState<Date>(initial);

  const setAsOfDate = useCallback(
    (d: Date) => {
      setAsOfDateState(d);
      if (syncToUrl) {
        const next = new URLSearchParams(searchParams);
        if (isSameLocalDay(d, new Date())) {
          next.delete("date");
        } else {
          next.set("date", toIsoDate(d));
        }
        setSearchParams(next, { replace: true });
      }
    },
    [syncToUrl, searchParams, setSearchParams]
  );

  const resetToToday = useCallback(() => {
    setAsOfDate(new Date());
  }, [setAsOfDate]);

  // Keep state in sync if the URL changes externally (e.g. browser back/forward).
  useEffect(() => {
    if (!syncToUrl) return;
    const fromUrl = fromIsoDate(searchParams.get("date"));
    const target = fromUrl ?? new Date();
    if (!isSameLocalDay(target, asOfDate)) {
      setAsOfDateState(target);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams, syncToUrl]);

  const value = useMemo<ResourceDateContextValue>(
    () => ({
      asOfDate,
      asOfDateISO: toIsoDate(asOfDate),
      setAsOfDate,
      resetToToday,
      isToday: isSameLocalDay(asOfDate, new Date()),
    }),
    [asOfDate, setAsOfDate, resetToToday]
  );

  return <ResourceDateContext.Provider value={value}>{children}</ResourceDateContext.Provider>;
}

export function useResourceDate(): ResourceDateContextValue {
  const ctx = useContext(ResourceDateContext);
  if (!ctx) {
    throw new Error("useResourceDate must be used within a <ResourceDateProvider>");
  }
  return ctx;
}
