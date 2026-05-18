import { Skeleton } from "@/components/ui/skeleton";

/**
 * Lightweight skeleton used as the Suspense fallback for route transitions.
 * Keeps the app shell painted while the next page's chunk loads, so clicks
 * feel responsive even on cold-cache navigations.
 */
export function RouteSkeleton() {
  return (
    <div className="p-6 space-y-6" aria-busy="true" aria-live="polite">
      <div className="space-y-2">
        <Skeleton className="h-7 w-64" />
        <Skeleton className="h-4 w-96" />
      </div>
      <div className="flex gap-3">
        <Skeleton className="h-9 w-28" />
        <Skeleton className="h-9 w-28" />
        <Skeleton className="h-9 w-9 ml-auto" />
      </div>
      <div className="rounded-md border">
        <div className="border-b p-3">
          <Skeleton className="h-5 w-40" />
        </div>
        <div className="divide-y">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="flex items-center gap-4 p-3">
              <Skeleton className="h-4 w-6" />
              <Skeleton className="h-4 flex-1 max-w-xs" />
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-4 w-20" />
              <Skeleton className="h-8 w-8" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
