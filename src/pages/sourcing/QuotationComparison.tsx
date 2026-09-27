import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { BarChart3, FileSearch, Scale } from "lucide-react";
import { GenerateReportButton } from "@/components/management/reports/GenerateReportButton";

export default function QuotationComparison() {
  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Quotation Comparison</h1>
          <p className="text-muted-foreground">
            Compare supplier quotations side-by-side for informed decisions
          </p>
        </div>
        <GenerateReportButton template="SR-QUOTE-CMP-001" />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Select RFQ to Compare</CardTitle>
          <CardDescription>
            Choose an RFQ to view and compare received quotations
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-4">
            <Select>
              <SelectTrigger className="w-[300px]">
                <SelectValue placeholder="Select an RFQ" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">No RFQs available</SelectItem>
              </SelectContent>
            </Select>
            <Button variant="outline">
              <FileSearch className="h-4 w-4 mr-2" />
              Load Quotations
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-6 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Scale className="h-4 w-4" />
              Price Comparison
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-center py-8 text-muted-foreground">
              <p className="text-sm">Select an RFQ to view price comparison</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <BarChart3 className="h-4 w-4" />
              Delivery Terms
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-center py-8 text-muted-foreground">
              <p className="text-sm">Select an RFQ to view delivery terms</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <FileSearch className="h-4 w-4" />
              Quality Scores
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-center py-8 text-muted-foreground">
              <p className="text-sm">Select an RFQ to view quality scores</p>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Comparison Matrix</CardTitle>
          <CardDescription>
            Detailed side-by-side comparison of all quotations
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center py-12 text-muted-foreground">
            <Scale className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>Select an RFQ above to generate comparison matrix</p>
            <p className="text-sm mt-2">
              Compare prices, terms, delivery schedules, and more
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
