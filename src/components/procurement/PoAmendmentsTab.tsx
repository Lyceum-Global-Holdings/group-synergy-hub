import { FileText } from "lucide-react";
import { usePoAmendments } from "@/hooks/usePoAmendments";
import { PoAmendmentCard } from "@/components/procurement/PoAmendmentCard";

export function PoAmendmentsTab({ poId }: { poId: string }) {
  const { data: amendments, isLoading } = usePoAmendments(poId);

  if (isLoading) {
    return <div className="p-6 text-center text-muted-foreground">Loading amendments...</div>;
  }

  if (!amendments || amendments.length === 0) {
    return (
      <div className="p-6 text-center">
        <FileText className="mx-auto h-12 w-12 text-muted-foreground/50" />
        <p className="mt-2 text-muted-foreground">No amendments yet</p>
        <p className="text-xs text-muted-foreground">Approved purchase orders change only through amendments.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4 p-6">
      {amendments.map((amendment) => (
        <PoAmendmentCard key={amendment.id} amendment={amendment} />
      ))}
    </div>
  );
}
