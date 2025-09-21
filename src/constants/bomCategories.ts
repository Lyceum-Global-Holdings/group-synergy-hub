export const BOM_CATEGORIES = {
  fabric: {
    label: 'Fabric',
    items: [
      { item_name: 'Fabric', unit_of_measure: 'mtr' },
      { item_name: 'Interlining', unit_of_measure: 'mtr' },
      { item_name: 'Collar', unit_of_measure: 'pcs' },
      { item_name: 'Cuffs', unit_of_measure: 'pcs' }
    ]
  },
  sewing_trims: {
    label: 'Sewing Trims',
    items: [
      { item_name: 'Zipper', unit_of_measure: 'pcs' },
      { item_name: 'Size Label', unit_of_measure: 'pcs' },
      { item_name: 'Button', unit_of_measure: 'pcs' },
      { item_name: 'Band Stiffs', unit_of_measure: 'pcs' },
      { item_name: 'Elastic', unit_of_measure: 'mtr' },
      { item_name: 'DTF', unit_of_measure: 'pcs' },
      { item_name: 'Thread 1', unit_of_measure: 'cone' },
      { item_name: 'Thread 2', unit_of_measure: 'cone' }
    ]
  },
  packing_trims: {
    label: 'Packing Trims',
    items: [
      { item_name: 'Hand Tag', unit_of_measure: 'pcs' },
      { item_name: 'Tag Pin', unit_of_measure: 'pcs' },
      { item_name: 'Polybag 10x14', unit_of_measure: 'pcs' },
      { item_name: 'Barcode Sticker', unit_of_measure: 'pcs' }
    ]
  },
  embellishment: {
    label: 'Embellishment',
    items: [
      { item_name: 'Embroidery', unit_of_measure: 'pcs' },
      { item_name: 'HTSL', unit_of_measure: 'pcs' },
      { item_name: 'Print', unit_of_measure: 'pcs' }
    ]
  }
} as const;

export type BomCategoryKey = keyof typeof BOM_CATEGORIES;