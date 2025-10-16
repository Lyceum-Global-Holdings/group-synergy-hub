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
import { useUpdateManual, useFetchLinkPreview, type TrainingManual } from "@/hooks/useTrainingManuals";
import { Loader2 } from "lucide-react";

const formSchema = z.object({
  title: z.string().min(1, "Title is required").max(200),
  description: z.string().max(1000).optional(),
  category: z.string().min(1, "Category is required"),
  document_url: z.string().url("Must be a valid URL"),
  thumbnail_url: z.string().url("Must be a valid URL").optional().or(z.literal("")),
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
  const [previewThumbnail, setPreviewThumbnail] = useState<string>("");
  const updateManual = useUpdateManual();
  const fetchPreview = useFetchLinkPreview();

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
  });

  useEffect(() => {
    if (manual) {
      form.reset({
        title: manual.title,
        description: manual.description || "",
        category: manual.category,
        document_url: manual.document_url || "",
        thumbnail_url: manual.thumbnail_url || "",
        page_count: manual.page_count || undefined,
        version: manual.version,
        tags: manual.tags?.join(", ") || "",
        display_order: manual.display_order,
      });
      setPreviewThumbnail(manual.thumbnail_url || "");
    }
  }, [manual, form]);

  const documentUrl = form.watch("document_url");

  useEffect(() => {
    if (!manual) return;

    const timer = setTimeout(() => {
      if (documentUrl && documentUrl !== manual.document_url && documentUrl.startsWith("http")) {
        fetchPreview.mutate(documentUrl, {
          onSuccess: (preview) => {
            if (preview.thumbnail) {
              setPreviewThumbnail(preview.thumbnail);
              if (!form.getValues("thumbnail_url")) {
                form.setValue("thumbnail_url", preview.thumbnail);
              }
            }
          },
        });
      }
    }, 800);

    return () => clearTimeout(timer);
  }, [documentUrl, manual]);

  const onSubmit = async (data: FormData) => {
    if (!manual) return;

    try {
      await updateManual.mutateAsync({
        id: manual.id,
        updates: {
          title: data.title,
          description: data.description || null,
          category: data.category,
          document_url: data.document_url,
          thumbnail_url: data.thumbnail_url || null,
          page_count: data.page_count || null,
          version: data.version,
          display_order: data.display_order,
          tags: data.tags ? data.tags.split(',').map(t => t.trim()) : null,
        },
      });

      onOpenChange(false);
    } catch (error) {
      console.error("Error updating manual:", error);
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
            <Label htmlFor="document_url">Document URL *</Label>
            <Input id="document_url" placeholder="https://example.com/document.pdf" {...form.register("document_url")} />
            {form.formState.errors.document_url && (
              <p className="text-sm text-destructive mt-1">{form.formState.errors.document_url.message}</p>
            )}
            {fetchPreview.isPending && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground mt-2">
                <Loader2 className="h-4 w-4 animate-spin" />
                Fetching preview...
              </div>
            )}
          </div>

          {previewThumbnail && (
            <div className="rounded-lg border p-4">
              <p className="text-sm font-medium mb-2">Preview Thumbnail</p>
              <img 
                src={previewThumbnail} 
                alt="Preview" 
                className="w-full h-48 object-cover rounded"
              />
            </div>
          )}

          <div>
            <Label htmlFor="thumbnail_url">Custom Thumbnail URL (Optional)</Label>
            <Input id="thumbnail_url" placeholder="https://example.com/thumbnail.jpg" {...form.register("thumbnail_url")} />
            {form.formState.errors.thumbnail_url && (
              <p className="text-sm text-destructive mt-1">{form.formState.errors.thumbnail_url.message}</p>
            )}
          </div>

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
                <SelectItem value="warehouse">Warehouse Management</SelectItem>
                <SelectItem value="procurement">Procurement</SelectItem>
                <SelectItem value="sourcing">Sourcing</SelectItem>
                <SelectItem value="finance">Finance</SelectItem>
                <SelectItem value="general">General</SelectItem>
              </SelectContent>
            </Select>
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
            <Button type="submit" disabled={updateManual.isPending}>
              {updateManual.isPending && (
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
