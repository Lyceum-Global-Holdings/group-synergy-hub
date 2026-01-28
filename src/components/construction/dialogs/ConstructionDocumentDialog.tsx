import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useProjects } from "@/hooks/construction/useProjects";
import { useCreateConstructionDocument, useUpdateConstructionDocument } from "@/hooks/construction/useConstructionDocuments";
import { ConstructionDocument, DOCUMENT_TYPES, DOCUMENT_STATUSES } from "@/types/construction";
import { useEffect } from "react";
import { useCompany } from "@/contexts/CompanyContext";
import { toast } from "sonner";

const formSchema = z.object({
  project_id: z.string().min(1, "Project is required"),
  document_type: z.string().min(1, "Document type is required"),
  title: z.string().min(1, "Title is required"),
  description: z.string().optional(),
  file_url: z.string().min(1, "File URL is required"),
  file_name: z.string().optional(),
  tags: z.string().optional(),
});

type FormData = z.infer<typeof formSchema>;

interface ConstructionDocumentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  document?: ConstructionDocument | null;
}

export function ConstructionDocumentDialog({ open, onOpenChange, document }: ConstructionDocumentDialogProps) {
  const { data: projects } = useProjects();
  const { selectedCompany } = useCompany();
  const createDocument = useCreateConstructionDocument();
  const updateDocument = useUpdateConstructionDocument();

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      project_id: "",
      document_type: "",
      title: "",
      description: "",
      file_url: "",
      file_name: "",
      tags: "",
    },
  });

  useEffect(() => {
    if (document) {
      form.reset({
        project_id: document.project_id,
        document_type: document.document_type,
        title: document.title,
        description: document.description || "",
        file_url: document.file_url,
        file_name: document.file_name || "",
        tags: document.tags?.join(", ") || "",
      });
    } else {
      form.reset({
        project_id: "",
        document_type: "",
        title: "",
        description: "",
        file_url: "",
        file_name: "",
        tags: "",
      });
    }
  }, [document, form]);

  const onSubmit = async (data: FormData) => {
    if (!document && !selectedCompany?.id) {
      toast.error("Please select a company before uploading a document");
      return;
    }
    
    try {
      const tagsArray = data.tags ? data.tags.split(",").map(t => t.trim()).filter(Boolean) : undefined;
      
      const payload = {
        project_id: data.project_id,
        title: data.title,
        file_url: data.file_url,
        document_type: data.document_type as any,
        description: data.description || undefined,
        file_name: data.file_name || undefined,
        tags: tagsArray,
      };
      
      if (document) {
        await updateDocument.mutateAsync({
          id: document.id,
          ...payload,
        });
      } else {
        await createDocument.mutateAsync(payload);
      }
      onOpenChange(false);
    } catch (error) {
      console.error("Error saving document:", error);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-screen h-screen max-w-none max-h-none rounded-none p-6 overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {document ? "Edit Document" : "Upload Document"}
          </DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="project_id"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Project *</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select project" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {projects?.map((project) => (
                          <SelectItem key={project.id} value={project.id}>
                            {project.project_name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="document_type"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Document Type *</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select type" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {DOCUMENT_TYPES.map((type) => (
                          <SelectItem key={type.value} value={type.value}>
                            {type.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="title"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Title *</FormLabel>
                  <FormControl>
                    <Input placeholder="Document title" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Description</FormLabel>
                  <FormControl>
                    <Textarea placeholder="Document description" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="file_url"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>File URL *</FormLabel>
                  <FormControl>
                    <Input placeholder="https://..." {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="file_name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>File Name</FormLabel>
                  <FormControl>
                    <Input placeholder="document.pdf" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="tags"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Tags (comma separated)</FormLabel>
                  <FormControl>
                    <Input placeholder="foundation, structural, revision" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="flex justify-end gap-3 pt-4">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={createDocument.isPending || updateDocument.isPending}>
                {document ? "Update" : "Upload"}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
