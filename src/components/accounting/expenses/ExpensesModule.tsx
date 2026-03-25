import { PlaceholderContent } from "../PlaceholderContent";

interface ExpensesModuleProps {
  activeSubTab: string;
  onSubTabChange: (tab: string) => void;
}

export default function ExpensesModule({ activeSubTab, onSubTabChange }: ExpensesModuleProps) {
  return (
    <PlaceholderContent
      title="Expenses Module"
      description="Petty cash, staff advances, company bills, and expense analytics will be available here. This module is currently under development."
    />
  );
}