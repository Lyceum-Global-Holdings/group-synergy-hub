// Construction Inventory System v2 Types

export type ItemCategory = 'machines' | 'tools' | 'safety' | 'equipment' | 'scaffolding' | 'others';
export type ItemSection = 'civil' | 'mep' | 'aluminium' | 'mechanical' | 'carpenter';
export type ItemStatus = 'active' | 'scrap' | 'sold';
export type SerialCondition = 'working' | 'under_repair' | 'need_to_repair' | 'damaged' | 'scrap';
export type SerialAvailability = 'available' | 'in_use' | 'in_transit' | 'reserved';
export type TransferStatus = 'pending' | 'in_transit' | 'completed' | 'cancelled';
export type RepairStatus = 'sent_for_repair' | 'in_repair' | 'repaired' | 'returned' | 'discarded';
export type TransactionType = 'stock_in' | 'stock_out' | 'transfer_out' | 'transfer_in' | 'adjustment' | 'repair_sent' | 'repair_returned' | 'scrap' | 'initial_stock';

export interface ConstructionItemMaster {
  id: string;
  company_id: string | null;
  item_code: string;
  item_name: string;
  category: ItemCategory;
  section: ItemSection;
  brand: string | null;
  model: string | null;
  unit_of_measurement: string;
  description: string | null;
  image_url: string | null;
  is_serial_tracked: boolean;
  unit_cost: number | null;
  purchase_date: string | null;
  status: ItemStatus;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface ConstructionSerialNumber {
  id: string;
  company_id: string | null;
  item_master_id: string;
  serial_number: string;
  current_location_id: string | null;
  condition: SerialCondition;
  availability: SerialAvailability;
  notes: string | null;
  purchase_date: string | null;
  warranty_expiry: string | null;
  asset_value: number | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  // Joined
  item_master?: ConstructionItemMaster;
  location?: { id: string; name: string };
}

export interface ConstructionInventoryStock {
  id: string;
  company_id: string | null;
  item_master_id: string;
  location_id: string;
  quantity: number;
  reserved_quantity: number;
  created_at: string;
  updated_at: string;
  // Joined
  item_master?: ConstructionItemMaster;
  location?: { id: string; name: string };
}

export interface ConstructionTransfer {
  id: string;
  company_id: string | null;
  transfer_number: string;
  transfer_date: string;
  from_location_id: string;
  to_location_id: string;
  status: TransferStatus;
  notes: string | null;
  initiated_by: string | null;
  completed_by: string | null;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
  // Joined
  from_location?: { id: string; name: string };
  to_location?: { id: string; name: string };
  items?: ConstructionTransferItem[];
}

export interface ConstructionTransferItem {
  id: string;
  transfer_id: string;
  item_master_id: string;
  quantity: number | null;
  serial_number_id: string | null;
  // Joined
  item_master?: ConstructionItemMaster;
  serial_number?: ConstructionSerialNumber;
}

export interface ConstructionRepairRecord {
  id: string;
  company_id: string | null;
  item_master_id: string;
  serial_number_id: string | null;
  repair_date: string;
  expected_return_date: string | null;
  actual_return_date: string | null;
  status: RepairStatus;
  repair_cost: number | null;
  service_provider: string | null;
  issue_description: string | null;
  repair_notes: string | null;
  quantity: number;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  // Joined
  item_master?: ConstructionItemMaster;
  serial_number?: ConstructionSerialNumber;
}

// Constants for UI
export const ITEM_CATEGORIES: { value: ItemCategory; label: string }[] = [
  { value: 'machines', label: 'Machines' },
  { value: 'tools', label: 'Tools' },
  { value: 'safety', label: 'Safety' },
  { value: 'equipment', label: 'Equipment' },
  { value: 'scaffolding', label: 'Scaffolding' },
  { value: 'others', label: 'Others' },
];

export const ITEM_SECTIONS: { value: ItemSection; label: string }[] = [
  { value: 'civil', label: 'Civil' },
  { value: 'mep', label: 'MEP' },
  { value: 'aluminium', label: 'Aluminium' },
  { value: 'mechanical', label: 'Mechanical' },
  { value: 'carpenter', label: 'Carpenter' },
];

export const ITEM_STATUSES: { value: ItemStatus; label: string }[] = [
  { value: 'active', label: 'Active' },
  { value: 'scrap', label: 'Scrap' },
  { value: 'sold', label: 'Sold' },
];

export const SERIAL_CONDITIONS: { value: SerialCondition; label: string }[] = [
  { value: 'working', label: 'Working' },
  { value: 'under_repair', label: 'Under Repair' },
  { value: 'need_to_repair', label: 'Need to Repair' },
  { value: 'damaged', label: 'Damaged' },
  { value: 'scrap', label: 'Scrap' },
];

export const SERIAL_AVAILABILITIES: { value: SerialAvailability; label: string }[] = [
  { value: 'available', label: 'Available' },
  { value: 'in_use', label: 'In Use' },
  { value: 'in_transit', label: 'In Transit' },
  { value: 'reserved', label: 'Reserved' },
];

export const TRANSFER_STATUSES: { value: TransferStatus; label: string }[] = [
  { value: 'pending', label: 'Pending' },
  { value: 'in_transit', label: 'In Transit' },
  { value: 'completed', label: 'Completed' },
  { value: 'cancelled', label: 'Cancelled' },
];

export const REPAIR_STATUSES: { value: RepairStatus; label: string }[] = [
  { value: 'sent_for_repair', label: 'Sent for Repair' },
  { value: 'in_repair', label: 'In Repair' },
  { value: 'repaired', label: 'Repaired' },
  { value: 'returned', label: 'Returned' },
  { value: 'discarded', label: 'Discarded' },
];
