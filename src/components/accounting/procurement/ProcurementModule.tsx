import { PlaceholderContent } from "../PlaceholderContent";

interface ProcurementModuleProps {
  activeSubTab: string;
  onSubTabChange: (tab: string) => void;
}

export default function ProcurementModule({ activeSubTab, onSubTabChange }: ProcurementModuleProps) {
  return (
    <PlaceholderContent
      title="Procurement Module"
      description="Purchase requisitions, purchase orders, GRNs, and invoice matching will be available here. This module is currently under development."
    />
  );
}