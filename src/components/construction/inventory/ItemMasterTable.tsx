import { useState } from "react";
import { Plus, Search, Pencil, Trash2, Image as ImageIcon, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { InventoryMaster } from "@/types/construction";

// Predefined Section values
const INVENTORY_SECTIONS = [
  { value: "civil", label: "Civil" },
  { value: "mechanical", label: "Mechanical" },
  { value: "carpenter", label: "Carpenter" },
  { value: "mep", label: "MEP" },
  { value: "aluminium", label: "Aluminium" },
];

interface ItemMasterTableProps {
  items: InventoryMaster[] | undefined;
  isLoading: boolean;
  categoryLabel: string;
  onAddItem: () => void;
  onEditItem: (item: InventoryMaster) => void;
  onDeleteItem: (item: InventoryMaster) => void;
  onImport: () => void;
}

export function ItemMasterTable({
  items,
  isLoading,
  categoryLabel,
  onAddItem,
  onEditItem,
  onDeleteItem,
  onImport,
}: ItemMasterTableProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [sectionFilter, setSectionFilter] = useState<string>("all");

  const filteredItems = items?.filter((item) => {
    const matchesSearch =
      item.item_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.item_code?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.section?.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesSection = sectionFilter === "all" || item.section === sectionFilter;

    return matchesSearch && matchesSection;
  });

  const getSectionLabel = (value: string | null) => {
    if (!value) return "-";
    return INVENTORY_SECTIONS.find((s) => s.value === value)?.label || value;
  };

  return (
    <div className="space-y-4">
      {/* Search and Filters */}
      <div className="flex flex-wrap items-center gap-4">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder={`Search ${categoryLabel.toLowerCase()}...`}
            className="pl-8"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <Select value={sectionFilter} onValueChange={setSectionFilter}>
          <SelectTrigger className="w-[150px]">
            <SelectValue placeholder="Section" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Sections</SelectItem>
            {INVENTORY_SECTIONS.map((section) => (
              <SelectItem key={section.value} value={section.value}>
                {section.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button variant="outline" onClick={onImport}>
          <Upload className="mr-2 h-4 w-4" />
          Import
        </Button>
        <Button onClick={onAddItem}>
          <Plus className="mr-2 h-4 w-4" />
          Add {categoryLabel}
        </Button>
      </div>

      <Card>
        <CardContent className="pt-6">
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[60px]">Image</TableHead>
                  <TableHead>Item ID</TableHead>
                  <TableHead>Item Name</TableHead>
                  <TableHead>Serial No</TableHead>
                  <TableHead>Section</TableHead>
                  <TableHead>Notes</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredItems?.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                      No {categoryLabel.toLowerCase()} found
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredItems?.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell>
                        {item.image_url ? (
                          <img
                            src={item.image_url}
                            alt={item.item_name}
                            className="w-10 h-10 object-cover rounded"
                          />
                        ) : (
                          <div className="w-10 h-10 bg-muted rounded flex items-center justify-center">
                            <ImageIcon className="h-4 w-4 text-muted-foreground" />
                          </div>
                        )}
                      </TableCell>
                      <TableCell className="font-mono text-sm">{item.item_code || "-"}</TableCell>
                      <TableCell className="font-medium">{item.item_name}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{item.serial_number || "-"}</TableCell>
                      <TableCell>
                        <Badge variant="outline">{getSectionLabel(item.section)}</Badge>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground max-w-[200px] truncate" title={item.notes || ""}>
                        {item.notes || "-"}
                      </TableCell>
                      <TableCell>
                        <Badge variant={item.status === "active" ? "default" : "secondary"}>
                          {item.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button variant="ghost" size="icon" onClick={() => onEditItem(item)}>
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="icon" onClick={() => onDeleteItem(item)}>
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
