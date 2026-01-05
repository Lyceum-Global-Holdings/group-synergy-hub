import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCompany } from "@/contexts/CompanyContext";
import { useToast } from "@/hooks/use-toast";
import { TelegramSettings, UpdateTelegramSettingsData } from "@/types/telegramSettings";

export function useTelegramSettings() {
  const { selectedCompany } = useCompany();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: settings, isLoading, error } = useQuery({
    queryKey: ["telegram-settings", selectedCompany?.id],
    queryFn: async () => {
      if (!selectedCompany?.id) return null;
      
      const { data, error } = await supabase
        .from("telegram_settings")
        .select("*")
        .eq("company_id", selectedCompany.id)
        .maybeSingle();
      
      if (error) throw error;
      return data as TelegramSettings | null;
    },
    enabled: !!selectedCompany?.id,
  });

  const upsertMutation = useMutation({
    mutationFn: async (data: UpdateTelegramSettingsData) => {
      if (!selectedCompany?.id) throw new Error("No company selected");

      const { data: result, error } = await supabase
        .from("telegram_settings")
        .upsert({
          company_id: selectedCompany.id,
          ...data,
          updated_at: new Date().toISOString(),
        }, {
          onConflict: "company_id",
        })
        .select()
        .single();

      if (error) throw error;
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["telegram-settings", selectedCompany?.id] });
      toast({
        title: "Settings saved",
        description: "Telegram settings have been updated.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Failed to save",
        description: error.message || "Could not save Telegram settings.",
        variant: "destructive",
      });
    },
  });

  const testConnection = async (botToken: string, chatId: string): Promise<boolean> => {
    try {
      const response = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: chatId,
          text: "✅ Test connection successful! Your Telegram settings are configured correctly.",
        }),
      });

      const result = await response.json();
      
      if (!result.ok) {
        throw new Error(result.description || "Failed to send test message");
      }

      toast({
        title: "Connection successful!",
        description: "Test message sent to Telegram.",
      });
      return true;
    } catch (error: any) {
      toast({
        title: "Connection failed",
        description: error.message || "Could not connect to Telegram.",
        variant: "destructive",
      });
      return false;
    }
  };

  return {
    settings,
    isLoading,
    error,
    saveSettings: upsertMutation.mutateAsync,
    isSaving: upsertMutation.isPending,
    testConnection,
  };
}
