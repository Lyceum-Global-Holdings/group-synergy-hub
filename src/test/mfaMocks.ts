import { vi } from "vitest";

/**
 * In-memory mock of the Supabase MFA surface used by the MFA pages and
 * ProtectedRoute. Reset state between tests via `resetMfaMockState()`.
 */

export type Aal = "aal1" | "aal2";
export type Factor = { id: string; status: "verified" | "unverified"; friendly_name?: string };

export const mfaState: {
  user: { id: string; email: string } | null;
  aal: { currentLevel: Aal; nextLevel: Aal };
  factors: Factor[];
  recoveryCodes: Set<string>;
  authStateListeners: Array<(event: string, session: unknown) => void>;
} = {
  user: null,
  aal: { currentLevel: "aal1", nextLevel: "aal1" },
  factors: [],
  recoveryCodes: new Set(),
  authStateListeners: [],
};

export function resetMfaMockState() {
  mfaState.user = { id: "user-1", email: "test@example.com" };
  mfaState.aal = { currentLevel: "aal1", nextLevel: "aal1" };
  mfaState.factors = [];
  mfaState.recoveryCodes = new Set();
  mfaState.authStateListeners = [];
}

export const supabaseMock = {
  auth: {
    getSession: vi.fn(async () => ({
      data: { session: mfaState.user ? { user: mfaState.user } : null },
    })),
    getUser: vi.fn(async () => ({ data: { user: mfaState.user } })),
    onAuthStateChange: vi.fn((cb: (e: string, s: unknown) => void) => {
      mfaState.authStateListeners.push(cb);
      return { data: { subscription: { unsubscribe: vi.fn() } } };
    }),
    signOut: vi.fn(async () => {
      mfaState.user = null;
      return { error: null };
    }),
    mfa: {
      getAuthenticatorAssuranceLevel: vi.fn(async () => ({
        data: { ...mfaState.aal },
        error: null,
      })),
      listFactors: vi.fn(async () => ({
        data: { all: [...mfaState.factors], totp: [...mfaState.factors] },
        error: null,
      })),
      enroll: vi.fn(
        async ({ friendlyName }: { factorType: "totp"; friendlyName: string }) => {
          if (mfaState.factors.some((f) => f.friendly_name === friendlyName)) {
            return {
              data: null,
              error: {
                message: `A factor with the friendly name "${friendlyName}" for this user already exists`,
              },
            };
          }
          const id = `factor-${mfaState.factors.length + 1}`;
          mfaState.factors.push({ id, status: "unverified", friendly_name: friendlyName });
          const totp = {
            secret: "JBSWY3DPEHPK3PXP",
            uri: `otpauth://totp/Lyceum:${mfaState.user?.email}?secret=JBSWY3DPEHPK3PXP&issuer=Lyceum`,
          };
          return { data: { id, totp, type: "totp" }, error: null };
        },
      ),
      unenroll: vi.fn(async ({ factorId }: { factorId: string }) => {
        mfaState.factors = mfaState.factors.filter((f) => f.id !== factorId);
        return { data: { id: factorId }, error: null };
      }),
      challenge: vi.fn(async ({ factorId }: { factorId: string }) => ({
        data: { id: `challenge-for-${factorId}` },
        error: null,
      })),
      verify: vi.fn(
        async ({
          factorId,
          code,
        }: {
          factorId: string;
          challengeId: string;
          code: string;
        }) => {
          if (code !== "123456") {
            return { data: null, error: { message: "Invalid TOTP code" } };
          }
          const f = mfaState.factors.find((x) => x.id === factorId);
          if (f) f.status = "verified";
          mfaState.aal = { currentLevel: "aal2", nextLevel: "aal2" };
          return { data: { access_token: "new-token" }, error: null };
        },
      ),
    },
  },
  rpc: vi.fn(async (fn: string, args?: { p_code?: string }) => {
    if (fn === "generate_mfa_recovery_codes") {
      if (mfaState.aal.currentLevel !== "aal2") {
        return { data: null, error: { message: "AAL2 required to generate recovery codes" } };
      }
      mfaState.recoveryCodes = new Set();
      const codes: string[] = [];
      for (let i = 0; i < 10; i++) {
        const c = `CODE${String(i).padStart(2, "0")}-XXXXX`;
        codes.push(c);
        mfaState.recoveryCodes.add(c);
      }
      return { data: codes, error: null };
    }
    if (fn === "consume_mfa_recovery_code") {
      const code = (args?.p_code ?? "").trim().toUpperCase();
      if (mfaState.recoveryCodes.has(code)) {
        mfaState.recoveryCodes.delete(code);
        return { data: true, error: null };
      }
      return { data: false, error: null };
    }
    return { data: null, error: { message: `Unknown RPC ${fn}` } };
  }),
};
