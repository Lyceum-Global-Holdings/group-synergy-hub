import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useUpdateManual, useUploadManualFile, useDeleteManualFile, type TrainingManual } from "@/hooks/useTrainingManuals";
import { Loader2 } from "lucide-react";

const formSchema = z.object({
  title: z.string().min(1, "Title is required").max(200),
  description: z.string().max(1000).optional(),
  category: z.string().min(1, "Category is required"),
  page_count: z.coerce.number().min(1).optional(),
  version: z.string().default("1.0"),
  tags: z.string().optional(),
  display_order: z.coerce.number().default(0),
});

type FormData = z.infer<typeof formSchema>;

interface EditManualDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  manual: TrainingManual | null;
}

export default function EditManualDialog({ open, onOpenChange, manual }: EditManualDialogProps) {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const updateManual = useUpdateManual();
  const uploadFile = useUploadManualFile();
  const deleteFile = useDeleteManualFile();

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
  });

  useEffect(() => {
    if (manual) {
      form.reset({
        title: manual.title,
        description: manual.description || "",
        category: manual.category,
        page_count: manual.page_count || undefined,
        version: manual.version,
        tags: manual.tags?.join(", ") || "",
        display_order: manual.display_order,
      });
    }
  }, [manual, form]);

  const onSubmit = async (data: FormData) => {
    if (!manual) return;

    try {
      let fileData = {
        file_path: manual.file_path,
        file_url: manual.file_url,
        file_size: manual.file_size,
        mime_type: manual.mime_type,
      };

      // If new file selected, upload it and delete old one
      if (selectedFile) {
        const newFileData = await uploadFile.mutateAsync(selectedFile);
        fileData = newFileData;
        
        // Delete old file
        if (manual.file_path) {
          await deleteFile.mutateAsync(manual.file_path);
        }
      }

      await updateManual.mutateAsync({
        id: manual.id,
        updates: {
          title: data.title,
          description: data.description || null,
          category: data.category,
          file_path: fileData.file_path,
          file_url: fileData.file_url,
          file_size: fileData.file_size,
          mime_type: fileData.mime_type,
          page_count: data.page_count || null,
          version: data.version,
          display_order: data.display_order,
          tags: data.tags ? data.tags.split(',').map(t => t.trim()) : null,
        },
      });

      onOpenChange(false);
      setSelectedFile(null);
    } catch (error) {
      console.error("Error updating manual:", error);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setSelectedFile(e.target.files[0]);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit Training Manual</DialogTitle>
        </DialogHeader>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <div>
            <Label htmlFor="title">Title *</Label>
            <Input id="title" {...form.register("title")} />
            {form.formState.errors.title && (
              <p className="text-sm text-destructive mt-1">{form.formState.errors.title.message}</p>
            )}
          </div>

          <div>
            <Label htmlFor="description">Description</Label>
            <Textarea id="description" {...form.register("description")} rows={3} />
          </div>

          <div>
            <Label htmlFor="category">Category *</Label>
            <Select onValueChange={(value) => form.setValue("category", value)} value={form.watch("category")}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="user_guide">User Guide</SelectItem>
                <SelectItem value="module_manual">Module Manual</SelectItem>
                <SelectItem value="quick_reference">Quick Reference</SelectItem>
                <SelectItem value="admin_guide">Admin Guide</SelectItem>
                <SelectItem value="technical">Technical Documentation</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label htmlFor="file">Replace File (optional)</Label>
            <div className="space-y-2">
              <Input
                id="file"
                type="file"
                accept=".pdf,.doc,.docx"
                onChange={handleFileChange}
                className="cursor-pointer"
              />
              {selectedFile ? (
                <span className="text-sm text-muted-foreground">
                  New: {selectedFile.name} ({(selectedFile.size / 1024 / 1024).toFixed(2)} MB)
                </span>
              ) : (
                <span className="text-sm text-muted-foreground">
                  Current: {manual?.file_path} ({manual?.file_size ? (manual.file_size / 1024 / 1024).toFixed(2) : 0} MB)
                </span>
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="page_count">Page Count</Label>
              <Input id="page_count" type="number" {...form.register("page_count")} />
            </div>
            <div>
              <Label htmlFor="version">Version</Label>
              <Input id="version" {...form.register("version")} />
            </div>
          </div>

          <div>
            <Label htmlFor="tags">Tags (comma-separated)</Label>
            <Input id="tags" {...form.register("tags")} placeholder="procurement, warehouse, finance" />
          </div>

          <div>
            <Label htmlFor="display_order">Display Order</Label>
            <Input id="display_order" type="number" {...form.register("display_order")} />
            <p className="text-xs text-muted-foreground mt-1">Lower numbers appear first</p>
          </div>

          <div className="flex justify-end gap-2 pt-4">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={updateManual.isPending || uploadFile.isPending}>
              {(updateManual.isPending || uploadFile.isPending) && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              Update Manual
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
