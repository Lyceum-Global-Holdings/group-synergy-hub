import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { BookOpen, ExternalLink } from "lucide-react";

export default function ModuleTrainings() {
  const modules = [
    { name: "Finance", status: "Available", lessons: 12 },
    { name: "Warehouse", status: "Available", lessons: 15 },
    { name: "Sourcing", status: "Available", lessons: 8 },
    { name: "Procurement", status: "Available", lessons: 10 },
    { name: "Sales", status: "Coming Soon", lessons: 6 },
    { name: "Management", status: "Coming Soon", lessons: 5 }
  ];

  return (
    <div className="container mx-auto py-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Module Trainings</h1>
        <p className="text-muted-foreground mt-2">
          Comprehensive training materials for each system module
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {modules.map((module) => (
          <Card key={module.name}>
            <CardHeader>
              <div className="flex items-center justify-between">
                <BookOpen className="h-5 w-5 text-muted-foreground" />
                <Badge variant={module.status === "Available" ? "default" : "secondary"}>
                  {module.status}
                </Badge>
              </div>
              <CardTitle className="mt-4">{module.name}</CardTitle>
              <CardDescription>
                {module.lessons} training lessons
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button 
                className="w-full" 
                variant="outline"
                disabled={module.status !== "Available"}
              >
                <ExternalLink className="h-4 w-4 mr-2" />
                View Training
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
