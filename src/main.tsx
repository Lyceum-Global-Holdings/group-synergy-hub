import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { supabase } from "@/integrations/supabase/client";
import { installPerfInterceptor } from "@/integrations/supabase/perfClient";
import { initPerfTelemetry } from "@/lib/perfTelemetry";

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

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
