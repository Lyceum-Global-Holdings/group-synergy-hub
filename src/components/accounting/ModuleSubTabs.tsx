import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface SubTab {
  id: string;
  label: string;
}

interface ModuleSubTabsProps {
  tabs: SubTab[];
  activeTab: string;
  onTabChange: (tab: string) => void;
  children: React.ReactNode;
}

export function ModuleSubTabs({ tabs, activeTab, onTabChange, children }: ModuleSubTabsProps) {
  const effectiveTab = activeTab || tabs[0]?.id || "";

  return (
    <Tabs value={effectiveTab} onValueChange={onTabChange} className="w-full">
      <TabsList className="w-full justify-start flex-wrap gap-0 border-b border-border bg-transparent px-0 h-auto">
        {tabs.map((tab) => (
          <TabsTrigger
            key={tab.id}
            value={tab.id}
            className="px-4 py-2.5 text-sm rounded-none"
          >
            {tab.label}
          </TabsTrigger>
        ))}
      </TabsList>
      {children}
    </Tabs>
  );
}
