export interface SizeOption {
  value: string;
  label: string;
  category: string;
}

export const STANDARD_SIZES: SizeOption[] = [
  // Adult Sizes
  { value: 'XS', label: 'XS', category: 'Adult' },
  { value: 'S', label: 'S', category: 'Adult' },
  { value: 'M', label: 'M', category: 'Adult' },
  { value: 'L', label: 'L', category: 'Adult' },
  { value: 'XL', label: 'XL', category: 'Adult' },
  { value: 'XXL', label: 'XXL', category: 'Adult' },
  { value: 'XXXL', label: 'XXXL', category: 'Adult' },
  
  // Numeric Sizes (Clothing)
  { value: '28', label: '28', category: 'Numeric' },
  { value: '30', label: '30', category: 'Numeric' },
  { value: '32', label: '32', category: 'Numeric' },
  { value: '34', label: '34', category: 'Numeric' },
  { value: '36', label: '36', category: 'Numeric' },
  { value: '38', label: '38', category: 'Numeric' },
  { value: '40', label: '40', category: 'Numeric' },
  { value: '42', label: '42', category: 'Numeric' },
  { value: '44', label: '44', category: 'Numeric' },
  { value: '46', label: '46', category: 'Numeric' },
  { value: '48', label: '48', category: 'Numeric' },
  { value: '50', label: '50', category: 'Numeric' },
  
  // Children's Sizes
  { value: '2T', label: '2T', category: 'Kids' },
  { value: '3T', label: '3T', category: 'Kids' },
  { value: '4T', label: '4T', category: 'Kids' },
  { value: '4', label: '4', category: 'Kids' },
  { value: '5', label: '5', category: 'Kids' },
  { value: '6', label: '6', category: 'Kids' },
  { value: '7', label: '7', category: 'Kids' },
  { value: '8', label: '8', category: 'Kids' },
  { value: '10', label: '10', category: 'Kids' },
  { value: '12', label: '12', category: 'Kids' },
  { value: '14', label: '14', category: 'Kids' },
  { value: '16', label: '16', category: 'Kids' },
  { value: '18', label: '18', category: 'Kids' },
  
  // UK Shoe Sizes
  { value: 'UK3', label: 'UK 3', category: 'Shoes' },
  { value: 'UK4', label: 'UK 4', category: 'Shoes' },
  { value: 'UK5', label: 'UK 5', category: 'Shoes' },
  { value: 'UK6', label: 'UK 6', category: 'Shoes' },
  { value: 'UK7', label: 'UK 7', category: 'Shoes' },
  { value: 'UK8', label: 'UK 8', category: 'Shoes' },
  { value: 'UK9', label: 'UK 9', category: 'Shoes' },
  { value: 'UK10', label: 'UK 10', category: 'Shoes' },
  { value: 'UK11', label: 'UK 11', category: 'Shoes' },
  { value: 'UK12', label: 'UK 12', category: 'Shoes' },
  { value: 'UK13', label: 'UK 13', category: 'Shoes' },
  
  // US Shoe Sizes
  { value: 'US5', label: 'US 5', category: 'Shoes' },
  { value: 'US6', label: 'US 6', category: 'Shoes' },
  { value: 'US7', label: 'US 7', category: 'Shoes' },
  { value: 'US8', label: 'US 8', category: 'Shoes' },
  { value: 'US9', label: 'US 9', category: 'Shoes' },
  { value: 'US10', label: 'US 10', category: 'Shoes' },
  { value: 'US11', label: 'US 11', category: 'Shoes' },
  { value: 'US12', label: 'US 12', category: 'Shoes' },
  { value: 'US13', label: 'US 13', category: 'Shoes' },
  { value: 'US14', label: 'US 14', category: 'Shoes' },
  { value: 'US15', label: 'US 15', category: 'Shoes' },
  
  // Apparel Sizes (Finished Goods)
  { value: 'KIDS', label: 'KIDS', category: 'Apparel' },
  { value: 'KIDM', label: 'KIDM', category: 'Apparel' },
  { value: 'KIDL', label: 'KIDL', category: 'Apparel' },
  { value: 'XS', label: 'XS', category: 'Apparel' },
  { value: 'S', label: 'S', category: 'Apparel' },
  { value: 'M', label: 'M', category: 'Apparel' },
  { value: 'L', label: 'L', category: 'Apparel' },
  { value: 'XL', label: 'XL', category: 'Apparel' },
  { value: '2XL', label: '2XL', category: 'Apparel' },
  { value: '3XL', label: '3XL', category: 'Apparel' },
  
  // Special Sizes
  { value: 'ONE_SIZE', label: 'One Size', category: 'Special' },
  { value: 'FREE_SIZE', label: 'Free Size', category: 'Special' },
  { value: 'CUSTOM', label: 'Custom', category: 'Special' },
];

export const SIZE_CATEGORIES = [
  'Adult',
  'Numeric', 
  'Kids',
  'Shoes',
  'Apparel',
  'Special'
];

export const getSizesByCategory = (category: string) => {
  return STANDARD_SIZES.filter(size => size.category === category);
};