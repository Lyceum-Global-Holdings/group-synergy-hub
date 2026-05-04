## Fix the last failing MFA test (16/16)

**Failing test:** `MfaSetup > recovery codes can be copied and downloaded`

**Root cause:** `src/test/setup.ts` defines `navigator.clipboard` via `Object.defineProperty` without `writable: true`, making it a read-only data property. The test then does `Object.assign(navigator, { clipboard: ... })`, which throws `TypeError: Cannot set property clipboard of #<Navigator> which has only a getter`.

### Change

In `src/pages/auth/__tests__/MfaSetup.test.tsx` (the "recovery codes can be copied and downloaded" test), replace the `Object.assign(navigator, ...)` shim with a `defineProperty` shim that matches the configurable descriptor installed in setup, and spy on the existing clipboard instead of reassigning it.

Concretely:

```ts
const writeText = vi.fn(async () => {});
Object.defineProperty(navigator, "clipboard", {
  value: { writeText },
  configurable: true,
});
```

This works because setup.ts already declares the descriptor as `configurable: true`, so redefining it is allowed; direct assignment is not.

No production code changes. No setup.ts changes needed.

### Verification

Run `bunx vitest run` and confirm: `Tests 16 passed (16)`.