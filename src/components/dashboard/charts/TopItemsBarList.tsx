interface Props {
  data: Array<{ item_id: string; name: string; item_code: string | null; qty: number }>;
  tone?: "primary" | "warning";
}

export function TopItemsBarList({ data, tone = "primary" }: Props) {
  if (!data || data.length === 0) {
    return <p className="text-xs text-muted-foreground p-6 text-center">No data in the last 30 days.</p>;
  }
  const max = Math.max(...data.map((r) => Number(r.qty) || 0), 1);
  const barColor = tone === "warning" ? "bg-warning" : "bg-primary";
  return (
    <div className="space-y-3 p-1">
      {data.map((row) => {
        const pct = (Number(row.qty) / max) * 100;
        return (
          <div key={row.item_id} className="space-y-1">
            <div className="flex items-center justify-between gap-2 text-xs">
              <span className="truncate font-medium text-foreground" title={row.name}>
                {row.name}
              </span>
              <span className="font-mono tabular-nums text-foreground shrink-0">
                {Number(row.qty).toLocaleString()}
              </span>
            </div>
            <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
              <div className={`h-full ${barColor} rounded-full transition-all`} style={{ width: `${pct}%` }} />
            </div>
            {row.item_code && (
              <div className="text-[10px] font-mono text-muted-foreground">{row.item_code}</div>
            )}
          </div>
        );
      })}
    </div>
  );
}
