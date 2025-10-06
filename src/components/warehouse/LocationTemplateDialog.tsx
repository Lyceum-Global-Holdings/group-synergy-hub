import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Building, Warehouse, Factory, Store, CheckCircle2 } from 'lucide-react';
import { useWarehouseLocations } from '@/hooks/useWarehouseLocations';
import { useToast } from '@/hooks/use-toast';

const templates = [
  {
    id: 'standard-warehouse',
    name: 'Standard 3-Tier Warehouse',
    description: 'Basic warehouse with locations, sublocations, and departments',
    icon: Warehouse,
    locations: [
      { name: 'Main Warehouse', type: 'location' as const, code: 'WH-001', capacity: 10000 },
      { name: 'Receiving Area', type: 'sublocation' as const, parent: 'Main Warehouse', code: 'WH-001-RCV', capacity: 2000 },
      { name: 'Storage Zone A', type: 'sublocation' as const, parent: 'Main Warehouse', code: 'WH-001-STA', capacity: 4000 },
      { name: 'Storage Zone B', type: 'sublocation' as const, parent: 'Main Warehouse', code: 'WH-001-STB', capacity: 4000 },
      { name: 'Receiving Dock', type: 'department' as const, parent: 'Receiving Area', code: 'WH-001-RCV-DOCK' },
      { name: 'Quality Check', type: 'department' as const, parent: 'Receiving Area', code: 'WH-001-RCV-QC' },
    ]
  },
  {
    id: 'manufacturing',
    name: 'Manufacturing Facility',
    description: 'Production-focused layout with raw materials and finished goods areas',
    icon: Factory,
    locations: [
      { name: 'Production Facility', type: 'location' as const, code: 'PROD-001', capacity: 15000 },
      { name: 'Raw Materials Storage', type: 'sublocation' as const, parent: 'Production Facility', code: 'PROD-001-RM', capacity: 5000 },
      { name: 'Production Floor', type: 'sublocation' as const, parent: 'Production Facility', code: 'PROD-001-PF', capacity: 6000 },
      { name: 'Finished Goods', type: 'sublocation' as const, parent: 'Production Facility', code: 'PROD-001-FG', capacity: 4000 },
      { name: 'Assembly Line 1', type: 'department' as const, parent: 'Production Floor', code: 'PROD-001-PF-AL1' },
      { name: 'Assembly Line 2', type: 'department' as const, parent: 'Production Floor', code: 'PROD-001-PF-AL2' },
      { name: 'Packaging', type: 'department' as const, parent: 'Finished Goods', code: 'PROD-001-FG-PKG' },
    ]
  },
  {
    id: 'retail-distribution',
    name: 'Retail Distribution Center',
    description: 'Multi-zone distribution center for retail operations',
    icon: Store,
    locations: [
      { name: 'Distribution Center', type: 'location' as const, code: 'DC-001', capacity: 20000 },
      { name: 'Inbound Zone', type: 'sublocation' as const, parent: 'Distribution Center', code: 'DC-001-IN', capacity: 3000 },
      { name: 'Reserve Storage', type: 'sublocation' as const, parent: 'Distribution Center', code: 'DC-001-RES', capacity: 10000 },
      { name: 'Pick & Pack Zone', type: 'sublocation' as const, parent: 'Distribution Center', code: 'DC-001-PP', capacity: 4000 },
      { name: 'Outbound Zone', type: 'sublocation' as const, parent: 'Distribution Center', code: 'DC-001-OUT', capacity: 3000 },
      { name: 'Receiving Docks', type: 'department' as const, parent: 'Inbound Zone', code: 'DC-001-IN-DOCK' },
      { name: 'Returns Processing', type: 'department' as const, parent: 'Inbound Zone', code: 'DC-001-IN-RET' },
      { name: 'Bulk Storage', type: 'department' as const, parent: 'Reserve Storage', code: 'DC-001-RES-BULK' },
      { name: 'Picking Area', type: 'department' as const, parent: 'Pick & Pack Zone', code: 'DC-001-PP-PICK' },
      { name: 'Packing Stations', type: 'department' as const, parent: 'Pick & Pack Zone', code: 'DC-001-PP-PACK' },
      { name: 'Shipping Docks', type: 'department' as const, parent: 'Outbound Zone', code: 'DC-001-OUT-SHIP' },
    ]
  },
  {
    id: 'cold-storage',
    name: 'Cold Storage Facility',
    description: 'Temperature-controlled storage zones for perishables',
    icon: Building,
    locations: [
      { name: 'Cold Storage Facility', type: 'location' as const, code: 'COLD-001', capacity: 8000 },
      { name: 'Freezer Zone (-20°C)', type: 'sublocation' as const, parent: 'Cold Storage Facility', code: 'COLD-001-FRZ', capacity: 3000 },
      { name: 'Chiller Zone (2-8°C)', type: 'sublocation' as const, parent: 'Cold Storage Facility', code: 'COLD-001-CHL', capacity: 3000 },
      { name: 'Dry Storage', type: 'sublocation' as const, parent: 'Cold Storage Facility', code: 'COLD-001-DRY', capacity: 2000 },
      { name: 'Frozen Foods', type: 'department' as const, parent: 'Freezer Zone (-20°C)', code: 'COLD-001-FRZ-FOOD' },
      { name: 'Frozen Pharmaceuticals', type: 'department' as const, parent: 'Freezer Zone (-20°C)', code: 'COLD-001-FRZ-PHARM' },
      { name: 'Fresh Produce', type: 'department' as const, parent: 'Chiller Zone (2-8°C)', code: 'COLD-001-CHL-PROD' },
      { name: 'Dairy Products', type: 'department' as const, parent: 'Chiller Zone (2-8°C)', code: 'COLD-001-CHL-DAIRY' },
    ]
  },
];

