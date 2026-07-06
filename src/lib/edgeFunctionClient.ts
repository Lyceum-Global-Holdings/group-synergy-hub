import { supabase } from "@/integrations/supabase/client";

import { getCachedUser } from "@/lib/currentUser";
interface InvokeOptions {
  body?: any;
  companyId?: string;
}

interface InvokeResult<T> {
  data: T | null;
  error: Error | null;
  suggestion?: string;
}

// Known error patterns and their resolution suggestions
const ERROR_PATTERNS: Array<{ pattern: RegExp; suggestion: string }> = [
  {
    pattern: /telegram credentials not configured|bot_token.*not configured/i,
    suggestion: "Go to Settings > Telegram to configure your bot token and chat ID.",
  },
  {
    pattern: /access denied to this company|not a member/i,
    suggestion: "Your account may not have access to this company. Contact your admin.",
  },
  {
    pattern: /telegram integration is disabled/i,
    suggestion: "Enable Telegram integration in Settings > Telegram.",
  },
  {
    pattern: /empty request body|missing required/i,
    suggestion: "The request data was incomplete. Try again or regenerate the data.",
  },
  {
    pattern: /invalid.*auth|unauthorized|jwt/i,
    suggestion: "Your session may have expired. Please log in again.",
  },
  {
    pattern: /rate limit/i,
    suggestion: "Rate limit exceeded. Please wait a moment and try again.",
  },
  {
    pattern: /credits.*exhausted|no.*credits/i,
    suggestion: "AI credits exhausted. Please add credits to continue.",
  },
];

const RETRYABLE_STATUS_CODES = [500, 502, 503, 504];
const MAX_RETRIES = 2;
const RETRY_DELAYS = [1000, 3000]; // ms

function matchErrorPattern(errorMessage: string): string | undefined {
  for (const { pattern, suggestion } of ERROR_PATTERNS) {
    if (pattern.test(errorMessage)) {
      return suggestion;
    }
  }
  return undefined;
}

function isRetryableError(error: any): boolean {
  const message = error?.message?.toLowerCase() || "";
  // Network errors
  if (
    message.includes("network") ||
    message.includes("fetch") ||
    message.includes("timeout") ||
    message.includes("econnrefused")
  ) {
    return true;
  }
  // Check for 5xx status codes in the error message
  if (/non-2xx status code/i.test(message)) {
    return true;
  }
  return false;
}

function extractStatusCode(error: any): number | null {
  // Try to extract from error context
  if (error?.context?.status) return error.context.status;
  // Try to parse from message
  const match = error?.message?.match(/(\d{3})/);
  if (match) {
    const code = parseInt(match[1]);
    if (code >= 400 && code < 600) return code;
  }
  return null;
}

async function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function logError(
  functionName: string,
  errorMessage: string,
  errorCode: number | null,
  options: InvokeOptions,
  resolution: string | null,
  status: "open" | "auto_resolved"
): Promise<void> {
  try {
    const user = getCachedUser();

    await supabase.from("system_error_logs").insert({
      company_id: options.companyId || null,
      user_id: user?.id || null,
      function_name: functionName,
      error_message: errorMessage,
      error_code: errorCode,
      request_context: {
        keys: Object.keys(options.body || {}),
      },
      resolution,
      status,
    });
  } catch (logErr) {
    // Non-blocking: don't let logging failure affect the caller
    console.error("[EdgeFunctionClient] Failed to log error:", logErr);
  }
}

/**
 * Centralized edge function invocation wrapper with:
 * - Auto-retry for transient failures (5xx, network errors)
 * - Error logging to system_error_logs
 * - Known-error resolution suggestions
 */
export async function invokeEdgeFunction<T = any>(
  functionName: string,
  options: InvokeOptions = {}
): Promise<InvokeResult<T>> {
  let lastError: Error | null = null;
  let retryCount = 0;
  let wasAutoRetried = false;

  while (retryCount <= MAX_RETRIES) {
    try {
      const { data, error } = await supabase.functions.invoke(functionName, {
        body: options.body,
      });

      if (!error) {
        // Success — if it took retries, log as auto_resolved
        if (wasAutoRetried && lastError) {
          logError(
            functionName,
            lastError.message,
            null,
            options,
            `Auto-resolved after ${retryCount} retry(ies)`,
            "auto_resolved"
          );
        }
        return { data: data as T, error: null };
      }

      // We have an error from supabase.functions.invoke
      lastError = new Error(error.message || "Edge function error");
      const statusCode = extractStatusCode(error);

      // Only retry on transient/retryable errors
      const shouldRetry =
        retryCount < MAX_RETRIES &&
        (isRetryableError(error) ||
          (statusCode !== null && RETRYABLE_STATUS_CODES.includes(statusCode)));

      if (shouldRetry) {
        console.warn(
          `[EdgeFunctionClient] Retrying ${functionName} (attempt ${retryCount + 1}/${MAX_RETRIES})...`
        );
        wasAutoRetried = true;
        await sleep(RETRY_DELAYS[retryCount]);
        retryCount++;
        continue;
      }

      // Not retryable — break out and handle
      break;
    } catch (networkError: any) {
      lastError = new Error(
        networkError?.message || "Network error calling edge function"
      );

      if (retryCount < MAX_RETRIES) {
        console.warn(
          `[EdgeFunctionClient] Network error, retrying ${functionName} (attempt ${retryCount + 1}/${MAX_RETRIES})...`
        );
        wasAutoRetried = true;
        await sleep(RETRY_DELAYS[retryCount]);
        retryCount++;
        continue;
      }
      break;
    }
  }

  // Final failure — generate suggestion and log
  const errorMessage = lastError?.message || "Unknown error";
  const suggestion = matchErrorPattern(errorMessage);
  const statusCode = lastError ? extractStatusCode(lastError) : null;

  // Log in background (non-blocking)
  logError(
    functionName,
    errorMessage,
    statusCode,
    options,
    suggestion || null,
    "open"
  );

  return {
    data: null,
    error: lastError,
    suggestion,
  };
}
