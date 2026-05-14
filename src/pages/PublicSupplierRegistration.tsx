import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { CheckCircle, Loader2 } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { invokeEdgeFunction } from "@/lib/edgeFunctionClient";
import { toast } from "sonner";
import TurnstileWidget from "@/components/security/TurnstileWidget";
import { useTurnstileSiteKey } from "@/hooks/useTurnstileSiteKey";
import { useTurnstileEnabledFor } from "@/hooks/usePublicSecuritySettings";
import DynamicSupplierForm from "@/components/sourcing/registration/DynamicSupplierForm";
import { fetchPublicSupplierForm } from "@/hooks/useSupplierFormConfig";
import { DEFAULT_SUPPLIER_FORM_SCHEMA, SupplierFormSchema } from "@/lib/supplierFormSchema";

export default function PublicSupplierRegistration() {
  const [params] = useSearchParams();
  const slug = params.get("c") || "";

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);
  const [companyName, setCompanyName] = useState<string>("");
  const [companyId, setCompanyId] = useState<string | null>(null);
  const [schema, setSchema] = useState<SupplierFormSchema | null>(null);
  const [loadingSchema, setLoadingSchema] = useState(true);
  const [notFound, setNotFound] = useState(false);

  const { data: turnstile } = useTurnstileSiteKey();
  const turnstileEnabled = useTurnstileEnabledFor("public_registration");

  useEffect(() => {
    const root = document.getElementById("root");
    const previous = {
      htmlOverflow: document.documentElement.style.overflow,
      htmlHeight: document.documentElement.style.height,
      bodyOverflow: document.body.style.overflow,
      bodyHeight: document.body.style.height,
      rootOverflow: root?.style.overflow,
      rootHeight: root?.style.height,
    };

    document.documentElement.style.overflow = "auto";
    document.documentElement.style.height = "auto";
    document.body.style.overflow = "auto";
    document.body.style.height = "auto";
    if (root) {
      root.style.overflow = "visible";
      root.style.height = "auto";
    }

    return () => {
      document.documentElement.style.overflow = previous.htmlOverflow;
      document.documentElement.style.height = previous.htmlHeight;
      document.body.style.overflow = previous.bodyOverflow;
      document.body.style.height = previous.bodyHeight;
      if (root) {
        root.style.overflow = previous.rootOverflow || "";
        root.style.height = previous.rootHeight || "";
      }
    };
  }, []);

  useEffect(() => {
    let active = true;
    (async () => {
      setLoadingSchema(true);
      try {
        if (slug) {
          const result = await fetchPublicSupplierForm(slug);
          if (!active) return;
          if (!result) {
            setNotFound(true);
          } else {
            setCompanyName(result.company_name);
            setCompanyId(result.company_id);
            setSchema(result.schema);
          }
        } else {
          setSchema(DEFAULT_SUPPLIER_FORM_SCHEMA);
        }
      } catch (e) {
        console.error(e);
        setSchema(DEFAULT_SUPPLIER_FORM_SCHEMA);
      } finally {
        if (active) setLoadingSchema(false);
      }
    })();
    return () => { active = false; };
  }, [slug]);

  const onSubmit = async (data: Record<string, any>) => {
    if (turnstileEnabled && !captchaToken) {
      toast.error("Please complete the bot protection challenge.");
      return;
    }
    setIsSubmitting(true);
    try {
      const { data: result, error, suggestion } = await invokeEdgeFunction("public-supplier-registration", {
        body: { supplier_data: data, turnstile_token: captchaToken, company_slug: slug || undefined, company_id: companyId },
      });
      if (error) throw new Error(suggestion || error.message);
      setIsSubmitted(true);
      toast.success("Registration submitted successfully!");
    } catch (error: any) {
      console.error("Registration error:", error);
      toast.error(`Registration failed: ${error.message}`);
      setCaptchaToken(null);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isSubmitted) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary/5 to-secondary/5 p-4">
        <Card className="max-w-md w-full">
          <CardContent className="pt-6 text-center">
            <div className="mb-4 flex justify-center">
              <div className="rounded-full bg-green-100 p-3">
                <CheckCircle className="w-12 h-12 text-green-600" />
              </div>
            </div>
            <h2 className="text-2xl font-bold mb-2">Registration Submitted!</h2>
            <p className="text-muted-foreground mb-4">Thank you for registering as a supplier. Your application has been submitted for review.</p>
            <p className="text-sm text-muted-foreground">We will verify your information and contact you via email within 2-3 business days.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (notFound) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <Card className="max-w-md w-full">
          <CardContent className="pt-6 text-center">
            <h2 className="text-xl font-semibold">Registration link is invalid</h2>
            <p className="text-muted-foreground mt-2">Please contact the organisation that shared this link with you.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/5 to-secondary/5 py-12 px-4">
      <div className="max-w-4xl mx-auto">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold mb-2">Supplier Registration</h1>
          <p className="text-muted-foreground text-lg">
            {companyName ? `Join ${companyName}'s supplier network` : "Join our supplier network"} by completing the form below
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Registration Form</CardTitle>
            <CardDescription>Please provide accurate information. All fields marked with * are required.</CardDescription>
          </CardHeader>
          <CardContent>
            {loadingSchema || !schema ? (
              <div className="flex items-center justify-center py-12 text-muted-foreground">
                <Loader2 className="w-5 h-5 animate-spin mr-2" /> Loading form...
              </div>
            ) : (
              <DynamicSupplierForm
                schema={schema}
                submitting={isSubmitting}
                submitLabel="Submit Registration"
                onSubmit={onSubmit}
                footer={
                  turnstileEnabled && turnstile?.siteKey ? (
                    <div className="flex justify-center">
                      <TurnstileWidget siteKey={turnstile.siteKey} onVerify={setCaptchaToken} />
                    </div>
                  ) : null
                }
              />
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
