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
  const { data: isSuperAdmin } = useSuperAdmin();
  const [selectedCompany, setSelectedCompany] = useState<Company | null>(null);
  const [isViewingAllCompanies, setIsViewingAllCompanies] = useState(false);

  // Auto-select company based on user's access
  useEffect(() => {
    if (companies.length > 0 && !selectedCompany && !isViewingAllCompanies) {
      // If user has only one company (not super admin), auto-select it
      if (companies.length === 1) {
        setSelectedCompany(companies[0]);
      } else if (isSuperAdmin) {
        // Super admin: default to TUH or first company
        const uniformHub = companies.find(c => c.code === 'TUH');
        const defaultCompany = uniformHub || companies[0];
        setSelectedCompany(defaultCompany);
      }
    }
  }, [companies, selectedCompany, isViewingAllCompanies, isSuperAdmin]);

  // Update selectedCompany when companies data changes (e.g., after module allocation update)
  useEffect(() => {
    if (selectedCompany && companies.length > 0) {
      const updatedCompany = companies.find(c => c.id === selectedCompany.id);
      if (updatedCompany && JSON.stringify(updatedCompany.modules) !== JSON.stringify(selectedCompany.modules)) {
        setSelectedCompany(updatedCompany);
      }
    }
  }, [companies]);

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
      companies: companies || [],
      isLoading,
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