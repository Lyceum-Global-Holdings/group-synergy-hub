import { useItemCategories } from "./useItemCategories";

export function useApparelCategories() {
  const { categories, isLoading, error } = useItemCategories();
  
  const isApparelParent = (parentId: string | null): boolean => {
    if (!parentId) return false;
    const parent = categories.find(c => c.id === parentId);
    if (!parent) return false;
    
    const name = parent.name.toLowerCase();
    return name.includes('apparel') || 
           name.includes('clothing') || 
           name.includes('textile') ||
           name.includes('footwear') ||
           name.includes('garment') ||
           name.includes('accessories');
  };
  
  const apparelCategories = categories.filter(cat => {
    const name = cat.name.toLowerCase();
    return name.includes('apparel') || 
           name.includes('clothing') || 
           name.includes('textile') ||
           name.includes('footwear') ||
           name.includes('garment') ||
           name.includes('accessories') ||
           isApparelParent(cat.parent_id);
  });
  
  return { 
    apparelCategories,
    isLoading,
    error
  };
}
