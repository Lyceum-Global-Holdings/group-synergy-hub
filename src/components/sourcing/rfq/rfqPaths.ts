import { useLocation } from "react-router-dom";

/**
 * The RFQ workspace is reachable from Sourcing and from Procurement. Links stay
 * under the section the user came from, so module access follows that grant.
 */
export function rfqPaths(pathname: string) {
  return pathname.startsWith("/procurement")
    ? { list: "/procurement/rfq-rfp", compare: "/procurement/rfq-rfp/compare" }
    : { list: "/sourcing/rfq-management", compare: "/sourcing/quotation-comparison" };
}

export function useRfqPaths() {
  return rfqPaths(useLocation().pathname);
}
