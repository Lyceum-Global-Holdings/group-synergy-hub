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

  const testConnection = async (botToken: string, chatIdsString: string): Promise<boolean> => {
    const chatIds = chatIdsString.split(',').map(id => id.trim()).filter(Boolean);
    
    if (chatIds.length === 0) {
      toast({
        title: "No chat IDs",
        description: "Please add at least one chat ID.",
        variant: "destructive",
      });
      return false;
    }

    try {
      let successCount = 0;
      const failedIds: string[] = [];

      for (const chatId of chatIds) {
        const response = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            chat_id: chatId,
            text: "✅ Test connection successful! Your Telegram settings are configured correctly.",
          }),
        });

        const result = await response.json();
        
        if (result.ok) {
          successCount++;
        } else {
          failedIds.push(chatId);
        }
      }

      if (successCount === chatIds.length) {
        toast({
          title: "All connections successful!",
          description: `Test message sent to ${successCount} chat(s).`,
        });
      } else if (successCount > 0) {
        toast({
          title: "Partial success",
          description: `Sent to ${successCount}/${chatIds.length} chats. Failed: ${failedIds.join(', ')}`,
          variant: "destructive",
        });
      } else {
        toast({
          title: "Connection failed",
          description: `Could not send to any chats. Check your chat IDs.`,
          variant: "destructive",
        });
      }

      return successCount > 0;
    } catch (error: any) {
      toast({
        title: "Connection failed",
        description: error.message || "Could not connect to Telegram.",
        variant: "destructive",
      });
      return false;
    }
  };

  const testScheduledSend = async (): Promise<boolean> => {
    if (!selectedCompany?.id) {
      toast({
        title: "No company selected",
        description: "Please select a company first.",
        variant: "destructive",
      });
      return false;
    }

    try {
      const { data, error } = await supabase.functions.invoke('scheduled-telegram-reports', {
        body: { force: true, company_id: selectedCompany.id }
      });

      if (error) throw error;

      if (data?.processed > 0) {
        toast({
          title: "Reports sent!",
          description: `Successfully sent ${data.processed} report(s) to Telegram.`,
        });
      } else {
        toast({
          title: "No reports to send",
          description: "No reports found for today to send.",
        });
      }
      return true;
    } catch (error: any) {
      toast({
        title: "Failed to send",
        description: error.message || "Could not send scheduled reports.",
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
    testScheduledSend,
  };
}
