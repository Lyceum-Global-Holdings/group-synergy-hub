import { Check, ChevronsUpDown, X } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { useAssetMaster } from "@/hooks/useAssetMaster";
import { AssetMaster } from "@/types/assetMaster";

interface AssetMasterSelectorProps {
  value?: string;
  onValueChange: (assetMasterId: string | undefined) => void;
  onAssetSelected?: (asset: AssetMaster | null) => void;
}

export function AssetMasterSelector({
  value,
  onValueChange,
  onAssetSelected,
}: AssetMasterSelectorProps) {
  const [open, setOpen] = useState(false);
  const { assetMasterItems, isLoading } = useAssetMaster();

  const selectedAsset = assetMasterItems.find((item) => item.id === value);

  const handleSelect = (assetId: string) => {
    const asset = assetMasterItems.find((item) => item.id === assetId);
    console.log("Asset selected:", assetId, asset?.asset_name);
    onValueChange(assetId);
    onAssetSelected?.(asset || null);
    setOpen(false);
  };

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    onValueChange(undefined);
    onAssetSelected?.(null);
  };

  return (
    <div className="flex gap-2">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            role="combobox"
            aria-expanded={open}
            className="flex-1 justify-between"
          >
            {selectedAsset ? (
              <div className="flex items-center gap-2 truncate">
                {selectedAsset.image_url && (
                  <img
                    src={selectedAsset.image_url}
                    alt=""
                    className="h-5 w-5 rounded object-cover"
                  />
                )}
                <span className="truncate">{selectedAsset.asset_name}</span>
                {selectedAsset.brand && (
                  <span className="text-muted-foreground text-sm">
                    ({selectedAsset.brand})
                  </span>
                )}
              </div>
            ) : (
              "Select from Asset Master..."
            )}
            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[400px] p-0">
          <Command>
            <CommandInput placeholder="Search asset master..." />
            <CommandEmpty>
              {isLoading ? "Loading..." : "No asset master items found."}
            </CommandEmpty>
            <CommandGroup className="max-h-[300px] overflow-auto">
              {assetMasterItems
                .filter((item) => item.status === "active")
                .map((item) => (
                  <CommandItem
                    key={item.id}
                    value={`${item.asset_name} ${item.brand || ""}`}
                    onSelect={() => handleSelect(item.id)}
                  >
                    <Check
                      className={cn(
                        "mr-2 h-4 w-4",
                        value === item.id ? "opacity-100" : "opacity-0"
                      )}
                    />
                    <div className="flex items-center gap-2 flex-1 min-w-0">
                      {item.image_url && (
                        <img
                          src={item.image_url}
                          alt=""
                          className="h-8 w-8 rounded object-cover flex-shrink-0"
                        />
                      )}
                      <div className="flex flex-col min-w-0">
                        <span className="font-medium truncate">
                          {item.asset_name}
                        </span>
                        <span className="text-sm text-muted-foreground truncate">
                          {item.brand && `${item.brand} • `}
                          {item.purchase_price && `LKR ${item.purchase_price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
                        </span>
                      </div>
                    </div>
                  </CommandItem>
                ))}
            </CommandGroup>
          </Command>
        </PopoverContent>
      </Popover>
      {value && (
        <Button
          type="button"
          variant="outline"
          size="icon"
          onClick={handleClear}
        >
          <X className="h-4 w-4" />
        </Button>
      )}
    </div>
  );
}
