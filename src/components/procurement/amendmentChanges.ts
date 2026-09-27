import type { PoAmendment, PoAmendmentChanges, PoAmendmentType, PoItem } from "@/types/purchaseOrder";

export interface NewLineDraft {
  item_name: string;
  item_code: string;
  quantity: string;
  unit_price: string;
  unit_of_measure: string;
}

export interface AmendmentDraft {
  /** po_item_id → new value typed by the user (blank = unchanged) */
  lineValues: Record<string, string>;
  removeIds: string[];
  newLines: NewLineDraft[];
  deliveryDate: string;
  paymentTerms: string;
  deliveryTerms: string;
}

export interface AmendmentPlan {
  changes: PoAmendmentChanges;
  /** What is wrong with the draft, or null when it can be submitted. */
  problem: string | null;
  /** Line total after the change, for types that change lines. */
  newTotal: number | null;
}

export const emptyAmendmentDraft = (terms?: { payment_terms?: string | null; delivery_terms?: string | null }): AmendmentDraft => ({
  lineValues: {},
  removeIds: [],
  newLines: [],
  deliveryDate: "",
  paymentTerms: terms?.payment_terms ?? "",
  deliveryTerms: terms?.delivery_terms ?? "",
});

const num = (v: string) => (v.trim() === "" ? NaN : Number(v));
const round2 = (n: number) => Math.round(n * 100) / 100;

/**
 * Turns what the user entered into the change the database expects
 * (see request_po_amendment), mirroring its checks so problems show before
 * submitting. The database checks again.
 */
export function planAmendment(
  type: PoAmendmentType,
  draft: AmendmentDraft,
  items: PoItem[],
  current: { expected_delivery_date?: string | null; payment_terms?: string | null; delivery_terms?: string | null },
): AmendmentPlan {
  const lineTotal = items.reduce((s, i) => s + Number(i.total_price || 0), 0);

  if (type === "price_change" || type === "quantity_change") {
    const lines: Record<string, unknown>[] = [];
    let total = lineTotal;
    for (const item of items) {
      const raw = draft.lineValues[item.id ?? ""] ?? "";
      if (raw.trim() === "") continue;
      const value = num(raw);
      if (type === "price_change") {
        if (Number.isNaN(value) || value < 0) return { changes: null, problem: `Enter a valid price for ${item.item_name}`, newTotal: null };
        if (value === Number(item.unit_price)) continue;
        lines.push({ po_item_id: item.id, unit_price: value });
        total += round2(value * Number(item.quantity_ordered)) - Number(item.total_price);
      } else {
        if (Number.isNaN(value) || value <= 0) return { changes: null, problem: `Enter a quantity above zero for ${item.item_name}`, newTotal: null };
        if (value < Number(item.quantity_received || 0)) {
          return { changes: null, problem: `${item.quantity_received} ${item.unit_of_measure} of ${item.item_name} have already been received`, newTotal: null };
        }
        if (value === Number(item.quantity_ordered)) continue;
        lines.push({ po_item_id: item.id, quantity: value });
        total += round2(Number(item.unit_price) * value) - Number(item.total_price);
      }
    }
    if (lines.length === 0) return { changes: null, problem: "Change at least one line", newTotal: null };
    return { changes: { lines }, problem: null, newTotal: round2(total) };
  }

  if (type === "item_removal") {
    if (draft.removeIds.length === 0) return { changes: null, problem: "Choose the lines to remove", newTotal: null };
    if (draft.removeIds.length >= items.length) return { changes: null, problem: "A purchase order needs at least one line. Cancel it instead.", newTotal: null };
    const removed = items.filter((i) => draft.removeIds.includes(i.id ?? ""));
    const received = removed.find((i) => Number(i.quantity_received || 0) > 0);
    if (received) return { changes: null, problem: `${received.item_name} has already been received, so it can't be removed`, newTotal: null };
    return {
      changes: { lines: removed.map((i) => ({ po_item_id: i.id })) },
      problem: null,
      newTotal: round2(lineTotal - removed.reduce((s, i) => s + Number(i.total_price || 0), 0)),
    };
  }

  if (type === "item_addition") {
    const filled = draft.newLines.filter((l) => l.item_name.trim() || l.quantity.trim() || l.unit_price.trim());
    if (filled.length === 0) return { changes: null, problem: "Add at least one line", newTotal: null };
    let added = 0;
    const lines: Record<string, unknown>[] = [];
    for (const l of filled) {
      const qty = num(l.quantity);
      const price = num(l.unit_price);
      if (!l.item_name.trim()) return { changes: null, problem: "Name each new item", newTotal: null };
      if (Number.isNaN(qty) || qty <= 0) return { changes: null, problem: `Enter a quantity above zero for ${l.item_name}`, newTotal: null };
      if (Number.isNaN(price) || price < 0) return { changes: null, problem: `Enter a price for ${l.item_name}`, newTotal: null };
      added += round2(qty * price);
      lines.push({
        item_name: l.item_name.trim(),
        item_code: l.item_code.trim() || null,
        quantity: qty,
        unit_price: price,
        unit_of_measure: l.unit_of_measure.trim() || "pcs",
      });
    }
    return { changes: { lines }, problem: null, newTotal: round2(lineTotal + added) };
  }

  if (type === "delivery_date_change") {
    if (!draft.deliveryDate) return { changes: null, problem: "Choose the new delivery date", newTotal: null };
    if (draft.deliveryDate === (current.expected_delivery_date ?? "").slice(0, 10)) {
      return { changes: null, problem: "The new delivery date is the same as now", newTotal: null };
    }
    return { changes: { expected_delivery_date: draft.deliveryDate }, problem: null, newTotal: null };
  }

  if (type === "terms_change") {
    const payment = draft.paymentTerms.trim();
    const delivery = draft.deliveryTerms.trim();
    if (payment === (current.payment_terms ?? "").trim() && delivery === (current.delivery_terms ?? "").trim()) {
      return { changes: null, problem: "Change the payment or delivery terms", newTotal: null };
    }
    return { changes: { payment_terms: payment || null, delivery_terms: delivery || null }, problem: null, newTotal: null };
  }

  return { changes: null, problem: null, newTotal: null };
}

