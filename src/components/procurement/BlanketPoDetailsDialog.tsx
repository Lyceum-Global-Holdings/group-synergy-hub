import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card } from "@/components/ui/card";
import type { BlanketPurchaseOrder } from "@/types/blanketPurchaseOrder";

interface BlanketPoDetailsDialogProps {
  bpo: BlanketPurchaseOrder;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function BlanketPoDetailsDialog({ bpo, open, onOpenChange }: BlanketPoDetailsDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Blanket PO Details - {bpo.bpo_number}</DialogTitle>
        </DialogHeader>

        <Tabs defaultValue="overview">
          <TabsList>
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="items">Items</TabsTrigger>
            <TabsTrigger value="releases">Releases</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-4">
            <Card className="p-4">
              <h3 className="font-semibold mb-2">Contract Details</h3>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-muted-foreground">Supplier:</span>
                  <p className="font-medium">{bpo.supplier?.name}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Status:</span>
                  <p><Badge>{bpo.contract_status}</Badge></p>
                </div>
                <div>
                  <span className="text-muted-foreground">Total Value:</span>
                  <p className="font-medium">${bpo.total_contract_value.toLocaleString()}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Remaining:</span>
                  <p className="font-medium">${bpo.remaining_value.toLocaleString()}</p>
                </div>
              </div>
            </Card>
          </TabsContent>

          <TabsContent value="items">
            <div className="space-y-2">
              {bpo.items?.map((item) => (
                <Card key={item.id} className="p-4">
                  <div className="flex justify-between">
                    <div>
                      <h4 className="font-medium">{item.item_name}</h4>
                      <p className="text-sm text-muted-foreground">{item.item_code}</p>
                    </div>
                    <div className="text-right">
                      <p className="font-medium">${item.unit_price}</p>
                      <p className="text-sm text-muted-foreground">{item.unit_of_measure}</p>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          </TabsContent>

          <TabsContent value="releases">
            <div className="text-center py-8 text-muted-foreground">
              Release management coming soon
            </div>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
