import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { useCompany } from "@/contexts/CompanyContext";

// A lightweight "bucket" of costumes the user is collecting before drafting a
// rental order — like a shopping cart. Persisted per company in localStorage so
// it survives navigation and reload.
export interface CostumeCartItem {
  costume_id: string;
  size: string; // "" = unspecified
  quantity: number;
  unit_id?: string | null;   // a specific physical unit was chosen (preferred unit)
  unit_code?: string | null; // display code for that unit
}

const sameLine = (a: CostumeCartItem, costumeId: string, size: string, unitId: string | null = null) =>
  a.costume_id === costumeId && a.size === size && (a.unit_id ?? null) === (unitId ?? null);

interface CostumeCartValue {
  items: CostumeCartItem[];
  count: number; // total quantity across the cart
  quantityOf: (costumeId: string, size: string) => number;
  quantityOfCostume: (costumeId: string) => number; // across all sizes + units
  hasUnit: (unitId: string) => boolean;
  add: (costumeId: string, size: string, qty?: number) => void;
  addUnit: (costumeId: string, unitId: string, unitCode: string, size: string) => void;
  setQuantity: (costumeId: string, size: string, qty: number) => void;
  remove: (costumeId: string, size: string) => void;
  removeUnit: (unitId: string) => void;
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
      const parsed = raw ? (JSON.parse(raw) as CostumeCartItem[]) : [];
      // Normalise legacy items that predate sizes / units.
      setItems(parsed.map((i) => ({
        costume_id: i.costume_id, size: i.size ?? "", quantity: i.quantity,
        unit_id: i.unit_id ?? null, unit_code: i.unit_code ?? null,
      })));
    } catch {
      setItems([]);
    }
  }, [companyId]);

  // Persist on change.
  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(keyFor(companyId), JSON.stringify(items));
  }, [items, companyId]);

  const add = useCallback((costumeId: string, size: string, qty = 1) => {
    setItems((prev) => {
      const existing = prev.find((i) => sameLine(i, costumeId, size));
      if (existing) return prev.map((i) => (sameLine(i, costumeId, size) ? { ...i, quantity: i.quantity + qty } : i));
      return [...prev, { costume_id: costumeId, size, quantity: qty, unit_id: null, unit_code: null }];
    });
  }, []);

  // Add a specific physical unit (preferred unit) — quantity is always 1 and a
  // given unit can only be in the bucket once.
  const addUnit = useCallback((costumeId: string, unitId: string, unitCode: string, size: string) => {
    setItems((prev) => {
      if (prev.some((i) => i.unit_id === unitId)) return prev;
      return [...prev, { costume_id: costumeId, size, quantity: 1, unit_id: unitId, unit_code: unitCode }];
    });
  }, []);

  const setQuantity = useCallback((costumeId: string, size: string, qty: number) => {
    setItems((prev) =>
      qty <= 0
        ? prev.filter((i) => !sameLine(i, costumeId, size))
        : prev.map((i) => (sameLine(i, costumeId, size) ? { ...i, quantity: qty } : i)));
  }, []);

  const remove = useCallback((costumeId: string, size: string) =>
    setItems((prev) => prev.filter((i) => !sameLine(i, costumeId, size))), []);

  const removeUnit = useCallback((unitId: string) =>
    setItems((prev) => prev.filter((i) => i.unit_id !== unitId)), []);

  const clear = useCallback(() => setItems([]), []);

  const value = useMemo<CostumeCartValue>(() => ({
    items,
    count: items.reduce((s, i) => s + i.quantity, 0),
    quantityOf: (id, size) => items.find((i) => sameLine(i, id, size))?.quantity ?? 0,
    quantityOfCostume: (id) => items.filter((i) => i.costume_id === id).reduce((s, i) => s + i.quantity, 0),
    hasUnit: (unitId) => items.some((i) => i.unit_id === unitId),
    add, addUnit, setQuantity, remove, removeUnit, clear,
  }), [items, add, addUnit, setQuantity, remove, removeUnit, clear]);

  return <CostumeCartContext.Provider value={value}>{children}</CostumeCartContext.Provider>;
}

export function useCostumeCart() {
  const ctx = useContext(CostumeCartContext);
  if (!ctx) throw new Error("useCostumeCart must be used within a CostumeCartProvider");
  return ctx;
}
