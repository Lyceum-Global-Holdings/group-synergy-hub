import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { AlertTriangle, Copy, Download } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface Props {
  codes: string[];
  onContinue?: () => void;
}

export function RecoveryCodesDisplay({ codes, onContinue }: Props) {
  const { toast } = useToast();

  const text = codes.join('\n');

  const copy = async () => {
    await navigator.clipboard.writeText(text);
    toast({ title: 'Copied', description: 'Recovery codes copied to clipboard.' });
  };

  const download = () => {
    const blob = new Blob(
      [`Lyceum Global Holdings — MFA Recovery Codes\nGenerated: ${new Date().toISOString()}\n\n${text}\n`],
      { type: 'text/plain' },
    );
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'lgh-mfa-recovery-codes.txt';
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-start gap-2 rounded-md border border-warning/40 bg-warning/10 p-3 text-sm">
        <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0 text-warning" />
        <div>
          <p className="font-medium text-foreground">Save these codes in a safe place.</p>
          <p className="text-muted-foreground">
            Each code can be used once if you lose access to your authenticator app. They will not be shown again.
          </p>
        </div>
      </div>

      <Card className="p-4">
        <div className="grid grid-cols-2 gap-2 font-mono text-sm">
          {codes.map((c) => (
            <div key={c} className="rounded bg-muted px-2 py-1 text-center">
              {c}
            </div>
          ))}
        </div>
      </Card>

      <div className="flex flex-wrap gap-2">
        <Button type="button" variant="outline" size="sm" onClick={copy}>
          <Copy className="h-4 w-4 mr-2" /> Copy
        </Button>
        <Button type="button" variant="outline" size="sm" onClick={download}>
          <Download className="h-4 w-4 mr-2" /> Download
        </Button>
        {onContinue && (
          <Button type="button" className="ml-auto" onClick={onContinue}>
            I have saved my codes
          </Button>
        )}
      </div>
    </div>
  );
}
