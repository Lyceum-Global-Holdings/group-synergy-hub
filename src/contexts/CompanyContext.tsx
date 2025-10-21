import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Company } from '@/types/company';
import { GLSettings } from '@/types/generalLedger';
import { useCompanies } from '@/hooks/useCompanies';
import { useSuperAdmin } from '@/hooks/useSuperAdmin';
import { supabase } from '@/integrations/supabase/client';
import { formatCurrency as baseFormatCurrency } from '@/lib/utils';

interface CompanyContextType {
  selectedCompany: Company | null;
  setSelectedCompany: (company: Company | null) => void;
  companies: Company[];
  isLoading: boolean;
  isViewingAllCompanies: boolean;
  glSettings: GLSettings | null;
  baseCurrency: string;
  currencySymbol: string;
  decimalPlaces: number;
  formatCurrency: (amount: number) => string;
}

const CompanyContext = createContext<CompanyContextType | undefined>(undefined);

export function CompanyProvider({ children }: { children: ReactNode }) {
  const { companies = [], isLoading } = useCompanies();
  const { data: isSuperAdmin, isLoading: isSuperAdminLoading } = useSuperAdmin();
  const [selectedCompany, setSelectedCompany] = useState<Company | null>(null);
  const [isViewingAllCompanies, setIsViewingAllCompanies] = useState(false);
  
  // Ensure companies is always an array
  const safeCompanies = Array.isArray(companies) ? companies : [];

  // Fetch GL settings for selected company
  const { data: glSettings } = useQuery({
    queryKey: ['gl-settings', selectedCompany?.id],
    queryFn: async () => {
      if (!selectedCompany?.id) return null;
      
      const { data, error } = await supabase
        .from('gl_settings')
        .select('*')
        .eq('company_id', selectedCompany.id)
        .single();

      if (error) return null;
      return data as GLSettings;
    },
    enabled: !!selectedCompany?.id,
  });

  // Auto-select company based on user's access
  useEffect(() => {
    if (safeCompanies.length > 0 && !selectedCompany && !isViewingAllCompanies && !isSuperAdminLoading) {
      // If user has only one company (not super admin), auto-select it
      if (safeCompanies.length === 1) {
        setSelectedCompany(safeCompanies[0]);
      } else if (isSuperAdmin) {
        // Super admin: default to TUH or first company
        const uniformHub = safeCompanies.find(c => c.code === 'TUH');
        const defaultCompany = uniformHub || safeCompanies[0];
        setSelectedCompany(defaultCompany);
      }
    }
  }, [safeCompanies, selectedCompany, isViewingAllCompanies, isSuperAdmin, isSuperAdminLoading]);

  // Update selectedCompany when companies data changes (e.g., after module allocation update)
  useEffect(() => {
    if (selectedCompany && safeCompanies.length > 0) {
      const updatedCompany = safeCompanies.find(c => c.id === selectedCompany.id);
      if (updatedCompany && JSON.stringify(updatedCompany.modules) !== JSON.stringify(selectedCompany.modules)) {
        setSelectedCompany(updatedCompany);
      }
    }
  }, [safeCompanies, selectedCompany]);

  const handleSetSelectedCompany = (company: Company | null) => {
    if (company === null) {
      setIsViewingAllCompanies(true);
      setSelectedCompany(null);
    } else {
      setIsViewingAllCompanies(false);
      setSelectedCompany(company);
    }
  };

  // Currency formatting helper
  const formatCurrency = (amount: number) => {
    return baseFormatCurrency(
      amount,
      glSettings?.base_currency || 'LKR',
      glSettings?.currency_symbol || 'Rs.',
      glSettings?.decimal_places || 2
    );
  };

  return (
    <CompanyContext.Provider value={{
      selectedCompany,
      setSelectedCompany: handleSetSelectedCompany,
      companies: safeCompanies,
      isLoading: isLoading || isSuperAdminLoading,
      isViewingAllCompanies,
      glSettings: glSettings || null,
      baseCurrency: glSettings?.base_currency || 'LKR',
      currencySymbol: glSettings?.currency_symbol || 'Rs.',
      decimalPlaces: glSettings?.decimal_places || 2,
      formatCurrency
    }}>
      {children}
    </CompanyContext.Provider>
  );
}

export function useCompany() {
  const context = useContext(CompanyContext);
  if (context === undefined) {
    throw new Error('useCompany must be used within a CompanyProvider');
  }
  return context;
}