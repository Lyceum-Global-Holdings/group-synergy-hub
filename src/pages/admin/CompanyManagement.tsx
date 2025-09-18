import { useState } from "react";
import { Plus, Building2, Edit, Trash2, Settings } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const companies = [
  {
    id: "1",
    name: "Acme Corporation",
    code: "ACME",
    status: "active",
    address: "123 Business Ave, New York, NY",
    modules: ["Finance", "Procurement", "Warehouse"],
    users: 45,
    createdDate: "2023-01-15"
  },
  {
    id: "2",
    name: "Global Industries",
    code: "GLOB",
    status: "active",
    address: "456 Corporate Blvd, Los Angeles, CA",
    modules: ["Finance", "Sourcing", "Management"],
    users: 32,
    createdDate: "2023-03-22"
  },
  {
    id: "3",
    name: "Tech Solutions Ltd",
    code: "TECH",
    status: "active",
    address: "789 Innovation Dr, San Francisco, CA",
    modules: ["Procurement", "Warehouse", "Sourcing"],
    users: 28,
    createdDate: "2023-06-10"
  },
  {
    id: "4",
    name: "Manufacturing Co",
    code: "MFG",
    status: "inactive",
    address: "321 Industrial Way, Detroit, MI",
    modules: ["Finance", "Warehouse"],
    users: 15,
    createdDate: "2023-02-08"
  }
];

export default function CompanyManagement() {
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Company Management</h1>
          <p className="text-muted-foreground">Manage companies and their module allocations</p>
        </div>
        
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Add Company
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[600px]">
            <DialogHeader>
              <DialogTitle>Add New Company</DialogTitle>
              <DialogDescription>
                Create a new company and configure its modules and settings.
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Company Name</Label>
                  <Input id="name" placeholder="Enter company name" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="code">Company Code</Label>
                  <Input id="code" placeholder="e.g., ACME" />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="address">Address</Label>
                <Input id="address" placeholder="Enter company address" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="status">Status</Label>
                <Select>
                  <SelectTrigger>
                    <SelectValue placeholder="Select status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="inactive">Inactive</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex justify-end gap-2 pt-4">
                <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
                  Cancel
                </Button>
                <Button onClick={() => setIsDialogOpen(false)}>
                  Create Company
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Statistics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Companies</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">4</div>
            <p className="text-xs text-muted-foreground">3 active, 1 inactive</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Users</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">120</div>
            <p className="text-xs text-muted-foreground">Across all companies</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Active Modules</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">15</div>
            <p className="text-xs text-muted-foreground">Total module instances</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">System Health</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 bg-success rounded-full"></div>
              <span className="text-sm font-medium">Operational</span>
            </div>
            <p className="text-xs text-muted-foreground">All systems running</p>
          </CardContent>
        </Card>
      </div>

      {/* Companies Table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Building2 className="h-5 w-5" />
            Companies
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Company</TableHead>
                <TableHead>Code</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Users</TableHead>
                <TableHead>Modules</TableHead>
                <TableHead>Created</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {companies.map((company) => (
                <TableRow key={company.id}>
                  <TableCell>
                    <div>
                      <div className="font-medium">{company.name}</div>
                      <div className="text-sm text-muted-foreground">{company.address}</div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline">{company.code}</Badge>
                  </TableCell>
                  <TableCell>
                    <Badge 
                      variant={company.status === "active" ? "default" : "secondary"}
                    >
                      {company.status}
                    </Badge>
                  </TableCell>
                  <TableCell>{company.users}</TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      {company.modules.map((module) => (
                        <Badge key={module} variant="outline" className="text-xs">
                          {module}
                        </Badge>
                      ))}
                    </div>
                  </TableCell>
                  <TableCell>{company.createdDate}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Button variant="outline" size="sm">
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button variant="outline" size="sm">
                        <Settings className="h-4 w-4" />
                      </Button>
                      <Button variant="outline" size="sm" className="text-destructive">
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}