/** Readable "before → after" lines for an amendment's stored values. */
export function describeAmendment(type: PoAmendmentType, previous: any, next: any): string[] {
  if (!next) return [];
  const prevLines: any[] = previous?.lines ?? [];
  const find = (id: string) => prevLines.find((l) => l.po_item_id === id);
  switch (type) {
    case "price_change":
      return (next.lines ?? []).map((l: any) => `${l.item_name ?? "Line"}: price ${find(l.po_item_id)?.unit_price ?? "?"} → ${l.unit_price}`);
    case "quantity_change":
      return (next.lines ?? []).map((l: any) => `${l.item_name ?? "Line"}: quantity ${find(l.po_item_id)?.quantity ?? "?"} → ${l.quantity}`);
    case "item_removal":
      return prevLines.map((l) => `Remove ${l.item_name} (${l.quantity} × ${l.unit_price})`);
    case "item_addition":
      return (next.lines ?? []).map((l: any) => `Add ${l.item_name}: ${l.quantity} ${l.unit_of_measure ?? ""} × ${l.unit_price}`);
    case "delivery_date_change":
      return [`Delivery date ${previous?.expected_delivery_date ?? "not set"} → ${next.expected_delivery_date}`];
    case "terms_change": {
      const out: string[] = [];
      if ((previous?.payment_terms ?? null) !== (next.payment_terms ?? null)) out.push(`Payment terms: ${previous?.payment_terms ?? "—"} → ${next.payment_terms ?? "—"}`);
      if ((previous?.delivery_terms ?? null) !== (next.delivery_terms ?? null)) out.push(`Delivery terms: ${previous?.delivery_terms ?? "—"} → ${next.delivery_terms ?? "—"}`);
      return out;
    }
    default:
      return [];
  }
}

export const amendmentTypes: { value: PoAmendmentType; label: string; hint: string }[] = [
  { value: 'price_change', label: 'Price Change', hint: 'New unit prices for existing lines.' },
  { value: 'quantity_change', label: 'Quantity Change', hint: "New quantities; they can't go below what was received." },
  { value: 'delivery_date_change', label: 'Delivery Date Change', hint: 'A new expected delivery date.' },
  { value: 'terms_change', label: 'Terms Change', hint: 'New payment or delivery terms.' },
  { value: 'item_addition', label: 'Item Addition', hint: 'Extra lines on the order.' },
  { value: 'item_removal', label: 'Item Removal', hint: "Lines that haven't been received yet." },
  { value: 'other', label: 'Other', hint: 'Recorded for the file only; nothing on the PO changes.' },
];

export const amendmentTypeLabels: Record<string, string> = {
  price_change: 'Price Change',
  quantity_change: 'Quantity Change',
  delivery_date_change: 'Delivery Date Change',
  terms_change: 'Terms Change',
  item_addition: 'Item Addition',
  item_removal: 'Item Removal',
  other: 'Other',
};

export const amendmentStatus = (a: PoAmendment): 'pending' | 'approved' | 'rejected' => a.status ?? (a.approved_by ? 'approved' : 'pending');
