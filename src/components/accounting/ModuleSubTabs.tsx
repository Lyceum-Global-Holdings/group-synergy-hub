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
      <TabsList className="h-auto p-1 bg-muted/30 border border-border rounded-lg flex flex-wrap gap-1 justify-start w-full">
        {tabs.map((tab) => (
          <TabsTrigger
            key={tab.id}
            value={tab.id}
            className="px-4 py-2 text-sm data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
          >
            {tab.label}
          </TabsTrigger>
        ))}
      </TabsList>
      {children}
    </Tabs>
  );
}