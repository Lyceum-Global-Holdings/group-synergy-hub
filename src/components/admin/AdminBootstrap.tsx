import React from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useBootstrapAdmin } from '@/hooks/useUsers';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Shield, AlertCircle } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';

export const AdminBootstrap: React.FC = () => {
  const { user } = useAuth();
  const bootstrapAdminMutation = useBootstrapAdmin();

  const handleBootstrap = () => {
    if (user?.id) {
      bootstrapAdminMutation.mutate(user.id);
    }
  };

  if (!user) {
    return null;
  }

  return (
    <Card className="w-full max-w-md mx-auto">
      <CardHeader className="text-center">
        <div className="mx-auto w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center mb-4">
          <Shield className="w-6 h-6 text-primary" />
        </div>
        <CardTitle>Admin Setup Required</CardTitle>
        <CardDescription>
          No administrator accounts exist yet. Grant yourself admin privileges to start managing users.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            This will grant administrator privileges to your current account ({user.email}).
          </AlertDescription>
        </Alert>
        
        <Button 
          onClick={handleBootstrap}
          disabled={bootstrapAdminMutation.isPending}
          className="w-full"
        >
          {bootstrapAdminMutation.isPending ? 'Granting Admin Access...' : 'Grant Admin Access'}
        </Button>
        
        <p className="text-xs text-muted-foreground text-center">
          After this, you'll be able to create and manage other users and their roles.
        </p>
      </CardContent>
    </Card>
  );
};