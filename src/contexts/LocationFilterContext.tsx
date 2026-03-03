import { createContext, useContext, useState, ReactNode } from "react";

interface LocationFilterContextType {
  globalLocationId: string | null;
  setGlobalLocationId: (id: string | null) => void;
}

const LocationFilterContext = createContext<LocationFilterContextType | undefined>(undefined);

export function LocationFilterProvider({ children }: { children: ReactNode }) {
  const [globalLocationId, setGlobalLocationId] = useState<string | null>(null);

  return (
    <LocationFilterContext.Provider value={{ globalLocationId, setGlobalLocationId }}>
      {children}
    </LocationFilterContext.Provider>
  );
}

export function useLocationFilter() {
  const context = useContext(LocationFilterContext);
  if (context === undefined) {
    throw new Error("useLocationFilter must be used within a LocationFilterProvider");
  }
  return context;
}
