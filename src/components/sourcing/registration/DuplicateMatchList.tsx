import { Badge } from "@/components/ui/badge";
import type { RegistrationDuplicate } from "@/hooks/useSupplierRegistration";

const REASON_LABEL: Record<RegistrationDuplicate["reasons"][number], string> = {
  tax_id: "tax ID",
  email: "email",
  phone: "phone number",
  name: "name",
};

function matchLabel(m: RegistrationDuplicate) {
  return m.kind === "supplier" ? `${m.code} ${m.name}` : `Application from ${m.name}`;
}

/** Suppliers and waiting applications that a registration matches. */
export function DuplicateMatchList({ matches }: { matches: RegistrationDuplicate[] }) {
  return (
    <ul className="space-y-2">
      {matches.map((m) => (
        <li key={`${m.kind}-${m.id}`} className="rounded-md border bg-background p-3 text-sm">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-medium">{matchLabel(m)}</span>
            {m.kind === "application" ? (
              <Badge variant="secondary">Waiting for approval</Badge>
            ) : m.in_company ? (
              <Badge variant="secondary">Already a supplier of this company</Badge>
            ) : (
              <Badge variant="outline">Supplier elsewhere in the group</Badge>
            )}
            {m.kind === "supplier" && m.status !== "active" && <Badge variant="outline">{m.status}</Badge>}
          </div>
          <p className="mt-1 text-muted-foreground">Same {m.reasons.map((r) => REASON_LABEL[r]).join(", ")}</p>
        </li>
      ))}
    </ul>
  );
}
