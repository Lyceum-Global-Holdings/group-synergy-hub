import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Send, Eye, EyeOff, Loader2, TestTube } from "lucide-react";
import { useTelegramSettings } from "@/hooks/useTelegramSettings";

export function TelegramSettingsTab() {
  const { settings, isLoading, saveSettings, isSaving, testConnection } = useTelegramSettings();
  
  const [botToken, setBotToken] = useState("");
  const [chatId, setChatId] = useState("");
  const [isEnabled, setIsEnabled] = useState(false);
  const [notifyOnCreate, setNotifyOnCreate] = useState(true);
  const [showToken, setShowToken] = useState(false);
  const [isTesting, setIsTesting] = useState(false);

  // Load settings when they're fetched
  useEffect(() => {
    if (settings) {
      setBotToken(settings.bot_token || "");
      setChatId(settings.chat_id || "");
      setIsEnabled(settings.is_enabled);
      setNotifyOnCreate(settings.notify_on_report_create);
    }
  }, [settings]);

  const handleSave = async () => {
    await saveSettings({
      bot_token: botToken || null,
      chat_id: chatId || null,
      is_enabled: isEnabled,
      notify_on_report_create: notifyOnCreate,
    });
  };

  const handleTest = async () => {
    if (!botToken || !chatId) return;
    setIsTesting(true);
    await testConnection(botToken, chatId);
    setIsTesting(false);
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
