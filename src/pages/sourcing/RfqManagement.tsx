import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { FileText, FilePlus, History, Clock } from "lucide-react";
import { GenerateReportButton } from "@/components/management/reports/GenerateReportButton";

export default function RfqManagement() {
  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">RFQ/RFP Management</h1>
          <p className="text-muted-foreground">
            Create and manage Request for Quotations and Proposals
          </p>
        </div>
        <div className="flex items-center gap-2">
          <GenerateReportButton template="SR-RFQ-REG-001" />
          <Button>
            <FilePlus className="h-4 w-4 mr-2" />
            New RFQ
          </Button>
        </div>
      </div>

      <Tabs defaultValue="active-rfq" className="w-full">
        <TabsList>
          <TabsTrigger value="active-rfq">
            <FileText className="h-4 w-4 mr-2" />
            Active RFQs
          </TabsTrigger>
          <TabsTrigger value="active-rfp">
            <FileText className="h-4 w-4 mr-2" />
            Active RFPs
          </TabsTrigger>
          <TabsTrigger value="pending">
            <Clock className="h-4 w-4 mr-2" />
            Pending Response
          </TabsTrigger>
          <TabsTrigger value="history">
            <History className="h-4 w-4 mr-2" />
            History
          </TabsTrigger>
        </TabsList>

        <TabsContent value="active-rfq" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle>Active Request for Quotations</CardTitle>
              <CardDescription>
                Manage ongoing RFQs sent to suppliers
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-center py-12 text-muted-foreground">
                <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>No active RFQs at the moment</p>
                <Button variant="outline" className="mt-4">
                  <FilePlus className="h-4 w-4 mr-2" />
                  Create New RFQ
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="active-rfp" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle>Active Request for Proposals</CardTitle>
              <CardDescription>
                Manage ongoing RFPs for complex procurement needs
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-center py-12 text-muted-foreground">
                <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>No active RFPs at the moment</p>
                <Button variant="outline" className="mt-4">
                  <FilePlus className="h-4 w-4 mr-2" />
                  Create New RFP
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="pending" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle>Pending Responses</CardTitle>
              <CardDescription>
                RFQs and RFPs awaiting supplier responses
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-center py-12 text-muted-foreground">
                <Clock className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>No pending responses</p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="history" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle>RFQ/RFP History</CardTitle>
              <CardDescription>
                View completed and cancelled requests
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-center py-12 text-muted-foreground">
                <History className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>No historical records found</p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
