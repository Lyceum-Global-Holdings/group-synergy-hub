import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface ResetPasswordParams {
  userId: string;
  newPassword: string;
}

export const useAdminPasswordReset = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ userId, newPassword }: ResetPasswordParams) => {
      // Get the current session token
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        throw new Error('No active session');
      }

      // Call the edge function with the session token
      const response = await fetch(
        `https://ajsyvuozkgcnnvvefeed.supabase.co/functions/v1/admin-reset-password`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({ userId, newPassword }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to reset password');
      }

      return data;
    },
    onSuccess: () => {
      toast({
        title: 'Password Reset',
        description: 'The user password has been reset successfully.',
      });
      // Invalidate users query to refresh the list
      queryClient.invalidateQueries({ queryKey: ['users'] });
    },
    onError: (error: Error) => {
      console.error('Password reset error:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to reset password. Please try again.',
        variant: 'destructive',
      });
    },
  });
};
