import { Link } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";

export default function PortalNoAccess() {
  const { signOut } = useAuth();
  return (
    <div className="min-h-screen flex items-center justify-center bg-muted/20 p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>No supplier access</CardTitle>
          <CardDescription>
            Your account is signed in but is not linked to any supplier portal yet. Ask your buyer
            to send you an invitation, then return to <Link to="/portal/accept-invite" className="underline">Accept invite</Link>.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button variant="outline" onClick={async () => { await signOut(); window.location.href = "/portal/login"; }}>
            Sign out
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
