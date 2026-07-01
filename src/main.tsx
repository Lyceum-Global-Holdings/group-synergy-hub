import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { supabase } from "@/integrations/supabase/client";
import { installPerfInterceptor } from "@/integrations/supabase/perfClient";
import { initPerfTelemetry } from "@/lib/perfTelemetry";

function renderStartupFallback(error: unknown) {
  console.error("[StartupError]", error);

  const root = document.getElementById("root");
  if (!root) return;

  root.innerHTML = `
    <div style="min-height:100vh;display:flex;align-items:center;justify-content:center;padding:24px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background:hsl(220 20% 97%);color:hsl(220 25% 10%);">
      <div style="max-width:480px;text-align:center;">
        <h1 style="font-size:22px;font-weight:600;margin:0 0 8px;">The app could not start</h1>
        <p style="font-size:14px;opacity:.72;margin:0 0 20px;">Please reload, or return to sign-in and try again.</p>
        <div style="display:flex;gap:8px;justify-content:center;flex-wrap:wrap;">
          <button type="button" id="startup-reload" style="padding:8px 16px;border-radius:8px;border:1px solid hsl(220 13% 91%);background:hsl(213 94% 42%);color:white;font-weight:500;cursor:pointer;">Reload</button>
          <button type="button" id="startup-auth" style="padding:8px 16px;border-radius:8px;border:1px solid hsl(220 13% 91%);background:white;color:hsl(220 25% 10%);font-weight:500;cursor:pointer;">Go to sign-in</button>
        </div>
      </div>
    </div>
  `;

  document.getElementById("startup-reload")?.addEventListener("click", () => {
    window.location.reload();
  });
  document.getElementById("startup-auth")?.addEventListener("click", () => {
    window.location.href = "/auth?app=main";
  });
}

// Phase 5 — performance telemetry. Slow-query interceptor + Web Vitals capture.
// Sampled (10% prod / 100% dev), batched (5s), never blocks startup.
installPerfInterceptor(supabase);

let cachedUserId: string | null = null;
let cachedCompanyId: string | null = null;

// Track auth so telemetry rows carry the right user_id (RLS requires it).
supabase.auth.getSession().then(({ data }) => {
  cachedUserId = data.session?.user?.id ?? null;
});
supabase.auth.onAuthStateChange((_event, session) => {
  cachedUserId = session?.user?.id ?? null;
});

// Selected company is stored by CompanyContext as 'selectedCompanyId' in localStorage.
function readCompanyId(): string | null {
  try {
    return window.localStorage.getItem("selectedCompanyId");
  } catch {
    return null;
  }
}

initPerfTelemetry({
  sampleRate: import.meta.env.PROD ? 0.1 : 1.0,
  getContext: () => ({
    route: window.location.pathname,
    userId: cachedUserId,
    companyId: cachedCompanyId ?? readCompanyId(),
  }),
});

try {
  const root = document.getElementById("root");
  if (!root) throw new Error("Root element #root was not found");

  createRoot(root).render(
    <StrictMode>
      <App />
    </StrictMode>
  );
} catch (error) {
  renderStartupFallback(error);
}
