import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { AlertTriangle, RefreshCw, ChevronDown, ChevronUp } from "lucide-react";
import { useState } from "react";

interface ReportErrorMessageProps {
  error: Error;
  onRetry?: () => void;
}

function getFriendlyMessage(message: string): string {
  const lower = message.toLowerCase();

  if (lower.includes("column") && lower.includes("does not exist")) {
    return "There's a report configuration issue. This usually resolves after a system update. Please try again or contact support.";
  }
  if (lower.includes("permission denied") || lower.includes("rls") || lower.includes("policy")) {
    return "You don't have permission to view this report. Please contact your administrator.";
  }
  if (lower.includes("network") || lower.includes("fetch") || lower.includes("failed to fetch")) {
    return "Unable to connect to the server. Please check your internet connection and try again.";
  }
  if (lower.includes("timeout") || lower.includes("timed out")) {
    return "The report is taking too long to generate. Try narrowing the date range or try again later.";
  }
  if (lower.includes("function") && lower.includes("does not exist")) {
    return "This report type is not yet available. A system update may be required.";
  }
  return "An error occurred while loading this report. Please try again.";
}

export function ReportErrorMessage({ error, onRetry }: ReportErrorMessageProps) {
  const [showDetails, setShowDetails] = useState(false);
  const friendlyMessage = getFriendlyMessage(error.message);

  return (
    <div className="py-6 px-4 flex justify-center">
      <Alert variant="destructive" className="max-w-lg">
        <AlertTriangle className="h-4 w-4" />
        <AlertTitle>Unable to load report</AlertTitle>
        <AlertDescription className="space-y-3">
          <p>{friendlyMessage}</p>
          <div className="flex items-center gap-2">
            {onRetry && (
              <Button variant="outline" size="sm" onClick={onRetry}>
                <RefreshCw className="h-3 w-3 mr-1" />
                Retry
              </Button>
            )}
            <Collapsible open={showDetails} onOpenChange={setShowDetails}>
              <CollapsibleTrigger asChild>
                <Button variant="ghost" size="sm" className="text-xs">
                  Details
                  {showDetails ? (
                    <ChevronUp className="h-3 w-3 ml-1" />
                  ) : (
                    <ChevronDown className="h-3 w-3 ml-1" />
                  )}
                </Button>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <pre className="mt-2 text-xs bg-muted p-2 rounded overflow-auto text-muted-foreground">
                  {error.message}
                </pre>
              </CollapsibleContent>
            </Collapsible>
          </div>
        </AlertDescription>
      </Alert>
    </div>
  );
}
