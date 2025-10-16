import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { FileText, Download, ExternalLink } from "lucide-react";

export default function Documentation() {
  const documents = [
    {
      title: "User Guide - Complete System Overview",
      description: "Comprehensive guide covering all system features and workflows",
      pages: 145,
      format: "PDF",
      size: "8.5 MB"
    },
    {
      title: "Procurement Module Manual",
      description: "Detailed documentation for purchase orders and requisitions",
      pages: 42,
      format: "PDF",
      size: "3.2 MB"
    },
    {
      title: "Warehouse Operations Guide",
      description: "Step-by-step instructions for inventory management",
      pages: 68,
      format: "PDF",
      size: "5.1 MB"
    },
    {
      title: "Financial Module Documentation",
      description: "Complete reference for general ledger and accounting",
      pages: 89,
      format: "PDF",
      size: "6.8 MB"
    },
    {
      title: "Quick Reference Cards",
      description: "One-page guides for common tasks and workflows",
      pages: 12,
      format: "PDF",
      size: "1.4 MB"
    },
    {
      title: "Admin Configuration Guide",
      description: "Setup and configuration instructions for administrators",
      pages: 34,
      format: "PDF",
      size: "2.8 MB"
    }
  ];

  return (
    <div className="container mx-auto py-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Documentation</h1>
        <p className="text-muted-foreground mt-2">
          Download user guides, manuals, and reference materials
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {documents.map((doc, index) => (
          <Card key={index}>
            <CardHeader>
              <div className="flex items-start gap-4">
                <div className="p-3 rounded-lg bg-muted">
                  <FileText className="h-6 w-6 text-primary" />
                </div>
                <div className="flex-1">
                  <CardTitle className="text-lg">{doc.title}</CardTitle>
                  <CardDescription className="mt-2">
                    {doc.description}
                  </CardDescription>
                  <div className="flex gap-4 mt-3 text-sm text-muted-foreground">
                    <span>{doc.pages} pages</span>
                    <span>•</span>
                    <span>{doc.format}</span>
                    <span>•</span>
                    <span>{doc.size}</span>
                  </div>
                </div>
              </div>
            </CardHeader>
            <CardContent className="flex gap-2">
              <Button variant="outline" className="flex-1">
                <ExternalLink className="h-4 w-4 mr-2" />
                View
              </Button>
              <Button variant="default" className="flex-1">
                <Download className="h-4 w-4 mr-2" />
                Download
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
