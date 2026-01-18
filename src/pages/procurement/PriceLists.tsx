import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { DollarSign, Plus, Search, Calendar, Building2 } from "lucide-react";

export default function PriceLists() {
  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Price Lists</h1>
          <p className="text-muted-foreground">
            Manage supplier price agreements and pricing schedules
          </p>
        </div>
        <Button>
          <Plus className="h-4 w-4 mr-2" />
          New Price List
        </Button>
      </div>

      <div className="flex items-center gap-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input placeholder="Search price lists..." className="pl-9" />
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Active Price Lists</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">0</div>
            <p className="text-xs text-muted-foreground">Currently valid</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-amber-600">Expiring Soon</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-amber-600">0</div>
            <p className="text-xs text-muted-foreground">Within 30 days</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Expired</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-muted-foreground">0</div>
            <p className="text-xs text-muted-foreground">No longer valid</p>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="active" className="w-full">
        <TabsList>
          <TabsTrigger value="active">
            <DollarSign className="h-4 w-4 mr-2" />
            Active
          </TabsTrigger>
          <TabsTrigger value="by-supplier">
            <Building2 className="h-4 w-4 mr-2" />
            By Supplier
          </TabsTrigger>
          <TabsTrigger value="expiring">
            <Calendar className="h-4 w-4 mr-2" />
            Expiring Soon
          </TabsTrigger>
        </TabsList>

        <TabsContent value="active" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle>Active Price Lists</CardTitle>
              <CardDescription>
                Currently valid supplier price agreements
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-center py-12 text-muted-foreground">
                <DollarSign className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>No active price lists</p>
                <Button variant="outline" className="mt-4">
                  <Plus className="h-4 w-4 mr-2" />
                  Create Price List
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="by-supplier" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle>Price Lists by Supplier</CardTitle>
              <CardDescription>
                View price agreements organized by supplier
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-center py-12 text-muted-foreground">
                <Building2 className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>No supplier price lists found</p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="expiring" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle>Expiring Price Lists</CardTitle>
              <CardDescription>
                Price agreements expiring within the next 30 days
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-center py-12 text-muted-foreground">
                <Calendar className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>No price lists expiring soon</p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
