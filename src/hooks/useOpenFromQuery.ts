import { useEffect } from "react";
import { useSearchParams } from "react-router-dom";

/**
 * Opens a dialog when the page is reached with `?<param>=<value>` (used by the
 * header quick-create menu, e.g. /procurement/purchase-order?new=1), then
 * strips the parameter so a refresh or back-navigation doesn't reopen it.
 */
export function useOpenFromQuery(param: string, openers: Record<string, () => void>) {
  const [searchParams, setSearchParams] = useSearchParams();
  const value = searchParams.get(param);

  useEffect(() => {
    if (!value) return;
    const open = openers[value];
    if (!open) return;
    open();
    const next = new URLSearchParams(searchParams);
    next.delete(param);
    setSearchParams(next, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);
}
