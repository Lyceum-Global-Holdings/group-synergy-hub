import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { useCompany } from "@/contexts/CompanyContext";

// A lightweight "bucket" of costumes the user is collecting before drafting a
// rental order — like a shopping cart. Persisted per company in localStorage so
// it survives navigation and reload.
export interface CostumeCartItem {
  costume_id: string;
  quantity: number;
}

interface CostumeCartValue {
  items: CostumeCartItem[];
  count: number; // total quantity across the cart
  quantityOf: (costumeId: string) => number;
  add: (costumeId: string, qty?: number) => void;
  setQuantity: (costumeId: string, qty: number) => void;
  remove: (costumeId: string) => void;
  clear: () => void;
}

const CostumeCartContext = createContext<CostumeCartValue | undefined>(undefined);

const keyFor = (companyId?: string | null) => `costume-cart:${companyId ?? "none"}`;

export function CostumeCartProvider({ children }: { children: React.ReactNode }) {
  const { selectedCompany } = useCompany();
  const companyId = selectedCompany?.id ?? null;
  const [items, setItems] = useState<CostumeCartItem[]>([]);

  // Load the company's cart whenever the company changes.
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const raw = window.localStorage.getItem(keyFor(companyId));
      setItems(raw ? (JSON.parse(raw) as CostumeCartItem[]) : []);
    } catch {
      setItems([]);
    }
  }, [companyId]);

  // Persist on change.
  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(keyFor(companyId), JSON.stringify(items));
  }, [items, companyId]);

  const add = useCallback((costumeId: string, qty = 1) => {
    setItems((prev) => {
      const existing = prev.find((i) => i.costume_id === costumeId);
      if (existing) return prev.map((i) => (i.costume_id === costumeId ? { ...i, quantity: i.quantity + qty } : i));
      return [...prev, { costume_id: costumeId, quantity: qty }];
    });
  }, []);

  const setQuantity = useCallback((costumeId: string, qty: number) => {
    setItems((prev) =>
      qty <= 0
        ? prev.filter((i) => i.costume_id !== costumeId)
        : prev.map((i) => (i.costume_id === costumeId ? { ...i, quantity: qty } : i)));
  }, []);

  const remove = useCallback((costumeId: string) =>
    setItems((prev) => prev.filter((i) => i.costume_id !== costumeId)), []);

  const clear = useCallback(() => setItems([]), []);

  const value = useMemo<CostumeCartValue>(() => ({
    items,
    count: items.reduce((s, i) => s + i.quantity, 0),
    quantityOf: (id) => items.find((i) => i.costume_id === id)?.quantity ?? 0,
    add, setQuantity, remove, clear,
  }), [items, add, setQuantity, remove, clear]);

  return <CostumeCartContext.Provider value={value}>{children}</CostumeCartContext.Provider>;
}

export function useCostumeCart() {
  const ctx = useContext(CostumeCartContext);
  if (!ctx) throw new Error("useCostumeCart must be used within a CostumeCartProvider");
  return ctx;
}
