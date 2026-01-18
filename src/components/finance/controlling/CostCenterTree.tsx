import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCompany } from "@/contexts/CompanyContext";
import { Skeleton } from "@/components/ui/skeleton";
import { ChevronRight, ChevronDown, FolderOpen, Folder } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";

interface CostCenter {
  id: string;
  code: string;
  name: string;
  description: string | null;
  parent_id: string | null;
  is_active: boolean;
  children?: CostCenter[];
}

function buildTree(items: CostCenter[]): CostCenter[] {
  const map = new Map<string, CostCenter>();
  const roots: CostCenter[] = [];

  items.forEach((item) => {
    map.set(item.id, { ...item, children: [] });
  });

  items.forEach((item) => {
    const node = map.get(item.id)!;
    if (item.parent_id && map.has(item.parent_id)) {
      map.get(item.parent_id)!.children!.push(node);
    } else {
      roots.push(node);
    }
  });

  return roots;
}

function TreeNode({ node, level = 0 }: { node: CostCenter; level?: number }) {
  const [expanded, setExpanded] = useState(true);
  const hasChildren = node.children && node.children.length > 0;

  return (
    <div>
      <div
        className={cn(
          "flex items-center gap-2 p-2 hover:bg-muted rounded cursor-pointer",
          !node.is_active && "opacity-50"
        )}
        style={{ paddingLeft: `${level * 20 + 8}px` }}
        onClick={() => hasChildren && setExpanded(!expanded)}
      >
        {hasChildren ? (
          expanded ? (
            <ChevronDown className="h-4 w-4" />
          ) : (
            <ChevronRight className="h-4 w-4" />
          )
        ) : (
          <span className="w-4" />
        )}
        {hasChildren ? (
          <FolderOpen className="h-4 w-4 text-primary" />
        ) : (
          <Folder className="h-4 w-4 text-muted-foreground" />
        )}
        <span className="font-mono text-sm text-muted-foreground">{node.code}</span>
        <span className="font-medium">{node.name}</span>
      </div>
      {expanded && hasChildren && (
        <div>
          {node.children!.map((child) => (
            <TreeNode key={child.id} node={child} level={level + 1} />
          ))}
        </div>
      )}
    </div>
  );
}

export function CostCenterTree() {
  const { selectedCompany } = useCompany();

  const { data: costCenters, isLoading } = useQuery({
    queryKey: ["cost-centers", selectedCompany?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("cost_centers")
        .select("*")
        .eq("company_id", selectedCompany?.id)
        .order("code");

      if (error) throw error;
      return data as CostCenter[];
    },
    enabled: !!selectedCompany?.id,
  });

  if (isLoading) {
    return <Skeleton className="h-96 w-full" />;
  }

  const tree = buildTree(costCenters || []);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Cost Center Hierarchy</CardTitle>
      </CardHeader>
      <CardContent>
        {tree.length === 0 ? (
          <div className="text-center text-muted-foreground py-8">
            No cost centers defined. Create your first cost center to get started.
          </div>
        ) : (
          <div className="space-y-1">
            {tree.map((node) => (
              <TreeNode key={node.id} node={node} />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
