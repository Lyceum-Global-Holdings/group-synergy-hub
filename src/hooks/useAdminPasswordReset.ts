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
      // Use Supabase client's functions.invoke for proper environment handling
      const { data, error } = await supabase.functions.invoke('admin-reset-password', {
        body: { userId, newPassword },
      });

      if (error) {
        throw new Error(error.message || 'Failed to reset password');
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
