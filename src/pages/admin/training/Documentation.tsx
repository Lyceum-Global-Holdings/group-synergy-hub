import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { FileText, Download, Plus, Edit, Trash2, Loader2 } from "lucide-react";
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
    if (manual.file_url) {
      window.open(manual.file_url, '_blank');
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
            <Card key={manual.id}>
              <CardHeader>
                <div className="flex items-start gap-4">
                  <div className="p-3 rounded-lg bg-muted">
                    <FileText className="h-6 w-6 text-primary" />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <CardTitle className="text-lg">{manual.title}</CardTitle>
                        <CardDescription className="mt-2">
                          {manual.description}
                        </CardDescription>
                      </div>
                      {isSuperAdmin && (
                        <div className="flex gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleEdit(manual)}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleDelete(manual)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      )}
                    </div>
                    <div className="flex gap-4 mt-3 text-sm text-muted-foreground flex-wrap">
                      <span className="inline-flex items-center px-2 py-1 rounded-md bg-secondary text-secondary-foreground">
                        {getCategoryLabel(manual.category)}
                      </span>
                      {manual.page_count && <span>{manual.page_count} pages</span>}
                      <span>•</span>
                      <span>{manual.mime_type === 'application/pdf' ? 'PDF' : 'Document'}</span>
                      {manual.file_size && (
                        <>
                          <span>•</span>
                          <span>{(manual.file_size / 1024 / 1024).toFixed(1)} MB</span>
                        </>
                      )}
                      {manual.version && (
                        <>
                          <span>•</span>
                          <span>v{manual.version}</span>
                        </>
                      )}
                    </div>
                    {manual.tags && manual.tags.length > 0 && (
                      <div className="flex gap-2 mt-2 flex-wrap">
                        {manual.tags.map((tag, idx) => (
                          <span
                            key={idx}
                            className="text-xs px-2 py-0.5 rounded-full bg-muted text-muted-foreground"
                          >
                            {tag}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </CardHeader>
              <CardContent className="flex gap-2">
                <Button
                  variant="default"
                  className="flex-1"
                  onClick={() => handleDownload(manual)}
                >
                  <Download className="h-4 w-4 mr-2" />
                  Download
                </Button>
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
