import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, Circle, Clock } from "lucide-react";

export default function TrainingProgress() {
  const userProgress = [
    {
      module: "Finance",
      completed: 10,
      total: 12,
      status: "in_progress",
      lastAccessed: "2 hours ago"
    },
    {
      module: "Warehouse",
      completed: 15,
      total: 15,
      status: "completed",
      lastAccessed: "1 day ago"
    },
    {
      module: "Sourcing",
      completed: 3,
      total: 8,
      status: "in_progress",
      lastAccessed: "3 days ago"
    },
    {
      module: "Procurement",
      completed: 0,
      total: 10,
      status: "not_started",
      lastAccessed: "Never"
    },
    {
      module: "TUH Modules",
      completed: 4,
      total: 6,
      status: "in_progress",
      lastAccessed: "5 hours ago"
    }
  ];

  const totalCompleted = userProgress.reduce((acc, curr) => acc + curr.completed, 0);
  const totalLessons = userProgress.reduce((acc, curr) => acc + curr.total, 0);
  const overallProgress = Math.round((totalCompleted / totalLessons) * 100);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "completed":
        return <Badge className="bg-green-500">Completed</Badge>;
      case "in_progress":
        return <Badge className="bg-blue-500">In Progress</Badge>;
      case "not_started":
        return <Badge variant="secondary">Not Started</Badge>;
      default:
        return <Badge variant="outline">Unknown</Badge>;
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "completed":
        return <CheckCircle2 className="h-5 w-5 text-green-500" />;
      case "in_progress":
        return <Clock className="h-5 w-5 text-blue-500" />;
      case "not_started":
        return <Circle className="h-5 w-5 text-muted-foreground" />;
      default:
        return <Circle className="h-5 w-5 text-muted-foreground" />;
    }
  };

  return (
    <div className="container mx-auto py-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Training Progress</h1>
        <p className="text-muted-foreground mt-2">
          Track your learning progress across all modules
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Overall Progress</CardTitle>
          <CardDescription>
            {totalCompleted} of {totalLessons} lessons completed
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <Progress value={overallProgress} className="h-3" />
            <p className="text-sm text-muted-foreground text-right">
              {overallProgress}% complete
            </p>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4">
        {userProgress.map((item) => {
          const progress = Math.round((item.completed / item.total) * 100);
          
          return (
            <Card key={item.module}>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    {getStatusIcon(item.status)}
                    <div>
                      <CardTitle className="text-lg">{item.module}</CardTitle>
                      <CardDescription className="mt-1">
                        Last accessed: {item.lastAccessed}
                      </CardDescription>
                    </div>
                  </div>
                  {getStatusBadge(item.status)}
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">
                      {item.completed} / {item.total} lessons
                    </span>
                    <span className="font-medium">{progress}%</span>
                  </div>
                  <Progress value={progress} />
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
