import { PlaceholderContent } from "../PlaceholderContent";

interface QualityModuleProps {
  activeSubTab: string;
  onSubTabChange: (tab: string) => void;
}

export default function QualityModule({ activeSubTab, onSubTabChange }: QualityModuleProps) {
  return (
    <PlaceholderContent
      title="Quality Module"
      description="Quality inspections and inspection templates will be available here. This module is currently under development."
    />
  );
}