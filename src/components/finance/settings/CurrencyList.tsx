import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { useCurrencies } from "@/hooks/finance/useCurrencies";
import { Skeleton } from "@/components/ui/skeleton";

export function CurrencyList() {
  const { currencies, isLoading } = useCurrencies();

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Currencies</CardTitle>
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
    <Card>
      <CardHeader>
        <CardTitle>Currencies</CardTitle>
        <CardDescription>
          Currencies enabled for multi-currency transactions
        </CardDescription>
      </CardHeader>
      <CardContent>
        {currencies && currencies.length > 0 ? (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Code</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Symbol</TableHead>
                <TableHead>Decimals</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {currencies.map((currency) => (
                <TableRow key={currency.id}>
                  <TableCell className="font-mono font-medium">{currency.code}</TableCell>
                  <TableCell>{currency.name}</TableCell>
                  <TableCell>{currency.symbol || "—"}</TableCell>
                  <TableCell>{currency.decimal_places ?? 2}</TableCell>
                  <TableCell>
                    <div className="flex gap-2">
                      {currency.is_base_currency && (
                        <Badge>Base Currency</Badge>
                      )}
                      {currency.is_active && !currency.is_base_currency && (
                        <Badge variant="secondary">Enabled</Badge>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        ) : (
          <div className="text-center py-8 text-muted-foreground">
            <p>No currencies configured</p>
            <p className="text-sm mt-1">Set up your base currency and any foreign currencies</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
