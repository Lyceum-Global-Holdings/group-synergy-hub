import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PlayCircle, Clock } from "lucide-react";

export default function VideoLibrary() {
  const videos = [
    { title: "Getting Started with the System", duration: "12:45", category: "Basics", views: 1250 },
    { title: "Purchase Order Workflow", duration: "8:30", category: "Procurement", views: 890 },
    { title: "Goods Receipt Note Process", duration: "15:20", category: "Warehouse", views: 745 },
    { title: "Supplier Evaluation Guide", duration: "10:15", category: "Sourcing", views: 620 },
    { title: "Financial Reporting Overview", duration: "18:40", category: "Finance", views: 580 },
    { title: "Asset Management Basics", duration: "14:25", category: "Warehouse", views: 455 }
  ];

  return (
    <div className="container mx-auto py-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Video Library</h1>
        <p className="text-muted-foreground mt-2">
          Watch step-by-step video tutorials for all system features
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {videos.map((video, index) => (
          <Card key={index} className="hover:shadow-md transition-shadow">
            <CardHeader>
              <div className="aspect-video bg-muted rounded-md flex items-center justify-center mb-4">
                <PlayCircle className="h-12 w-12 text-muted-foreground" />
              </div>
              <div className="flex items-center justify-between mb-2">
                <Badge variant="outline">{video.category}</Badge>
                <div className="flex items-center text-sm text-muted-foreground">
                  <Clock className="h-3 w-3 mr-1" />
                  {video.duration}
                </div>
              </div>
              <CardTitle className="text-lg">{video.title}</CardTitle>
              <CardDescription>
                {video.views.toLocaleString()} views
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button className="w-full" variant="default">
                <PlayCircle className="h-4 w-4 mr-2" />
                Watch Now
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
