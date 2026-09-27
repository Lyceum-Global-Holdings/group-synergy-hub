// v1.0.2 - Clean rebuild
import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Company } from '@/types/company';
import { GLSettings } from '@/types/generalLedger';
import { useCompanies } from '@/hooks/useCompanies';
import { useSuperAdmin } from '@/hooks/useSuperAdmin';
import { useAuth } from '@/contexts/AuthContext';
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

// The chosen company survives a refresh. Stored per user (a company id, or
// "all" for the super-admin All Companies view) so a shared computer doesn't
// carry one person's choice over to the next. 'selectedCompanyId' is also read
// by performance telemetry (main.tsx).
const ALL_COMPANIES = 'all';
const choiceKey = (userId: string) => `selectedCompany:${userId}`;

function readChoice(userId: string | undefined): string | null {
  if (!userId) return null;
  try {
    return window.localStorage.getItem(choiceKey(userId));
  } catch {
    return null;
  }
}

function writeChoice(userId: string | undefined, choice: string | null) {
  if (!userId) return;
  try {
    if (choice) window.localStorage.setItem(choiceKey(userId), choice);
    else window.localStorage.removeItem(choiceKey(userId));
    if (choice && choice !== ALL_COMPANIES) window.localStorage.setItem('selectedCompanyId', choice);
    else window.localStorage.removeItem('selectedCompanyId');
  } catch {
    // Storage blocked (private window): the choice just isn't remembered.
  }
}

export function CompanyProvider({ children }: { children: ReactNode }) {
  const { companies = [], isLoading } = useCompanies();
  const { data: isSuperAdmin, isLoading: isSuperAdminLoading } = useSuperAdmin();
  const { user } = useAuth();
  const userId = user?.id;
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
    // Wait until super admin status is definitively known
    if (isSuperAdminLoading) return;
    
    if (safeCompanies.length > 0 && !selectedCompany && !isViewingAllCompanies) {
      console.log('[CompanyContext] Auto-select - companies:', safeCompanies.length, 'isSuperAdmin:', isSuperAdmin);

      // Restore the last choice if the user can still use it.
      const saved = readChoice(userId);
      if (saved === ALL_COMPANIES && isSuperAdmin === true) {
        setIsViewingAllCompanies(true);
        return;
      }
      const savedCompany = saved ? safeCompanies.find((c) => c.id === saved) : undefined;
      if (savedCompany) {
        setSelectedCompany(savedCompany);
        return;
      }
      if (saved) writeChoice(userId, null);

      if (isSuperAdmin === true && safeCompanies.length > 1) {
        // Super admin with multiple companies: default to "All Companies" view
        console.log('[CompanyContext] Setting super admin to view all companies');
        setIsViewingAllCompanies(true);
      } else if (safeCompanies.length === 1) {
        // Single company: auto-select it
        setSelectedCompany(safeCompanies[0]);
      }
      // Non-super-admin with multiple companies: leave unselected (must choose manually)
    }
  }, [safeCompanies, selectedCompany, isViewingAllCompanies, isSuperAdmin, isSuperAdminLoading, userId]);

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
      writeChoice(userId, ALL_COMPANIES);
    } else {
      setIsViewingAllCompanies(false);
      setSelectedCompany(company);
      writeChoice(userId, company.id);
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