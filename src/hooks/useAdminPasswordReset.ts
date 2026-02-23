import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useToast } from '@/hooks/use-toast';
import { invokeEdgeFunction } from '@/lib/edgeFunctionClient';

interface ResetPasswordParams {
  userId: string;
  newPassword: string;
}

export const useAdminPasswordReset = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ userId, newPassword }: ResetPasswordParams) => {
      const { data, error, suggestion } = await invokeEdgeFunction('admin-reset-password', {
        body: { userId, newPassword },
      });

      if (error) {
        throw new Error(suggestion || error.message || 'Failed to reset password');
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
