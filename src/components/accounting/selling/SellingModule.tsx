import { PlaceholderContent } from "../PlaceholderContent";

interface SellingModuleProps {
  activeSubTab: string;
  onSubTabChange: (tab: string) => void;
}

export default function SellingModule({ activeSubTab, onSubTabChange }: SellingModuleProps) {
  return (
    <PlaceholderContent
      title="Selling Module"
      description="Sales orders, delivery notes, and pick lists will be available here. This module is currently under development."
    />
  );
}