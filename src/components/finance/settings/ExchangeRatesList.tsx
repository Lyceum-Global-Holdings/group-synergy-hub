import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Plus, RefreshCw } from "lucide-react";
import { useCurrencies } from "@/hooks/finance/useCurrencies";
import { CreateExchangeRateDialog } from "./CreateExchangeRateDialog";
import { Skeleton } from "@/components/ui/skeleton";
import { format } from "date-fns";

export function ExchangeRatesList() {
  const { exchangeRates, isLoading, runFxRevaluation } = useCurrencies();
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [isRevaluing, setIsRevaluing] = useState(false);

  const handleRevaluation = async () => {
    setIsRevaluing(true);
    try {
      runFxRevaluation(new Date().toISOString().split('T')[0]);
    } finally {
      setIsRevaluing(false);
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Exchange Rates</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Exchange Rates</CardTitle>
            <CardDescription>
              Historical exchange rates for currency conversions
            </CardDescription>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={handleRevaluation} disabled={isRevaluing}>
              <RefreshCw className={`h-4 w-4 mr-2 ${isRevaluing ? 'animate-spin' : ''}`} />
              Run FX Revaluation
            </Button>
            <Button onClick={() => setShowCreateDialog(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Add Rate
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {exchangeRates && exchangeRates.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>From</TableHead>
                  <TableHead>To</TableHead>
                  <TableHead className="text-right">Rate</TableHead>
                  <TableHead>Type</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {exchangeRates.slice(0, 20).map((rate) => (
                  <TableRow key={rate.id}>
                    <TableCell>
                      {format(new Date(rate.rate_date), "MMM d, yyyy")}
                    </TableCell>
                    <TableCell className="font-mono">{rate.from_currency}</TableCell>
                    <TableCell className="font-mono">{rate.to_currency}</TableCell>
                    <TableCell className="text-right font-mono">
                      {rate.exchange_rate.toFixed(6)}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{rate.rate_type || "spot"}</Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              <p>No exchange rates recorded</p>
              <p className="text-sm mt-1">Add exchange rates for foreign currency transactions</p>
            </div>
          )}
        </CardContent>
      </Card>

      <CreateExchangeRateDialog
        open={showCreateDialog}
        onOpenChange={setShowCreateDialog}
      />
    </>
  );
}
