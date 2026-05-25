import { Link } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { ScanLine, PackageCheck, ChevronRight } from "lucide-react";

export default function ScannerHome() {
  return (
    <div className="max-w-md mx-auto px-4 py-6 space-y-4">
      <div className="text-center py-4">
        <h1 className="text-2xl font-bold text-foreground">What would you like to scan?</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Choose an action to get started.
        </p>
      </div>

      <Link to="/scan?intent=adjust-stock" className="block">
        <Card className="hover:shadow-md transition-all active:scale-[0.98] border-2">
          <CardContent className="flex items-center gap-4 p-6">
            <div className="w-14 h-14 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
              <ScanLine className="h-7 w-7 text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="font-semibold text-foreground text-base">Scan to adjust stock</div>
              <div className="text-sm text-muted-foreground mt-0.5">
                Open a bin and update on-hand quantity
              </div>
            </div>
            <ChevronRight className="h-5 w-5 text-muted-foreground shrink-0" />
          </CardContent>
        </Card>
      </Link>

      <Link to="/scan?intent=move-asset" className="block">
        <Card className="hover:shadow-md transition-all active:scale-[0.98] border-2">
          <CardContent className="flex items-center gap-4 p-6">
            <div className="w-14 h-14 rounded-xl bg-info/10 flex items-center justify-center shrink-0">
              <PackageCheck className="h-7 w-7 text-info" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="font-semibold text-foreground text-base">Scan to move asset</div>
              <div className="text-sm text-muted-foreground mt-0.5">
                Transfer an asset to a new location
              </div>
            </div>
            <ChevronRight className="h-5 w-5 text-muted-foreground shrink-0" />
          </CardContent>
        </Card>
      </Link>

      <p className="text-xs text-muted-foreground text-center pt-6">
        Lyceum Global Holdings · Scanner
      </p>
    </div>
  );
}
