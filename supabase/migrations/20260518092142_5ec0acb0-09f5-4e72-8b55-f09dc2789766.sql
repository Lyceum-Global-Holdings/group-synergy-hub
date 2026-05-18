SELECT cron.schedule(
  'telegram-job-dispatcher-every-5min',
  '*/5 * * * *',
  $$
  SELECT net.http_post(
    url := 'https://ajsyvuozkgcnnvvefeed.supabase.co/functions/v1/telegram-job-dispatcher',
    headers := '{"Content-Type":"application/json","apikey":"eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFqc3l2dW96a2djbm52dmVmZWVkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTgxNzg1NzYsImV4cCI6MjA3Mzc1NDU3Nn0.FlmuH3bEof12Bjetv-_3hKY13elsE6smhR4ie3imePA"}'::jsonb,
    body := '{}'::jsonb
  );
  $$
);