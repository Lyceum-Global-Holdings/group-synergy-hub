import { useState } from "react";
import { Plus, Users, Shield, Edit, Trash2, UserPlus } from "lucide-react";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

const users = [
  {
    id: "1",
    name: "John Doe",
    email: "john.doe@acme.com",
    company: "Acme Corporation",
    roles: ["Procurement Manager", "Finance Viewer"],
    departments: ["Procurement", "Finance"],
    status: "active",
    lastLogin: "2024-01-15 09:30"
  },
  {
    id: "2",
    name: "Sarah Johnson",
    email: "sarah.j@global.com",
    company: "Global Industries",
    roles: ["Sourcing Manager"],
    departments: ["Sourcing"],
    status: "active",
    lastLogin: "2024-01-15 08:45"
  },
  {
    id: "3",
    name: "Mike Chen",
    email: "mike.chen@tech.com",
    company: "Tech Solutions Ltd",
    roles: ["Warehouse Manager", "Operations Lead"],
    departments: ["Warehouse", "Operations"],
    status: "active",
    lastLogin: "2024-01-14 16:22"
  }
];

const roles = [
  {
    id: "1",
    name: "Procurement Manager",
    department: "Procurement",
    permissions: ["Create PO", "Approve PR", "Manage Suppliers", "View Reports"],
    userCount: 5,
    description: "Full access to procurement operations"
  },
  {
    id: "2",
    name: "Finance Manager",
    department: "Finance",
    permissions: ["Manage GL", "Process Payments", "Budget Control", "Financial Reports"],
    userCount: 3,
    description: "Complete financial management access"
  },
  {
    id: "3",
    name: "Warehouse Manager",
    department: "Warehouse",
    permissions: ["Manage Inventory", "Process GRN", "Stock Adjustments", "Cycle Count"],
    userCount: 4,
    description: "Full warehouse operations control"
  },
  {
    id: "4",
    name: "Sourcing Manager",
    department: "Sourcing",
    permissions: ["Manage Suppliers", "RFQ Process", "Vendor Evaluation", "Contract Management"],
    userCount: 2,
    description: "Strategic sourcing and supplier management"
  }
];

export default function UserRoleManagement() {
  const [activeTab, setActiveTab] = useState("users");

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">User & Role Management</h1>
          <p className="text-muted-foreground">Manage users, roles, and permissions across the system</p>
        </div>
        
        <div className="flex gap-2">
          <Button variant="outline">
            <UserPlus className="h-4 w-4 mr-2" />
            Invite User
          </Button>
          <Button>
            <Plus className="h-4 w-4 mr-2" />
            Create Role
          </Button>
        </div>
      </div>

      {/* Statistics */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
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
            <CardTitle className="text-sm font-medium text-muted-foreground">Active Roles</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">15</div>
            <p className="text-xs text-muted-foreground">Department-based roles</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Online Users</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">24</div>
            <p className="text-xs text-muted-foreground">Currently active</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Pending Invites</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">8</div>
            <p className="text-xs text-muted-foreground">Awaiting acceptance</p>
          </CardContent>
        </Card>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="users">Users</TabsTrigger>
          <TabsTrigger value="roles">Roles & Permissions</TabsTrigger>
        </TabsList>

        <TabsContent value="users" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5" />
                System Users
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>User</TableHead>
                    <TableHead>Company</TableHead>
                    <TableHead>Roles</TableHead>
                    <TableHead>Departments</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Last Login</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {users.map((user) => (
                    <TableRow key={user.id}>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <Avatar className="h-8 w-8">
                            <AvatarImage src="" />
                            <AvatarFallback className="bg-primary text-primary-foreground text-xs">
                              {user.name.split(" ").map(n => n[0]).join("")}
                            </AvatarFallback>
                          </Avatar>
                          <div>
                            <div className="font-medium">{user.name}</div>
                            <div className="text-sm text-muted-foreground">{user.email}</div>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>{user.company}</TableCell>
                      <TableCell>
                        <div className="flex flex-col gap-1">
                          {user.roles.map((role) => (
                            <Badge key={role} variant="outline" className="text-xs w-fit">
                              {role}
                            </Badge>
                          ))}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          {user.departments.map((dept) => (
                            <Badge key={dept} variant="secondary" className="text-xs">
                              {dept}
                            </Badge>
                          ))}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant={user.status === "active" ? "default" : "secondary"}>
                          {user.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {user.lastLogin}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Button variant="outline" size="sm">
                            <Edit className="h-4 w-4" />
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
        </TabsContent>

        <TabsContent value="roles" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Shield className="h-5 w-5" />
                Role Management
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4">
                {roles.map((role) => (
                  <Card key={role.id} className="p-4">
                    <div className="flex items-start justify-between">
                      <div className="space-y-2">
                        <div className="flex items-center gap-2">
                          <h3 className="font-semibold">{role.name}</h3>
                          <Badge variant="outline">{role.department}</Badge>
                          <Badge variant="secondary">{role.userCount} users</Badge>
                        </div>
                        <p className="text-sm text-muted-foreground">{role.description}</p>
                        <div className="flex flex-wrap gap-1 mt-2">
                          {role.permissions.map((permission) => (
                            <Badge key={permission} variant="outline" className="text-xs">
                              {permission}
                            </Badge>
                          ))}
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <Button variant="outline" size="sm">
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button variant="outline" size="sm" className="text-destructive">
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}