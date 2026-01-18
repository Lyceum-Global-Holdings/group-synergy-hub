import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FolderOpen, Plus, Search, Package } from "lucide-react";

export default function Catalogs() {
  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Catalogs</h1>
          <p className="text-muted-foreground">
            Manage product catalogs and category hierarchies
          </p>
        </div>
        <Button>
          <Plus className="h-4 w-4 mr-2" />
          New Catalog
        </Button>
      </div>

      <div className="flex items-center gap-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input placeholder="Search catalogs..." className="pl-9" />
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Plus className="h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-sm text-muted-foreground mb-4">Create a new catalog</p>
            <Button variant="outline">
              <Plus className="h-4 w-4 mr-2" />
              Add Catalog
            </Button>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FolderOpen className="h-5 w-5" />
            All Catalogs
          </CardTitle>
          <CardDescription>
            Browse and manage your product catalogs
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center py-12 text-muted-foreground">
            <Package className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>No catalogs created yet</p>
            <p className="text-sm mt-2">
              Create catalogs to organize your products and streamline procurement
            </p>
            <Button variant="outline" className="mt-4">
              <Plus className="h-4 w-4 mr-2" />
              Create Your First Catalog
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
