/**
 * A room's progress: the average of its stages, a completed stage counting as
 * 100%. The database (room_progress) uses the same rule for project progress.
 */
export function roomProgress(stages: { status?: string | null; completion_percentage?: number | null }[]): number {
  if (stages.length === 0) return 0;
  const total = stages.reduce(
    (sum, s) => sum + (s.status === "completed" ? 100 : Math.min(Math.max(s.completion_percentage ?? 0, 0), 100)),
    0,
  );
  return Math.round(total / stages.length);
}