export function LocationTemplateDialog() {
  const [open, setOpen] = useState(false);
  const [applying, setApplying] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<string | null>(null);
  
  const { createLocation, locations } = useWarehouseLocations();
  const { toast } = useToast();

  const handleApplyTemplate = async (templateId: string) => {
    const template = templates.find(t => t.id === templateId);
    if (!template) return;

    setApplying(true);
    setSelectedTemplate(templateId);

    try {
      const createdLocations: Record<string, string> = {};

      for (const loc of template.locations) {
        const parentId = loc.parent ? createdLocations[loc.parent] : undefined;
        
        const result = await createLocation({
          name: loc.name,
          type: loc.type,
          parent_id: parentId,
          location_code: loc.code,
          capacity: loc.capacity,
          status: 'active',
        });

        // Store the created location ID for child references
        if (result?.id) {
          createdLocations[loc.name] = result.id;
        }
      }

      toast({
        title: 'Template applied',
        description: `Successfully created ${template.locations.length} locations from "${template.name}" template`,
      });

      setOpen(false);
    } catch (error: any) {
      toast({
        title: 'Failed to apply template',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setApplying(false);
      setSelectedTemplate(null);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Building className="h-4 w-4 mr-2" />
          Quick Setup Templates
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Warehouse Setup Templates</DialogTitle>
        </DialogHeader>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {templates.map((template) => {
            const Icon = template.icon;
            return (
              <Card key={template.id} className="relative">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Icon className="h-5 w-5" />
                    {template.name}
                  </CardTitle>
                  <CardDescription>{template.description}</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary">
                      {template.locations.length} locations
                    </Badge>
                    <Badge variant="outline">
                      {template.locations.filter(l => l.type === 'location').length} main
                    </Badge>
                    <Badge variant="outline">
                      {template.locations.filter(l => l.type === 'sublocation').length} sub
                    </Badge>
                    <Badge variant="outline">
                      {template.locations.filter(l => l.type === 'department').length} dept
                    </Badge>
                  </div>

                  <div className="text-sm text-muted-foreground space-y-1">
                    <p className="font-medium">Includes:</p>
                    <ul className="list-disc pl-5 space-y-0.5">
                      {template.locations.slice(0, 3).map((loc, i) => (
                        <li key={i}>{loc.name}</li>
                      ))}
                      {template.locations.length > 3 && (
                        <li>... and {template.locations.length - 3} more</li>
                      )}
                    </ul>
                  </div>

                  <Button
                    onClick={() => handleApplyTemplate(template.id)}
                    disabled={applying}
                    className="w-full"
                  >
                    {applying && selectedTemplate === template.id ? (
                      <>Creating...</>
                    ) : (
                      <>
                        <CheckCircle2 className="h-4 w-4 mr-2" />
                        Apply Template
                      </>
                    )}
                  </Button>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </DialogContent>
    </Dialog>
  );
}