import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

interface CreatedByCellProps {
  userId: string | null | undefined;
}

export function CreatedByCell({ userId }: CreatedByCellProps) {
  const { data: profile } = useQuery({
    queryKey: ["profile-name", userId],
    queryFn: async () => {
      if (!userId) return null;
      const { data } = await supabase
        .from("profiles")
        .select("full_name, avatar_url")
        .eq("id", userId)
        .maybeSingle();
      return data;
    },
    enabled: !!userId,
    staleTime: 5 * 60 * 1000,
  });

  if (!userId) return <span className="text-muted-foreground">—</span>;

  const name = profile?.full_name || "User";
  const initials = name
    .split(" ")
    .map((n: string) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  return (
    <div className="flex items-center gap-2">
      <Avatar className="h-6 w-6">
        <AvatarFallback className="text-xs bg-primary/10 text-primary">{initials}</AvatarFallback>
      </Avatar>
      <span className="text-sm truncate max-w-[120px]">{name}</span>
    </div>
  );
}
