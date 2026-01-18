import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CheckCircle2, AlertTriangle, FileCheck, XCircle } from "lucide-react";

export default function ThreeWayMatch() {
  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">3-Way Match</h1>
          <p className="text-muted-foreground">
            Match Purchase Orders, Goods Receipts, and Invoices
          </p>
        </div>
        <Button>
          <FileCheck className="h-4 w-4 mr-2" />
          New Match
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Pending Match</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">0</div>
            <p className="text-xs text-muted-foreground">Awaiting verification</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-green-600">Matched</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">0</div>
            <p className="text-xs text-muted-foreground">Successfully matched</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-amber-600">Exceptions</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-amber-600">0</div>
            <p className="text-xs text-muted-foreground">Requires review</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-red-600">Failed</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">0</div>
            <p className="text-xs text-muted-foreground">Match failed</p>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="pending" className="w-full">
        <TabsList>
          <TabsTrigger value="pending">
            <FileCheck className="h-4 w-4 mr-2" />
            Pending
          </TabsTrigger>
          <TabsTrigger value="matched">
            <CheckCircle2 className="h-4 w-4 mr-2" />
            Matched
          </TabsTrigger>
          <TabsTrigger value="exceptions">
            <AlertTriangle className="h-4 w-4 mr-2" />
            Exceptions
          </TabsTrigger>
          <TabsTrigger value="failed">
            <XCircle className="h-4 w-4 mr-2" />
            Failed
          </TabsTrigger>
        </TabsList>

        <TabsContent value="pending" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle>Pending Matches</CardTitle>
              <CardDescription>
                Documents awaiting 3-way match verification
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-center py-12 text-muted-foreground">
                <FileCheck className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>No pending matches</p>
                <p className="text-sm mt-2">
                  PO, GRN, and Invoice will appear here for matching
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="matched" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle>Successfully Matched</CardTitle>
              <CardDescription>
                Documents that passed 3-way match verification
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-center py-12 text-muted-foreground">
                <CheckCircle2 className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>No matched documents</p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="exceptions" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle>Match Exceptions</CardTitle>
              <CardDescription>
                Documents with discrepancies requiring manual review
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-center py-12 text-muted-foreground">
                <AlertTriangle className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>No exceptions found</p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="failed" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle>Failed Matches</CardTitle>
              <CardDescription>
                Documents that failed 3-way match verification
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-center py-12 text-muted-foreground">
                <XCircle className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>No failed matches</p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
