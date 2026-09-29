import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { AlertTriangle, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import BasicInfoStep from "./registration/BasicInfoStep";
import BusinessDetailsStep from "./registration/BusinessDetailsStep";
import BankingDetailsStep from "./registration/BankingDetailsStep";
import ReviewStep from "./registration/ReviewStep";
import { DuplicateMatchList } from "./registration/DuplicateMatchList";
import {
  useCreateRegistration,
  useUpdateRegistration,
  useSubmitRegistration,
  useSupplierRegistration,
  useRegistrationReview,
} from "@/hooks/useSupplierRegistration";
import { useCompany } from "@/contexts/CompanyContext";

const steps = [
  { id: 1, name: "Basic Info", component: BasicInfoStep },
  { id: 2, name: "Business Details", component: BusinessDetailsStep },
  { id: 3, name: "Banking & Contact", component: BankingDetailsStep },
  { id: 4, name: "Review", component: ReviewStep },
];

interface SupplierRegistrationWizardProps {
  /** Reopen a saved draft instead of starting a blank registration. */
  draftId?: string;
  onComplete?: () => void;
}

const EMPTY_REGISTRATION = {
  supplier_name: "",
  supplier_type: "vendor",
  email: "",
  phone: "",
  tax_id: "",
  registration_number: "",
  website: "",
  street_address: "",
  city: "",
  state_province: "",
  postal_code: "",
  country: "",
  bank_name: "",
  bank_account_number: "",
  bank_branch: "",
  swift_code: "",
  payment_terms: "net_30",
  primary_contact_name: "",
  primary_contact_email: "",
  primary_contact_phone: "",
  category: "",
  material_type: "",
  business_description: "",
};

export default function SupplierRegistrationWizard({ draftId, onComplete }: SupplierRegistrationWizardProps) {
  const [currentStep, setCurrentStep] = useState(1);
  const [registrationId, setRegistrationId] = useState<string | undefined>(draftId);
  const [draftLoaded, setDraftLoaded] = useState(!draftId);
  const [duplicateReason, setDuplicateReason] = useState("");
  const { selectedCompany } = useCompany();

  const form = useForm({ defaultValues: EMPTY_REGISTRATION });

  const draft = useSupplierRegistration(draftId ?? "");
  useEffect(() => {
    if (draftLoaded || !draft.data) return;
    form.reset({ ...EMPTY_REGISTRATION, ...(draft.data.supplier_data ?? {}) });
    setDraftLoaded(true);
  }, [draft.data, draftLoaded, form]);

  const createRegistration = useCreateRegistration();
  const updateRegistration = useUpdateRegistration();
  const submitRegistration = useSubmitRegistration();

  // Duplicate matches for the saved registration, checked on the review step.
  const onReview = currentStep === steps.length;
  const review = useRegistrationReview(onReview ? registrationId : undefined);
  const duplicates = review.data?.duplicates ?? [];
  const reasonMissing = duplicates.length > 0 && !duplicateReason.trim();

  const progress = (currentStep / steps.length) * 100;
  const CurrentStepComponent = steps[currentStep - 1].component;

  const handleNext = async () => {
    const isValid = await form.trigger();
    if (!isValid) return;

    // Save draft
    const formData = form.getValues();
    try {
      if (registrationId) {
        await updateRegistration.mutateAsync({
          id: registrationId,
          supplier_data: formData,
          // A draft started without a company picks up the current one.
          ...(draft.data && !draft.data.company_id && selectedCompany?.id ? { company_id: selectedCompany.id } : {}),
        });
      } else {
        const result = await createRegistration.mutateAsync({
          supplier_data: formData,
          company_id: selectedCompany?.id,
        });
        setRegistrationId(result.id);
      }
    } catch {
      return; // the hook shows the error
    }

    if (currentStep < steps.length) {
      setCurrentStep(currentStep + 1);
    }
  };

  const handleBack = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleSubmit = async () => {
    if (!registrationId) return;

    try {
      await submitRegistration.mutateAsync({
        id: registrationId,
        duplicateReason: duplicates.length > 0 ? duplicateReason : undefined,
      });
    } catch {
      return; // the hook shows the error
    }
    onComplete?.();
  };

  if (draftId && !draftLoaded) {
    return (
      <div className="max-w-4xl mx-auto p-6">
        <Card className="p-6 text-sm text-muted-foreground">
          {draft.error ? `Couldn't open the draft: ${(draft.error as Error).message}` : "Opening draft…"}
        </Card>
      </div>
    );
  }

  if (draft.data && draft.data.status !== "draft") {
    return (
      <div className="max-w-4xl mx-auto p-6">
        <Card className="p-6 text-sm text-muted-foreground">
          This registration has already been submitted, so it can no longer be edited here.
        </Card>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto p-6">
      <Card className="p-6">
        {/* Progress Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            {steps.map((step, index) => (
              <div key={step.id} className="flex items-center">
                <div
                  className={cn(
                    "w-10 h-10 rounded-full flex items-center justify-center font-medium transition-colors",
                    currentStep > step.id
                      ? "bg-primary text-primary-foreground"
                      : currentStep === step.id
                      ? "bg-primary/20 text-primary border-2 border-primary"
                      : "bg-muted text-muted-foreground"
                  )}
                >
                  {currentStep > step.id ? <Check className="w-5 h-5" /> : step.id}
                </div>
                {index < steps.length - 1 && (
                  <div
                    className={cn(
                      "w-16 h-1 mx-2",
                      currentStep > step.id ? "bg-primary" : "bg-muted"
                    )}
                  />
                )}
              </div>
            ))}
          </div>
          <Progress value={progress} className="h-2" />
          <p className="text-sm text-muted-foreground mt-2">
            Step {currentStep} of {steps.length}: {steps[currentStep - 1].name}
          </p>
        </div>

        {/* Step Content */}
        <div className="min-h-[400px]">
          <CurrentStepComponent form={form} />

          {onReview && (
            <div className="mt-6 space-y-3">
              {review.isLoading ? (
                <p className="text-sm text-muted-foreground">Checking for existing suppliers…</p>
              ) : review.error ? (
                <p className="text-sm text-muted-foreground">
                  Couldn't check for existing suppliers ({(review.error as Error).message}). The check runs again when you submit.
                </p>
              ) : duplicates.length > 0 ? (
                <>
                  <Alert variant="destructive">
                    <AlertTriangle className="h-4 w-4" />
                    <AlertTitle>This supplier may already be registered</AlertTitle>
                    <AlertDescription className="space-y-3">
                      <p>The registration matches:</p>
                      <DuplicateMatchList matches={duplicates} />
                    </AlertDescription>
                  </Alert>
                  <div className="space-y-1.5">
                    <Label htmlFor="duplicate-reason">Why is this a different supplier? *</Label>
                    <Textarea
                      id="duplicate-reason"
                      value={duplicateReason}
                      onChange={(e) => setDuplicateReason(e.target.value)}
                      placeholder="e.g. separate legal entity with its own tax registration"
                      rows={3}
                    />
                    <p className="text-xs text-muted-foreground">
                      The approver sees this and can link the registration to the existing supplier instead.
                    </p>
                  </div>
                </>
              ) : (
                <p className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Check className="h-4 w-4" /> No existing supplier matches this registration.
                </p>
              )}
            </div>
          )}
        </div>

        {/* Navigation */}
        <div className="flex justify-between mt-8 pt-6 border-t">
          <Button
            variant="outline"
            onClick={handleBack}
            disabled={currentStep === 1}
          >
            Back
          </Button>
          
          <div className="flex gap-2">
            {currentStep < steps.length && (
              <Button onClick={handleNext} disabled={createRegistration.isPending || updateRegistration.isPending}>
                Save & Continue
              </Button>
            )}
            {currentStep === steps.length && (
              <Button
                onClick={handleSubmit}
                disabled={!registrationId || submitRegistration.isPending || review.isLoading || reasonMissing}
              >
                Submit for Approval
              </Button>
            )}
          </div>
        </div>
      </Card>
    </div>
  );
}
