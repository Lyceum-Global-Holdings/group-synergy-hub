import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { Company } from '@/types/company';
import { useCompanies } from '@/hooks/useCompanies';

interface CompanyContextType {
  selectedCompany: Company | null;
  setSelectedCompany: (company: Company | null) => void;
  companies: Company[];
  isLoading: boolean;
  isViewingAllCompanies: boolean;
}

const CompanyContext = createContext<CompanyContextType | undefined>(undefined);

export function CompanyProvider({ children }: { children: ReactNode }) {
  const { companies, isLoading } = useCompanies();
  const [selectedCompany, setSelectedCompany] = useState<Company | null>(null);
  const [isViewingAllCompanies, setIsViewingAllCompanies] = useState(false);

  // Auto-select The Uniform Hub as default company
  useEffect(() => {
    if (companies.length > 0 && !selectedCompany && !isViewingAllCompanies) {
      const uniformHub = companies.find(c => c.code === 'TUH');
      const defaultCompany = uniformHub || companies[0];
      setSelectedCompany(defaultCompany);
    }
  }, [companies, selectedCompany, isViewingAllCompanies]);

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
      companies,
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