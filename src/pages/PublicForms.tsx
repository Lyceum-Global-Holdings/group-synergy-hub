import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Copy, ExternalLink, FileText, UserPlus } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useToast } from "@/hooks/use-toast";

export default function PublicForms() {
  const navigate = useNavigate();
  const { toast } = useToast();

  const supplierRegistrationUrl = `${window.location.origin}/register-supplier`;
  const assetRequestUrl = `${window.location.origin}/request-asset`;

  const copyToClipboard = async (url: string, label: string) => {
    try {
      await navigator.clipboard.writeText(url);
      toast({
        title: "Link copied!",
        description: `${label} link copied to clipboard`,
      });
    } catch (error) {
      toast({
        title: "Failed to copy",
        description: "Please copy the link manually",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-4xl space-y-8">
        <div className="text-center space-y-2">
          <h1 className="text-4xl font-bold">Public Forms</h1>
          <p className="text-muted-foreground">
            Access our public forms without needing an account
          </p>
        </div>

        <div className="grid md:grid-cols-2 gap-6">
          <Card className="border-2 hover:border-primary/50 transition-colors">
            <CardHeader>
              <div className="flex items-center gap-3 mb-2">
                <div className="p-3 bg-primary/10 rounded-lg">
                  <UserPlus className="w-6 h-6 text-primary" />
                </div>
                <CardTitle className="text-2xl">Supplier Registration</CardTitle>
              </div>
              <CardDescription className="text-base">
                Register your company as a supplier through our self-service portal
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="p-3 bg-accent/50 rounded-md border text-sm font-mono break-all">
                {supplierRegistrationUrl}
              </div>
              <div className="flex gap-2">
                <Button
                  className="flex-1"
                  onClick={() => navigate("/register-supplier")}
                >
                  <ExternalLink className="w-4 h-4 mr-2" />
                  Open Form
                </Button>
                <Button
                  variant="outline"
                  onClick={() => copyToClipboard(supplierRegistrationUrl, "Supplier Registration")}
                >
                  <Copy className="w-4 h-4 mr-2" />
                  Copy Link
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card className="border-2 hover:border-primary/50 transition-colors">
            <CardHeader>
              <div className="flex items-center gap-3 mb-2">
                <div className="p-3 bg-primary/10 rounded-lg">
                  <FileText className="w-6 h-6 text-primary" />
                </div>
                <CardTitle className="text-2xl">Asset Request</CardTitle>
              </div>
              <CardDescription className="text-base">
                Submit a request for asset allocation or access
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="p-3 bg-accent/50 rounded-md border text-sm font-mono break-all">
                {assetRequestUrl}
              </div>
              <div className="flex gap-2">
                <Button
                  className="flex-1"
                  onClick={() => navigate("/request-asset")}
                >
                  <ExternalLink className="w-4 h-4 mr-2" />
                  Open Form
                </Button>
                <Button
                  variant="outline"
                  onClick={() => copyToClipboard(assetRequestUrl, "Asset Request")}
                >
                  <Copy className="w-4 h-4 mr-2" />
                  Copy Link
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="text-center">
          <Button
            variant="outline"
            onClick={() => navigate("/auth")}
          >
            Already have an account? Sign in
          </Button>
        </div>
      </div>
    </div>
  );
}
