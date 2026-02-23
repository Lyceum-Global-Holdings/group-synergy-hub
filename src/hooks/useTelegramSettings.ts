import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCompany } from "@/contexts/CompanyContext";
import { useToast } from "@/hooks/use-toast";
import { invokeEdgeFunction } from "@/lib/edgeFunctionClient";

// Client-side type - excludes sensitive bot_token field
export interface TelegramSettingsClient {
  id: string;
  company_id: string;
  chat_id: string | null;
  is_enabled: boolean;
  notify_on_report_create: boolean;
  scheduled_send_enabled: boolean;
  scheduled_send_time: string | null;
  timezone: string | null;
  last_scheduled_send: string | null;
  created_at: string;
  updated_at: string;
  // bot_token is intentionally excluded - never sent to client
  has_bot_token: boolean; // Indicates if a token is configured without exposing it
}

export interface UpdateTelegramSettingsData {
  bot_token?: string | null;
  chat_id?: string | null;
  is_enabled?: boolean;
  notify_on_report_create?: boolean;
  scheduled_send_enabled?: boolean;
  scheduled_send_time?: string | null;
  timezone?: string | null;
}

export function useTelegramSettings() {
  const { selectedCompany } = useCompany();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: settings, isLoading, error } = useQuery({
    queryKey: ["telegram-settings", selectedCompany?.id],
    queryFn: async () => {
      if (!selectedCompany?.id) return null;
      
      // Fetch settings WITHOUT bot_token - it should never be sent to client
      const { data, error } = await supabase
        .from("telegram_settings")
        .select("id, company_id, chat_id, is_enabled, notify_on_report_create, scheduled_send_enabled, scheduled_send_time, timezone, last_scheduled_send, created_at, updated_at, bot_token")
        .eq("company_id", selectedCompany.id)
        .maybeSingle();
      
      if (error) throw error;
      
      if (!data) return null;
      
      // Transform to client-safe type - don't expose actual token, just whether it exists
      const clientSettings: TelegramSettingsClient = {
        id: data.id,
        company_id: data.company_id,
        chat_id: data.chat_id,
        is_enabled: data.is_enabled,
        notify_on_report_create: data.notify_on_report_create,
        scheduled_send_enabled: data.scheduled_send_enabled,
        scheduled_send_time: data.scheduled_send_time,
        timezone: data.timezone,
        last_scheduled_send: data.last_scheduled_send,
        created_at: data.created_at,
        updated_at: data.updated_at,
        has_bot_token: !!data.bot_token, // Boolean indicator only
      };
      
      return clientSettings;
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
        .select("id, company_id, chat_id, is_enabled, notify_on_report_create, scheduled_send_enabled, scheduled_send_time, timezone, last_scheduled_send, created_at, updated_at")
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

  // Test connection via server-side edge function - NEVER expose bot token to client
  const testConnection = async (botToken: string, chatIdsString: string): Promise<boolean> => {
    if (!selectedCompany?.id) {
      toast({
        title: "No company selected",
        description: "Please select a company first.",
        variant: "destructive",
      });
      return false;
    }

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
      // Call server-side edge function - token is sent securely and handled server-side
      const { data, error, suggestion } = await invokeEdgeFunction('test-telegram-connection', {
        body: {
          company_id: selectedCompany.id,
          bot_token: botToken,
          chat_id: chatIdsString,
        },
        companyId: selectedCompany.id,
      });

      if (error) throw new Error(suggestion || error.message);

      if (data?.all_success) {
        toast({
          title: "All connections successful!",
          description: `Test message sent to ${data.sent_count} chat(s).`,
        });
      } else if (data?.sent_count > 0) {
        const failedIds = data.results
          .filter((r: any) => !r.success)
          .map((r: any) => r.chatId)
          .join(', ');
        toast({
          title: "Partial success",
          description: `Sent to ${data.sent_count}/${data.total_chats} chats. Failed: ${failedIds}`,
          variant: "destructive",
        });
      } else {
        toast({
          title: "Connection failed",
          description: data?.error || "Could not send to any chats. Check your credentials.",
          variant: "destructive",
        });
      }

      return data?.sent_count > 0;
    } catch (error: any) {
      toast({
        title: "Connection failed",
        description: error.message || "Could not connect to Telegram.",
        variant: "destructive",
      });
      return false;
    }
  };

  // Test with saved credentials (no token passed - fetched server-side)
  const testSavedConnection = async (): Promise<boolean> => {
    if (!selectedCompany?.id) {
      toast({
        title: "No company selected",
        description: "Please select a company first.",
        variant: "destructive",
      });
      return false;
    }

    try {
      const { data, error, suggestion } = await invokeEdgeFunction('test-telegram-connection', {
        body: { company_id: selectedCompany.id },
        companyId: selectedCompany.id,
      });

      if (error) throw new Error(suggestion || error.message);

      if (data?.all_success) {
        toast({
          title: "Connection successful!",
          description: `Test message sent to ${data.sent_count} chat(s).`,
        });
        return true;
      } else if (data?.sent_count > 0) {
        toast({
          title: "Partial success",
          description: `Sent to ${data.sent_count}/${data.total_chats} chats.`,
          variant: "destructive",
        });
        return true;
      } else {
        toast({
          title: "Connection failed",
          description: data?.error || "Could not send to any chats.",
          variant: "destructive",
        });
        return false;
      }
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
      const { data, error, suggestion } = await invokeEdgeFunction('scheduled-telegram-reports', {
        body: { force: true, company_id: selectedCompany.id },
        companyId: selectedCompany.id,
      });

      if (error) throw new Error(suggestion || error.message);

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
    testSavedConnection,
    testScheduledSend,
  };
}
