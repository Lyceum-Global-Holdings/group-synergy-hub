import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Users, UserPlus, Shield, Edit, Trash2, Crown, Loader2 } from 'lucide-react';
import { AddUserDialog } from '@/components/admin/AddUserDialog';
import { AddRoleDialog } from '@/components/admin/AddRoleDialog';
import { AdminBootstrap } from '@/components/admin/AdminBootstrap';
import { useUsers, useRoles, useAssignRole, useRemoveRole } from '@/hooks/useUsers';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';

export default function UserRoleManagement() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState('users');
  const [addUserOpen, setAddUserOpen] = useState(false);
  const [addRoleOpen, setAddRoleOpen] = useState(false);
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const [hasAnyAdmins, setHasAnyAdmins] = useState<boolean | null>(null);
  
  const { data: users = [], isLoading: usersLoading, error: usersError, refetch } = useUsers();
  const { data: roles = [], isLoading: rolesLoading, error: rolesError } = useRoles();
  const assignRole = useAssignRole();
  const removeRole = useRemoveRole();
  const { toast } = useToast();

  // Check admin status and if any admins exist
  useEffect(() => {
    const checkAdminStatus = async () => {
      if (!user?.id) return;

      // Check if current user is admin
      const { data: isAdminResult } = await supabase
        .rpc('is_admin', { _user_id: user.id });
      
      setIsAdmin(isAdminResult === true);

      // Check if any admin users exist
      const { data: adminUsers } = await supabase
        .from('user_roles')
        .select('id, roles!inner(*)')
        .eq('roles.app_role', 'admin');

      setHasAnyAdmins(adminUsers && adminUsers.length > 0);
    };

    checkAdminStatus();
  }, [user?.id, users]); // Re-check when users change

  const handleUserAdded = () => {
    // Refetch users after adding a new one and recheck admin status
    refetch();
  };

  const handleRoleAdded = () => {
    toast({
      title: "Role created",
      description: "The new role has been created successfully.",
    });
  };

  const handleRoleAssignment = async (userId: string, roleId: string, action: 'assign' | 'remove') => {
    try {
      if (action === 'assign') {
        await assignRole.mutateAsync({ userId, roleId });
        toast({
          title: "Role assigned",
          description: "The role has been assigned successfully.",
        });
      } else {
        await removeRole.mutateAsync({ userId, roleId });
        toast({
          title: "Role removed", 
          description: "The role has been removed successfully.",
        });
      }
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const isLoading = usersLoading || rolesLoading || isAdmin === null || hasAnyAdmins === null;
  const hasError = usersError || rolesError;

  if (hasError) {
    return (
      <div className="container mx-auto p-6">
        <Card>
          <CardContent className="pt-6">
            <div className="text-center text-destructive">
              Error loading data: {usersError?.message || rolesError?.message}
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Show loading while checking permissions
  if (isLoading) {
    return (
      <div className="container mx-auto p-6">
        <div className="flex items-center justify-center p-8">
          <Loader2 className="h-8 w-8 animate-spin" />
        </div>
      </div>
    );
  }

  // Show bootstrap component if no admins exist
  if (!hasAnyAdmins) {
    return (
      <div className="container mx-auto py-8">
        <AdminBootstrap />
      </div>
    );
  }

  // Show access denied if user is not admin
  if (!isAdmin) {
    return (
      <div className="container mx-auto py-8">
        <Card className="w-full max-w-md mx-auto">
          <CardHeader className="text-center">
            <CardTitle>Access Denied</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-center text-muted-foreground">
              You need administrator privileges to access user management.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const onlineUsers = users.filter(user => {
    const lastSignIn = user.last_sign_in_at ? new Date(user.last_sign_in_at) : null;
    return lastSignIn && (new Date().getTime() - lastSignIn.getTime()) < 30 * 60 * 1000; // 30 minutes
  }).length;

  const activeRoles = roles.filter(role => role.user_count > 0).length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">User & Role Management</h1>
          <p className="text-muted-foreground">Manage users, roles, and permissions across the system</p>
        </div>
        
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setAddUserOpen(true)}>
            <UserPlus className="h-4 w-4 mr-2" />
            Add User
          </Button>
          <Button onClick={() => setAddRoleOpen(true)}>
            <Shield className="h-4 w-4 mr-2" />
            Create Role
          </Button>
        </div>
      </div>

      {/* Statistics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Users</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{usersLoading ? '-' : users.length}</div>
            <p className="text-xs text-muted-foreground">Registered users</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Roles</CardTitle>
            <Shield className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{rolesLoading ? '-' : activeRoles}</div>
            <p className="text-xs text-muted-foreground">Roles with users</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Online Users</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{usersLoading ? '-' : onlineUsers}</div>
            <p className="text-xs text-muted-foreground">Active in last 30min</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Roles</CardTitle>
            <Crown className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{rolesLoading ? '-' : roles.length}</div>
            <p className="text-xs text-muted-foreground">System roles</p>
          </CardContent>
        </Card>
      </div>

      {/* Tabbed Interface */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="users">Users</TabsTrigger>
          <TabsTrigger value="roles">Roles & Permissions</TabsTrigger>
        </TabsList>

        <TabsContent value="users" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>User Management</CardTitle>
              <CardDescription>
                Manage user accounts, roles, and permissions
              </CardDescription>
            </CardHeader>
            <CardContent>
              {rolesLoading ? (
                <div className="flex items-center justify-center p-8">
                  <Loader2 className="h-8 w-8 animate-spin" />
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>User</TableHead>
                      <TableHead>Department</TableHead>
                      <TableHead>Roles</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Last Login</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {users.map((user) => (
                      <TableRow key={user.id}>
                        <TableCell className="flex items-center space-x-3">
                          <Avatar>
                            <AvatarImage src={user.avatar_url || ''} />
                            <AvatarFallback>
                              {user.full_name?.split(' ').map(n => n[0]).join('') || 
                               user.email.split('@')[0].substring(0, 2).toUpperCase()}
                            </AvatarFallback>
                          </Avatar>
                          <div>
                            <div className="font-medium">{user.full_name || 'Unknown User'}</div>
                            <div className="text-sm text-muted-foreground">{user.email}</div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">
                            {user.department || 'No Department'}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-wrap gap-1">
                            {user.roles.length > 0 ? (
                              user.roles.map((role) => (
                                <Badge key={role.id} variant="secondary">
                                  {role.name}
                                </Badge>
                              ))
                            ) : (
                              <Badge variant="outline">No Roles</Badge>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant={user.last_sign_in_at ? 'default' : 'secondary'}>
                            {user.last_sign_in_at ? 'Active' : 'Inactive'}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {user.last_sign_in_at ? 
                            format(new Date(user.last_sign_in_at), 'MMM dd, yyyy HH:mm') : 
                            'Never'}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end space-x-2">
                            <Button variant="ghost" size="sm">
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button variant="ghost" size="sm" className="text-destructive">
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="roles" className="space-y-4">
              {usersLoading ? (
            <div className="flex items-center justify-center p-8">
              <Loader2 className="h-8 w-8 animate-spin" />
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {roles.map((role) => (
                <Card key={role.id}>
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-lg">{role.name}</CardTitle>
                      <div className="flex gap-2">
                        <Badge variant="outline">{role.department || 'No Dept'}</Badge>
                        <Badge variant="secondary">{role.app_role}</Badge>
                      </div>
                    </div>
                    <CardDescription className="flex items-center gap-2">
                      <Users className="h-4 w-4" />
                      {role.user_count} users assigned
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <p className="text-sm text-muted-foreground">
                      {role.description || 'No description available'}
                    </p>
                    
                    <div className="space-y-2">
                      <h4 className="text-sm font-medium">Permissions</h4>
                      <div className="flex flex-wrap gap-1">
                        {role.permissions.length > 0 ? (
                          role.permissions.map((permission) => (
                            <Badge key={permission.id} variant="outline" className="text-xs">
                              {permission.name}
                            </Badge>
                          ))
                        ) : (
                          <Badge variant="outline" className="text-xs">No permissions</Badge>
                        )}
                      </div>
                    </div>

                    <div className="flex justify-between pt-4">
                      <Button variant="ghost" size="sm">
                        <Edit className="h-4 w-4 mr-2" />
                        Edit
                      </Button>
                      <Button variant="ghost" size="sm" className="text-destructive">
                        <Trash2 className="h-4 w-4 mr-2" />
                        Delete
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      <AddUserDialog
        open={addUserOpen}
        onOpenChange={setAddUserOpen}
        onUserAdded={handleUserAdded}
      />
      
      <AddRoleDialog
        open={addRoleOpen}
        onOpenChange={setAddRoleOpen}
        onRoleAdded={handleRoleAdded}
      />
    </div>
  );
}