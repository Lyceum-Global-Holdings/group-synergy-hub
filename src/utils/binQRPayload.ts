// GS1 Digital Link compatible payload for bin-allocation QR codes.
// Format: https://<host>/b/{allocation_id}?01={item_code}&254={bin_code}&91={location_code}
// - 01  = Item identifier (GTIN slot; falls back to internal item_code when no GTIN)
// - 254 = GLN extension component (used here for bin code)
// - 91  = Company-internal AI (used here for location code)
// Reference: GS1 Digital Link URI Syntax v1.4

// IMPORTANT: per GS1 Digital Link URI Syntax v1.4 §6, the resolver host SHOULD be a single,
// stable, organisation-controlled domain. Do NOT swap this for `window.location.origin` —
// printed labels live for years and must keep resolving even from preview/staging hosts.
const PUBLIC_BASE_URL = 'https://stores.lgh.lk';

export interface BinQRPayloadInput {
  allocationId: string;
  itemCode?: string | null;
  binCode?: string | null;
  locationCode?: string | null;
}

export function buildBinQRPayload(input: BinQRPayloadInput): string {
  const url = new URL(`/b/${input.allocationId}`, PUBLIC_BASE_URL);
  if (input.itemCode) url.searchParams.set('01', input.itemCode);
  if (input.binCode) url.searchParams.set('254', input.binCode);
  if (input.locationCode) url.searchParams.set('91', input.locationCode);
  return url.toString();
}
