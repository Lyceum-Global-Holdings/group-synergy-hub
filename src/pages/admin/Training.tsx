import { Link } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { BookOpen, PlayCircle, FileText, TrendingUp } from "lucide-react";

export default function Training() {
  const trainingModules = [
    {
      title: "Module Trainings",
      description: "Training materials and guides for each system module",
      icon: BookOpen,
      url: "/admin/training/module-trainings",
      color: "text-blue-500"
    },
    {
      title: "Video Library",
      description: "Video tutorials and step-by-step guides",
      icon: PlayCircle,
      url: "/admin/training/video-library",
      color: "text-purple-500"
    },
    {
      title: "Documentation",
      description: "Comprehensive user guides and manuals",
      icon: FileText,
      url: "/admin/training/documentation",
      color: "text-green-500"
    },
    {
      title: "Training Progress",
      description: "Track user training completion and progress",
      icon: TrendingUp,
      url: "/admin/training/training-progress",
      color: "text-orange-500"
    }
  ];

  return (
    <div className="container mx-auto py-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Training Center</h1>
        <p className="text-muted-foreground mt-2">
          Access training materials, video tutorials, and track learning progress
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-2">
        {trainingModules.map((module) => (
          <Link key={module.url} to={module.url}>
            <Card className="h-full transition-all hover:shadow-lg hover:scale-105">
              <CardHeader>
                <div className="flex items-center gap-3">
                  <div className={`p-3 rounded-lg bg-muted ${module.color}`}>
                    <module.icon className="h-6 w-6" />
                  </div>
                  <div>
                    <CardTitle>{module.title}</CardTitle>
                  </div>
                </div>
                <CardDescription className="mt-2">
                  {module.description}
                </CardDescription>
              </CardHeader>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
