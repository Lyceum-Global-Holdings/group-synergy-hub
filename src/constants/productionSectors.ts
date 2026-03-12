export const DEFAULT_SECTORS = [
  {
    name: 'Apparel',
    code: 'APPAREL',
    description: 'Garment and textile manufacturing',
    stages: [
      { stage_name: 'Cutting', sequence_order: 1, bom_categories: ['fabric'], description: 'Fabric cutting and preparation' },
      { stage_name: 'Sewing', sequence_order: 2, bom_categories: ['sewing_trims'], description: 'Stitching and assembly' },
      { stage_name: 'Finishing', sequence_order: 3, bom_categories: ['embellishment'], description: 'Embellishment, washing, pressing' },
      { stage_name: 'Packing', sequence_order: 4, bom_categories: ['packing_trims'], description: 'Final QC and packing' },
    ],
  },
  {
    name: 'Food & Beverage',
    code: 'FOOD_BEV',
    description: 'Food and beverage processing',
    stages: [
      { stage_name: 'Mixing', sequence_order: 1, bom_categories: [], description: 'Raw material mixing and blending' },
      { stage_name: 'Processing', sequence_order: 2, bom_categories: [], description: 'Cooking, baking, or processing' },
      { stage_name: 'Packaging', sequence_order: 3, bom_categories: [], description: 'Product packaging' },
      { stage_name: 'Quality Control', sequence_order: 4, bom_categories: [], description: 'Final quality inspection' },
    ],
  },
  {
    name: 'Manufacturing',
    code: 'MANUFACTURING',
    description: 'General manufacturing and assembly',
    stages: [
      { stage_name: 'Fabrication', sequence_order: 1, bom_categories: [], description: 'Raw material fabrication' },
      { stage_name: 'Assembly', sequence_order: 2, bom_categories: [], description: 'Component assembly' },
      { stage_name: 'Testing', sequence_order: 3, bom_categories: [], description: 'Quality testing and inspection' },
      { stage_name: 'Packaging', sequence_order: 4, bom_categories: [], description: 'Final packaging and labeling' },
    ],
  },
] as const;

export const PRODUCTION_ORDER_STATUSES = [
  { value: 'planned', label: 'Planned', color: 'bg-blue-100 text-blue-800' },
  { value: 'in_progress', label: 'In Progress', color: 'bg-amber-100 text-amber-800' },
  { value: 'completed', label: 'Completed', color: 'bg-green-100 text-green-800' },
  { value: 'cancelled', label: 'Cancelled', color: 'bg-red-100 text-red-800' },
] as const;

export const STAGE_STATUSES = [
  { value: 'pending', label: 'Pending', color: 'bg-muted text-muted-foreground' },
  { value: 'in_progress', label: 'In Progress', color: 'bg-amber-100 text-amber-800' },
  { value: 'completed', label: 'Completed', color: 'bg-green-100 text-green-800' },
] as const;
