import { useState } from "react";
import { useForm } from "react-hook-form";
import { Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import BasicInfoStep from "./registration/BasicInfoStep";
import BusinessDetailsStep from "./registration/BusinessDetailsStep";
import BankingDetailsStep from "./registration/BankingDetailsStep";
import ReviewStep from "./registration/ReviewStep";
import { useCreateRegistration, useUpdateRegistration, useSubmitRegistration } from "@/hooks/useSupplierRegistration";
import { useCompany } from "@/contexts/CompanyContext";

const steps = [
  { id: 1, name: "Basic Info", component: BasicInfoStep },
  { id: 2, name: "Business Details", component: BusinessDetailsStep },
  { id: 3, name: "Banking & Contact", component: BankingDetailsStep },
  { id: 4, name: "Review", component: ReviewStep },
];

interface SupplierRegistrationWizardProps {
  draftId?: string;
  onComplete?: () => void;
}

export default function SupplierRegistrationWizard({ draftId, onComplete }: SupplierRegistrationWizardProps) {
  const [currentStep, setCurrentStep] = useState(1);
  const [registrationId, setRegistrationId] = useState<string | undefined>(draftId);
  const { selectedCompany } = useCompany();
  
  const form = useForm({
    defaultValues: {
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
    },
  });

  const createRegistration = useCreateRegistration();
  const updateRegistration = useUpdateRegistration();
  const submitRegistration = useSubmitRegistration();

  const progress = (currentStep / steps.length) * 100;
  const CurrentStepComponent = steps[currentStep - 1].component;

  const handleNext = async () => {
    const isValid = await form.trigger();
    if (!isValid) return;

    // Save draft
    const formData = form.getValues();
    if (registrationId) {
      await updateRegistration.mutateAsync({
        id: registrationId,
        supplier_data: formData,
      });
    } else {
      const result = await createRegistration.mutateAsync({
        supplier_data: formData,
        company_id: selectedCompany?.id,
      });
      setRegistrationId(result.id);
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
    
    await submitRegistration.mutateAsync(registrationId);
    onComplete?.();
  };

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
              <Button onClick={handleNext}>
                Save & Continue
              </Button>
            )}
            {currentStep === steps.length && (
              <Button onClick={handleSubmit}>
                Submit for Approval
              </Button>
            )}
          </div>
        </div>
      </Card>
    </div>
  );
}
