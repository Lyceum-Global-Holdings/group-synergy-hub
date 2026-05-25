// GS1 Digital Link compatible payload for warehouse-asset QR labels.
// Format: https://stores.lgh.lk/a/{asset_id}?8004={asset_tag}
// - 8004 = GS1 Application Identifier "Serialised asset identifier"
//   (used here to carry the human-readable asset tag alongside the UUID).
//
// The host MUST be the stable resolver domain (GS1 Digital Link URI Syntax
// v1.4 §6). Printed labels live for years — never swap this for
// `window.location.origin`. The legacy `/asset/:id` route is also mounted
// as a permanent alias so previously-printed labels keep resolving.
const PUBLIC_BASE_URL = 'https://stores.lgh.lk';

export interface AssetQRPayloadInput {
  assetId: string;
  assetTag?: string | null;
  serialNumber?: string | null;
}

export function buildAssetQRPayload(input: AssetQRPayloadInput): string {
  const url = new URL(`/a/${input.assetId}`, PUBLIC_BASE_URL);
  const tag = input.assetTag || input.serialNumber;
  if (tag) url.searchParams.set('8004', tag);
  return url.toString();
}
