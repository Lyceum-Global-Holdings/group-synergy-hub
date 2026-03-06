import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Send, Eye, EyeOff, Loader2, TestTube, Clock, Globe, Plus, X } from "lucide-react";
import { useTelegramSettings } from "@/hooks/useTelegramSettings";
import { format } from "date-fns";

const TIMEZONES = [
  { value: "UTC", label: "UTC (Coordinated Universal Time)", offset: 0 },
  { value: "Asia/Dubai", label: "Dubai (UTC+4)", offset: 4 },
  { value: "Asia/Kolkata", label: "India (UTC+5:30)", offset: 5.5 },
  { value: "Asia/Singapore", label: "Singapore (UTC+8)", offset: 8 },
  { value: "Asia/Tokyo", label: "Tokyo (UTC+9)", offset: 9 },
  { value: "Europe/London", label: "London (UTC+0/+1)", offset: 0 },
  { value: "Europe/Paris", label: "Paris (UTC+1/+2)", offset: 1 },
  { value: "America/New_York", label: "New York (UTC-5/-4)", offset: -5 },
  { value: "America/Los_Angeles", label: "Los Angeles (UTC-8/-7)", offset: -8 },
];

export function TelegramSettingsTab() {
  const { settings, isLoading, saveSettings, isSaving, testConnection, testScheduledSend } = useTelegramSettings();
  
  const [botToken, setBotToken] = useState("");
  const [chatIds, setChatIds] = useState<string[]>([]);
  const [newChatId, setNewChatId] = useState("");
  const [isEnabled, setIsEnabled] = useState(false);
  const [notifyOnCreate, setNotifyOnCreate] = useState(true);
  const [scheduledSendEnabled, setScheduledSendEnabled] = useState(false);
  const [scheduledSendTime, setScheduledSendTime] = useState("18:00");
  const [timezone, setTimezone] = useState("UTC");
  const [showToken, setShowToken] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [isTestingSend, setIsTestingSend] = useState(false);

  // Load settings when they're fetched
  useEffect(() => {
    if (settings) {
      // Bot token is NOT loaded from server (security) - user must re-enter to change
      // We show indicator if one is already configured
      setBotToken(""); // Never populated from server
      // Parse comma-separated chat IDs
      if (settings.chat_id) {
        setChatIds(settings.chat_id.split(',').map(id => id.trim()).filter(Boolean));
      } else {
        setChatIds([]);
      }
      setIsEnabled(settings.is_enabled);
      setNotifyOnCreate(settings.notify_on_report_create);
      setScheduledSendEnabled(settings.scheduled_send_enabled || false);
      setTimezone(settings.timezone || "UTC");
      // Parse time from "HH:MM:SS" format to "HH:MM"
      if (settings.scheduled_send_time) {
        const timeParts = settings.scheduled_send_time.split(':');
        setScheduledSendTime(`${timeParts[0]}:${timeParts[1]}`);
      }
    }
  }, [settings]);

  const handleAddChatId = () => {
    const trimmedId = newChatId.trim();
    if (trimmedId && !chatIds.includes(trimmedId)) {
      setChatIds([...chatIds, trimmedId]);
      setNewChatId("");
    }
  };

  const handleRemoveChatId = (idToRemove: string) => {
    setChatIds(chatIds.filter(id => id !== idToRemove));
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleAddChatId();
    }
  };

  const handleSave = async () => {
    const data: Record<string, any> = {
      chat_id: chatIds.length > 0 ? chatIds.join(',') : null,
      is_enabled: isEnabled,
      notify_on_report_create: notifyOnCreate,
      scheduled_send_enabled: scheduledSendEnabled,
      scheduled_send_time: scheduledSendEnabled ? `${scheduledSendTime}:00` : null,
      timezone: scheduledSendEnabled ? timezone : null,
    };

    // Only update bot_token if user entered a new one
    if (botToken.trim()) {
      data.bot_token = botToken;
    }

    await saveSettings(data);
  };

  const handleTest = async () => {
    if (!botToken || chatIds.length === 0) return;
    setIsTesting(true);
    await testConnection(botToken, chatIds.join(','));
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
            {settings?.has_bot_token && !botToken && (
              <span className="ml-2 text-primary">✓ Token configured (enter new value to change)</span>
            )}
          </p>
        </div>

        <div className="space-y-2">
          <Label>Chat IDs</Label>
          {chatIds.length > 0 && (
            <div className="flex flex-wrap gap-2 mb-2">
              {chatIds.map((id) => (
                <Badge key={id} variant="secondary" className="flex items-center gap-1 px-2 py-1">
                  <span className="font-mono text-xs">{id}</span>
                  <button
                    type="button"
                    onClick={() => handleRemoveChatId(id)}
                    className="ml-1 hover:bg-destructive/20 rounded-full p-0.5"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </Badge>
              ))}
            </div>
          )}
          <div className="flex gap-2">
            <Input
              placeholder="Enter chat ID..."
              value={newChatId}
              onChange={(e) => setNewChatId(e.target.value)}
              onKeyPress={handleKeyPress}
              className="flex-1"
            />
            <Button
              type="button"
              variant="outline"
              size="icon"
              onClick={handleAddChatId}
              disabled={!newChatId.trim()}
            >
              <Plus className="h-4 w-4" />
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            Add multiple chat IDs to send reports to different chats/groups
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
                <Label htmlFor="timezone">Timezone</Label>
                <Select value={timezone} onValueChange={setTimezone}>
                  <SelectTrigger className="w-64">
                    <Globe className="h-4 w-4 mr-2" />
                    <SelectValue placeholder="Select timezone" />
                  </SelectTrigger>
                  <SelectContent>
                    {TIMEZONES.map((tz) => (
                      <SelectItem key={tz.value} value={tz.value}>
                        {tz.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="send-time">Send Time</Label>
                <Input
                  id="send-time"
                  type="time"
                  value={scheduledSendTime}
                  onChange={(e) => setScheduledSendTime(e.target.value)}
                  className="w-32"
                />
                <p className="text-xs text-muted-foreground">
                  Reports created today will be sent at this time in your selected timezone
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
                  disabled={isTestingSend || (!botToken && !settings?.has_bot_token) || chatIds.length === 0}
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
            disabled={(!botToken && !settings?.has_bot_token) || chatIds.length === 0 || isTesting}
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
