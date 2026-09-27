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
      bootstrapAdminMutation.mutate(user.id, {
        // Reload so every cached role and menu check picks up the new role,
        // then start with the first step: creating a company.
        onSuccess: () => window.location.assign('/admin/companies'),
      });
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
        <CardTitle>Set up the first administrator</CardTitle>
        <CardDescription>
          This is the first account in the system and no administrator exists yet. Make yourself the Super Administrator to create companies, users and roles.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            This makes your account ({user.email}) the Super Administrator. The option disappears once an administrator or a second account exists.
          </AlertDescription>
        </Alert>
        
        <Button 
          onClick={handleBootstrap}
          disabled={bootstrapAdminMutation.isPending}
          className="w-full"
        >
          {bootstrapAdminMutation.isPending ? 'Setting up…' : 'Become Super Administrator'}
        </Button>
        
        <p className="text-xs text-muted-foreground text-center">
          Next you'll create your first company, then add users.
        </p>
      </CardContent>
    </Card>
  );
};