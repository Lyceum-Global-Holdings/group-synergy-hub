import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { FileText, Download, Plus, Edit, Trash2, Loader2, ExternalLink } from "lucide-react";
import { useTrainingManuals } from "@/hooks/useTrainingManuals";
import { useSuperAdmin } from "@/hooks/useSuperAdmin";
import CreateManualDialog from "@/components/admin/training/CreateManualDialog";
import EditManualDialog from "@/components/admin/training/EditManualDialog";
import DeleteManualDialog from "@/components/admin/training/DeleteManualDialog";
import ManualCategoryFilter from "@/components/admin/training/ManualCategoryFilter";
import type { TrainingManual } from "@/hooks/useTrainingManuals";

export default function Documentation() {
  const { data: manuals, isLoading } = useTrainingManuals();
  const { data: isSuperAdmin } = useSuperAdmin();
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedManual, setSelectedManual] = useState<TrainingManual | null>(null);
  const [categoryFilter, setCategoryFilter] = useState("all");

  const filteredManuals = manuals?.filter(
    (manual) => categoryFilter === "all" || manual.category === categoryFilter
  );

  const getCategoryLabel = (category: string) => {
    const labels: Record<string, string> = {
      user_guide: "User Guide",
      module_manual: "Module Manual",
      quick_reference: "Quick Reference",
      admin_guide: "Admin Guide",
      technical: "Technical",
    };
    return labels[category] || category;
  };

  const handleEdit = (manual: TrainingManual) => {
    setSelectedManual(manual);
    setEditDialogOpen(true);
  };

  const handleDelete = (manual: TrainingManual) => {
    setSelectedManual(manual);
    setDeleteDialogOpen(true);
  };

  const handleDownload = (manual: TrainingManual) => {
    const url = manual.document_url || manual.file_url;
    if (url) {
      window.open(url, '_blank', 'noopener,noreferrer');
    }
  };

  return (
    <div className="container mx-auto py-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Documentation</h1>
          <p className="text-muted-foreground mt-2">
            Download user guides, manuals, and reference materials
          </p>
        </div>
        {isSuperAdmin && (
          <Button onClick={() => setCreateDialogOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Add Manual
          </Button>
        )}
      </div>

      <ManualCategoryFilter value={categoryFilter} onChange={setCategoryFilter} />

      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : filteredManuals && filteredManuals.length > 0 ? (
        <div className="grid gap-4 md:grid-cols-2">
          {filteredManuals.map((manual) => (
            <Card key={manual.id} className="overflow-hidden hover:shadow-lg transition-shadow">
              {(manual.thumbnail_url || manual.document_url) && (
                <div className="relative h-48 w-full overflow-hidden bg-muted">
                  <img 
                    src={manual.thumbnail_url || `https://api.microlink.io/?url=${encodeURIComponent(manual.document_url || '')}&screenshot=true&meta=false&embed=screenshot.url`} 
                    alt={manual.title}
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      e.currentTarget.style.display = 'none';
                      e.currentTarget.parentElement?.classList.add('bg-muted');
                    }}
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
                  <div className="absolute bottom-3 left-3 right-3">
                    <h3 className="font-semibold text-lg text-white line-clamp-2">{manual.title}</h3>
                  </div>
                </div>
              )}
              <CardContent className="p-6">
                <div className="flex flex-col gap-4">
                  <div className="flex-1">
                    {!manual.thumbnail_url && !manual.document_url && (
                      <h3 className="font-semibold text-lg mb-2">{manual.title}</h3>
                    )}
                    {manual.description && (
                      <p className="text-sm text-muted-foreground mb-3 line-clamp-2">
                        {manual.description}
                      </p>
                    )}
                    <div className="flex flex-wrap gap-2 mb-3">
                      <span className="inline-flex items-center px-2 py-1 rounded-md bg-secondary text-secondary-foreground text-sm">
                        {getCategoryLabel(manual.category)}
                      </span>
                      {manual.page_count && <span className="text-sm">{manual.page_count} pages</span>}
                      {manual.version && <span className="text-sm">v{manual.version}</span>}
                    </div>
                    {manual.tags && manual.tags.length > 0 && (
                      <div className="flex flex-wrap gap-1">
                        {manual.tags.map((tag, idx) => (
                          <span key={idx} className="text-xs px-2 py-0.5 rounded-full bg-muted text-muted-foreground">
                            {tag}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                  
                  <div className="flex gap-2">
                    <Button
                      variant="default"
                      size="sm"
                      onClick={() => handleDownload(manual)}
                      className="flex-1"
                    >
                      <ExternalLink className="h-4 w-4 mr-2" />
                      View
                    </Button>
                    
                    {isSuperAdmin && (
                      <>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleEdit(manual)}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleDelete(manual)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <div className="text-center py-12">
          <FileText className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <h3 className="text-lg font-medium">No manuals found</h3>
          <p className="text-muted-foreground">
            {categoryFilter === "all"
              ? "No training manuals have been added yet."
              : "No manuals in this category."}
          </p>
          {isSuperAdmin && categoryFilter === "all" && (
            <Button className="mt-4" onClick={() => setCreateDialogOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Add First Manual
            </Button>
          )}
        </div>
      )}

      <CreateManualDialog open={createDialogOpen} onOpenChange={setCreateDialogOpen} />
      <EditManualDialog
        open={editDialogOpen}
        onOpenChange={setEditDialogOpen}
        manual={selectedManual}
      />
      <DeleteManualDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        manual={selectedManual}
      />
    </div>
  );
}
