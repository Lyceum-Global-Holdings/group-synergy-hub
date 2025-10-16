import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const CATEGORIES = [
  { value: "all", label: "All Categories" },
  { value: "user_guide", label: "User Guides" },
  { value: "module_manual", label: "Module Manuals" },
  { value: "quick_reference", label: "Quick References" },
  { value: "admin_guide", label: "Admin Guides" },
  { value: "technical", label: "Technical Documentation" },
];

interface ManualCategoryFilterProps {
  value: string;
  onChange: (value: string) => void;
}

export default function ManualCategoryFilter({ value, onChange }: ManualCategoryFilterProps) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className="w-[240px]">
        <SelectValue placeholder="Filter by category" />
      </SelectTrigger>
      <SelectContent>
        {CATEGORIES.map((category) => (
          <SelectItem key={category.value} value={category.value}>
            {category.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
