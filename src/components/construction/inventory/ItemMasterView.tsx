import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Search, Plus, Package, Edit, Eye } from "lucide-react";
import { useItemMaster } from "@/hooks/construction/useConstructionInventory";
import { ITEM_CATEGORIES, ITEM_SECTIONS, type ItemCategory } from "@/types/construction-inventory";
import { Skeleton } from "@/components/ui/skeleton";
import { format } from "date-fns";

export function ItemMasterView() {
  const [searchTerm, setSearchTerm] = useState("");
  const [activeCategory, setActiveCategory] = useState<ItemCategory>("machines");

  const { data: items, isLoading } = useItemMaster(activeCategory);

  // Filter items by search
  const filteredItems = items?.filter(item => {
    if (!searchTerm) return true;
    const term = searchTerm.toLowerCase();
    return (
      item.item_name.toLowerCase().includes(term) ||
      item.item_code.toLowerCase().includes(term) ||
      item.brand?.toLowerCase().includes(term) ||
      item.model?.toLowerCase().includes(term)
    );
  }) || [];

  const getStatusBadge = (status: string) => {
    const styles: Record<string, string> = {
      active: "bg-green-100 text-green-800",
      scrap: "bg-red-100 text-red-800",
      sold: "bg-gray-100 text-gray-800",
    };
    return <Badge className={styles[status] || ""}>{status}</Badge>;
  };

  return (
    <div className="space-y-4">
      {/* Category Tabs */}
      <Tabs value={activeCategory} onValueChange={(v) => setActiveCategory(v as ItemCategory)}>
        <TabsList className="w-full justify-start overflow-auto">
          {ITEM_CATEGORIES.map(cat => (
            <TabsTrigger key={cat.value} value={cat.value} className="flex-shrink-0">
              {cat.label}
            </TabsTrigger>
          ))}
        </TabsList>

        <div className="mt-4 space-y-4">
          {/* Filters & Actions */}
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by name, code, brand, or model..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9"
              />
            </div>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Add {ITEM_CATEGORIES.find(c => c.value === activeCategory)?.label.slice(0, -1) || "Item"}
            </Button>
          </div>

          {/* Items Table */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Package className="h-5 w-5" />
                {ITEM_CATEGORIES.find(c => c.value === activeCategory)?.label} Master
              </CardTitle>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="space-y-2">
                  {[...Array(5)].map((_, i) => (
                    <Skeleton key={i} className="h-12" />
                  ))}
                </div>
              ) : filteredItems.length === 0 ? (
                <div className="py-12 text-center">
                  <Package className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                  <h3 className="font-medium">No {activeCategory} found</h3>
                  <p className="text-sm text-muted-foreground">
                    Add items to the {ITEM_CATEGORIES.find(c => c.value === activeCategory)?.label} master
                  </p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-12"></TableHead>
                      <TableHead>Item Code</TableHead>
                      <TableHead>Item Name</TableHead>
                      <TableHead>Section</TableHead>
                      <TableHead>Brand / Model</TableHead>
                      <TableHead>Unit</TableHead>
                      <TableHead className="text-right">Unit Cost</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="w-24">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredItems.map(item => (
                      <TableRow key={item.id}>
                        <TableCell>
                          {item.image_url ? (
                            <img src={item.image_url} alt="" className="h-10 w-10 rounded object-cover" />
                          ) : (
                            <div className="h-10 w-10 rounded bg-muted flex items-center justify-center">
                              <Package className="h-5 w-5 text-muted-foreground" />
                            </div>
                          )}
                        </TableCell>
                        <TableCell className="font-mono">{item.item_code}</TableCell>
                        <TableCell className="font-medium">
                          <div>
                            {item.item_name}
                            {item.is_serial_tracked && (
                              <Badge variant="outline" className="ml-2 text-xs">Serial</Badge>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="secondary">
                            {ITEM_SECTIONS.find(s => s.value === item.section)?.label || item.section}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {item.brand || item.model 
                            ? `${item.brand || ""} ${item.model || ""}`.trim()
                            : "-"
                          }
                        </TableCell>
                        <TableCell>{item.unit_of_measurement}</TableCell>
                        <TableCell className="text-right">
                          {item.unit_cost ? `₹${item.unit_cost.toLocaleString()}` : "-"}
                        </TableCell>
                        <TableCell>{getStatusBadge(item.status)}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1">
                            <Button variant="ghost" size="icon" className="h-8 w-8">
                              <Eye className="h-4 w-4" />
                            </Button>
                            <Button variant="ghost" size="icon" className="h-8 w-8">
                              <Edit className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </div>
      </Tabs>
    </div>
  );
}
