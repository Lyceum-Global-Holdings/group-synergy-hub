import { PlaceholderContent } from "../PlaceholderContent";

interface AutomationModuleProps {
  activeSubTab: string;
  onSubTabChange: (tab: string) => void;
}

export default function AutomationModule({ activeSubTab, onSubTabChange }: AutomationModuleProps) {
  return (
    <PlaceholderContent
      title="Automation Module"
      description="Recurring entries, workflow rules, scheduled tasks, and job monitoring will be available here. This module is currently under development."
    />
  );
}