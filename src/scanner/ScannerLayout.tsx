import { ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { LogOut, ScanLine } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";

export default function ScannerLayout({ children }: { children: ReactNode }) {
  const { signOut } = useAuth();
  const navigate = useNavigate();

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <header className="border-b bg-card sticky top-0 z-10">
        <div className="flex items-center justify-between px-4 py-3 max-w-md mx-auto w-full">
          <button
            onClick={() => navigate("/")}
            className="flex items-center gap-2 font-semibold text-foreground"
          >
            <ScanLine className="h-5 w-5 text-primary" />
            LGH Scanner
          </button>
          <Button
            variant="ghost"
            size="sm"
            onClick={async () => {
              await signOut();
              navigate("/auth");
            }}
            aria-label="Sign out"
          >
            <LogOut className="h-4 w-4" />
          </Button>
        </div>
      </header>
      <main className="flex-1">{children}</main>
    </div>
  );
}
