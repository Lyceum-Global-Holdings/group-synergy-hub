import React, { createContext, useContext, useState, useEffect } from 'react';
import { useCompanies } from '@/hooks/useCompanies';
import type { Company } from '@/types/company';

interface CompanyContextType {
  selectedCompany: Company | null;
  setSelectedCompany: (company: Company | null) => void;
  companies: Company[];
  isLoading: boolean;
}

const CompanyContext = createContext<CompanyContextType | undefined>(undefined);

export function CompanyProvider({ children }: { children: React.ReactNode }) {
  const { companies = [], isLoading } = useCompanies();
  const [selectedCompany, setSelectedCompany] = useState<Company | null>(null);

  // Auto-select The Uniform Hub if available
  useEffect(() => {
    if (companies.length > 0 && !selectedCompany) {
      const uniformHub = companies.find(c => c.code === 'TUH');
      setSelectedCompany(uniformHub || companies[0]);
    }
  }, [companies, selectedCompany]);

  return (
    <CompanyContext.Provider value={{
      selectedCompany,
      setSelectedCompany,
      companies,
      isLoading
    }}>
      {children}
    </CompanyContext.Provider>
  );
}

export function useCompanyContext() {
  const context = useContext(CompanyContext);
  if (!context) {
    throw new Error('useCompanyContext must be used within a CompanyProvider');
  }
  return context;
}