import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useCreateManual, useUploadManualFile } from "@/hooks/useTrainingManuals";
import { Loader2, Upload } from "lucide-react";

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

interface CreateManualDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function CreateManualDialog({ open, onOpenChange }: CreateManualDialogProps) {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const createManual = useCreateManual();
  const uploadFile = useUploadManualFile();

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      title: "",
      description: "",
      category: "user_guide",
      version: "1.0",
      display_order: 0,
    },
  });

  const onSubmit = async (data: FormData) => {
    if (!selectedFile) {
      alert("Please select a file");
      return;
    }

    try {
      // Upload file first
      const fileData = await uploadFile.mutateAsync(selectedFile);

      // Create manual record
      await createManual.mutateAsync({
        title: data.title,
        description: data.description || null,
        category: data.category,
        file_path: fileData.file_path,
        file_url: fileData.file_url,
        file_size: fileData.file_size,
        mime_type: fileData.mime_type,
        page_count: data.page_count || null,
        version: data.version,
        is_published: true,
        display_order: data.display_order,
        tags: data.tags ? data.tags.split(',').map(t => t.trim()) : null,
      });

      onOpenChange(false);
      form.reset();
      setSelectedFile(null);
    } catch (error) {
      console.error("Error creating manual:", error);
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
          <DialogTitle>Add Training Manual</DialogTitle>
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
            <Select onValueChange={(value) => form.setValue("category", value)} defaultValue="user_guide">
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
            <Label htmlFor="file">File Upload *</Label>
            <div className="flex items-center gap-2">
              <Input
                id="file"
                type="file"
                accept=".pdf,.doc,.docx"
                onChange={handleFileChange}
                className="cursor-pointer"
              />
              {selectedFile && (
                <span className="text-sm text-muted-foreground">
                  {selectedFile.name} ({(selectedFile.size / 1024 / 1024).toFixed(2)} MB)
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
            <Button type="submit" disabled={createManual.isPending || uploadFile.isPending}>
              {(createManual.isPending || uploadFile.isPending) && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              Create Manual
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
