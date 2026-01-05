import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Send, Eye, EyeOff, Loader2, TestTube, Clock } from "lucide-react";
import { useTelegramSettings } from "@/hooks/useTelegramSettings";
import { format } from "date-fns";

export function TelegramSettingsTab() {
  const { settings, isLoading, saveSettings, isSaving, testConnection, testScheduledSend } = useTelegramSettings();
  
  const [botToken, setBotToken] = useState("");
  const [chatId, setChatId] = useState("");
  const [isEnabled, setIsEnabled] = useState(false);
  const [notifyOnCreate, setNotifyOnCreate] = useState(true);
  const [scheduledSendEnabled, setScheduledSendEnabled] = useState(false);
  const [scheduledSendTime, setScheduledSendTime] = useState("18:00");
  const [showToken, setShowToken] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [isTestingSend, setIsTestingSend] = useState(false);

  // Load settings when they're fetched
  useEffect(() => {
    if (settings) {
      setBotToken(settings.bot_token || "");
      setChatId(settings.chat_id || "");
      setIsEnabled(settings.is_enabled);
      setNotifyOnCreate(settings.notify_on_report_create);
      setScheduledSendEnabled(settings.scheduled_send_enabled || false);
      // Parse time from "HH:MM:SS" format to "HH:MM"
      if (settings.scheduled_send_time) {
        const timeParts = settings.scheduled_send_time.split(':');
        setScheduledSendTime(`${timeParts[0]}:${timeParts[1]}`);
      }
    }
  }, [settings]);

  const handleSave = async () => {
    await saveSettings({
      bot_token: botToken || null,
      chat_id: chatId || null,
      is_enabled: isEnabled,
      notify_on_report_create: notifyOnCreate,
      scheduled_send_enabled: scheduledSendEnabled,
      scheduled_send_time: scheduledSendEnabled ? `${scheduledSendTime}:00` : null,
    });
  };

  const handleTest = async () => {
    if (!botToken || !chatId) return;
    setIsTesting(true);
    await testConnection(botToken, chatId);
    setIsTesting(false);
  };

  const handleTestScheduledSend = async () => {
    setIsTestingSend(true);
    await testScheduledSend();
    setIsTestingSend(false);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Send className="h-5 w-5" />
          Telegram Settings
        </CardTitle>
        <CardDescription>
          Configure Telegram notifications for site reports
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <Label htmlFor="telegram-enabled">Enable Telegram</Label>
            <p className="text-sm text-muted-foreground">
              Send reports via Telegram
            </p>
          </div>
          <Switch
            id="telegram-enabled"
            checked={isEnabled}
            onCheckedChange={setIsEnabled}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="bot-token">Bot Token</Label>
          <div className="relative">
            <Input
              id="bot-token"
              type={showToken ? "text" : "password"}
              placeholder="Enter your Telegram bot token"
              value={botToken}
              onChange={(e) => setBotToken(e.target.value)}
              className="pr-10"
            />
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="absolute right-0 top-0 h-full px-3"
              onClick={() => setShowToken(!showToken)}
            >
              {showToken ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            Get this from @BotFather on Telegram
          </p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="chat-id">Chat ID</Label>
          <Input
            id="chat-id"
            placeholder="Enter your Telegram chat ID"
            value={chatId}
            onChange={(e) => setChatId(e.target.value)}
          />
          <p className="text-xs text-muted-foreground">
            Your personal or group chat ID (numeric)
          </p>
        </div>

        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <Label htmlFor="notify-on-create">Auto-notify on Report Creation</Label>
            <p className="text-sm text-muted-foreground">
              Automatically send reports when created
            </p>
          </div>
          <Switch
            id="notify-on-create"
            checked={notifyOnCreate}
            onCheckedChange={setNotifyOnCreate}
          />
        </div>

        <div className="border-t pt-4">
          <div className="flex items-center gap-2 mb-4">
            <Clock className="h-5 w-5 text-muted-foreground" />
            <h4 className="font-medium">Scheduled Reports</h4>
          </div>

          <div className="flex items-center justify-between mb-4">
            <div className="space-y-0.5">
              <Label htmlFor="scheduled-send">Enable Scheduled Sending</Label>
              <p className="text-sm text-muted-foreground">
                Automatically send daily report summary at a specific time
              </p>
            </div>
            <Switch
              id="scheduled-send"
              checked={scheduledSendEnabled}
              onCheckedChange={setScheduledSendEnabled}
            />
          </div>

          {scheduledSendEnabled && (
            <div className="space-y-4 pl-4 border-l-2 border-primary/20">
              <div className="space-y-2">
                <Label htmlFor="send-time">Send Time (UTC)</Label>
                <Input
                  id="send-time"
                  type="time"
                  value={scheduledSendTime}
                  onChange={(e) => setScheduledSendTime(e.target.value)}
                  className="w-32"
                />
                <p className="text-xs text-muted-foreground">
                  Reports created today will be sent at this time (UTC timezone)
                </p>
              </div>

              {settings?.last_scheduled_send && (
                <div className="text-sm text-muted-foreground">
                  <span className="font-medium">Last sent:</span>{" "}
                  {format(new Date(settings.last_scheduled_send), "PPp")}
                </div>
              )}

              <div className="pt-2">
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={handleTestScheduledSend}
                  disabled={isTestingSend || !botToken || !chatId}
                >
                  {isTestingSend ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Send className="mr-2 h-4 w-4" />
                  )}
                  Test Send Now
                </Button>
                <p className="text-xs text-muted-foreground mt-1">
                  Immediately send today's reports to test the scheduled feature
                </p>
              </div>
            </div>
          )}
        </div>

        <div className="flex gap-2 pt-4">
          <Button
            variant="outline"
            onClick={handleTest}
            disabled={!botToken || !chatId || isTesting}
          >
            {isTesting ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <TestTube className="mr-2 h-4 w-4" />
            )}
            Test Connection
          </Button>
          <Button onClick={handleSave} disabled={isSaving}>
            {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Save Settings
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
