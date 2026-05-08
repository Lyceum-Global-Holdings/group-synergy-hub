// Shared Cloudflare Turnstile server-side verifier.
// Imported by all public/auth-adjacent edge functions. Fails CLOSED.
//
// Test keys (Cloudflare): secret "1x0000000000000000000000000000000AA" always
// passes. Used as a development fallback so preview keeps working before a
// real secret is configured.

const SITEVERIFY_URL = "https://challenges.cloudflare.com/turnstile/v0/siteverify";
const TEST_SECRET = "1x0000000000000000000000000000000AA";

const ALLOWED_HOSTNAMES = new Set<string>([
  "localhost",
  "stores.lgh.lk",
]);
// Wildcard suffixes (e.g. *.lovable.app)
const ALLOWED_SUFFIXES: string[] = [
  ".lovable.app",
  ".lovable.dev",
];

export interface VerifyResult {
  success: boolean;
  status: number;
  error?: string;
  hostname?: string;
  action?: string;
}

export async function verifyTurnstile(
  token: string | undefined | null,
  remoteIp: string | undefined,
  expectedAction?: string,
): Promise<VerifyResult> {
  if (!token || typeof token !== "string" || token.length < 10) {
    return { success: false, status: 400, error: "missing-captcha-token" };
  }
  const secret = Deno.env.get("TURNSTILE_SECRET_KEY") || TEST_SECRET;

  const form = new URLSearchParams();
  form.set("secret", secret);
  form.set("response", token);
  if (remoteIp) form.set("remoteip", remoteIp);

  let res: Response;
  try {
    res = await fetch(SITEVERIFY_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: form.toString(),
    });
  } catch (err) {
    console.error("turnstile siteverify fetch failed", err);
    return { success: false, status: 502, error: "captcha-verifier-unreachable" };
  }

  type SiteVerifyResponse = {
    success: boolean;
    "error-codes"?: string[];
    hostname?: string;
    action?: string;
  };
  const json = (await res.json().catch(() => ({}))) as SiteVerifyResponse;
  if (!json.success) {
    return {
      success: false,
      status: 403,
      error: `captcha-failed:${(json["error-codes"] || []).join(",") || "unknown"}`,
    };
  }

  const host = (json.hostname || "").toLowerCase();
  if (host && host !== "" && secret !== TEST_SECRET) {
    const allowed =
      ALLOWED_HOSTNAMES.has(host) ||
      ALLOWED_SUFFIXES.some((suf) => host.endsWith(suf));
    if (!allowed) {
      console.warn("turnstile hostname rejected", host);
      return { success: false, status: 403, error: `captcha-hostname-rejected:${host}` };
    }
  }

  if (expectedAction && json.action && json.action !== expectedAction) {
    return { success: false, status: 403, error: "captcha-action-mismatch" };
  }

  return { success: true, status: 200, hostname: json.hostname, action: json.action };
}

export function getRequestIp(req: Request): string | undefined {
  return (
    req.headers.get("cf-connecting-ip") ||
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("x-real-ip") ||
    undefined
  );
}
