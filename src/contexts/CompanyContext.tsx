import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { Company } from '@/types/company';
import { useCompanies } from '@/hooks/useCompanies';
import { useSuperAdmin } from '@/hooks/useSuperAdmin';

interface CompanyContextType {
  selectedCompany: Company | null;
  setSelectedCompany: (company: Company | null) => void;
  companies: Company[];
  isLoading: boolean;
  isViewingAllCompanies: boolean;
}

const CompanyContext = createContext<CompanyContextType | undefined>(undefined);

export function CompanyProvider({ children }: { children: ReactNode }) {
  const { companies = [], isLoading } = useCompanies();
  const { data: isSuperAdmin, isLoading: isSuperAdminLoading } = useSuperAdmin();
  const [selectedCompany, setSelectedCompany] = useState<Company | null>(null);
  const [isViewingAllCompanies, setIsViewingAllCompanies] = useState(false);
  
  // Ensure companies is always an array
  const safeCompanies = Array.isArray(companies) ? companies : [];

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

  return (
    <CompanyContext.Provider value={{
      selectedCompany,
      setSelectedCompany: handleSetSelectedCompany,
      companies: safeCompanies,
      isLoading: isLoading || isSuperAdminLoading,
      isViewingAllCompanies
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