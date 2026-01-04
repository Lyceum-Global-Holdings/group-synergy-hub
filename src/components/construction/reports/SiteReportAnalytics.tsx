import { useState, useMemo } from "react";
import { format, startOfMonth, endOfMonth, startOfWeek, endOfWeek, startOfDay, endOfDay } from "date-fns";
import { Calendar as CalendarIcon, BarChart3, Table as TableIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import { useSiteReportAnalytics, PeriodType, getDateRange } from "@/hooks/construction/useSiteReportAnalytics";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { ReportSummaryCards } from "./ReportSummaryCards";
import { FloorWiseChart } from "./FloorWiseChart";
import { ItemWiseChart } from "./ItemWiseChart";
import { TrendChart } from "./TrendChart";
import { FloorWiseTable } from "./FloorWiseTable";
import { ItemWiseTable } from "./ItemWiseTable";
import { TrendTable } from "./TrendTable";
import { MaterialDistributionSection } from "./MaterialDistributionSection";

type ViewMode = 'chart' | 'table';

export function SiteReportAnalytics() {
  const [periodType, setPeriodType] = useState<PeriodType>('monthly');
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [customStartDate, setCustomStartDate] = useState<Date>(startOfMonth(new Date()));
  const [customEndDate, setCustomEndDate] = useState<Date>(endOfMonth(new Date()));
  const [selectedProjectId, setSelectedProjectId] = useState<string>('all');
  const [viewMode, setViewMode] = useState<ViewMode>('chart');

  // Fetch projects for filter
  const { data: projects } = useQuery({
    queryKey: ['construction-projects-list'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('construction_projects')
        .select('id, project_name, project_code')
        .order('project_name');
      if (error) throw error;
      return data;
    },
  });

  // Calculate date range based on period type
  const dateRange = useMemo(() => {
    if (periodType === 'custom') {
      return { start: startOfDay(customStartDate), end: endOfDay(customEndDate) };
    }
    return getDateRange(periodType, selectedDate);
  }, [periodType, selectedDate, customStartDate, customEndDate]);

  // Fetch analytics data
  const { data: analytics, isLoading } = useSiteReportAnalytics({
    projectId: selectedProjectId !== 'all' ? selectedProjectId : undefined,
    periodType,
    startDate: dateRange.start,
    endDate: dateRange.end,
  });

  const handlePeriodChange = (value: PeriodType) => {
    setPeriodType(value);
    // Reset dates when changing period type
    const now = new Date();
    setSelectedDate(now);
    if (value === 'custom') {
      setCustomStartDate(startOfMonth(now));
      setCustomEndDate(endOfMonth(now));
    }
  };

  const getDatePickerLabel = () => {
    switch (periodType) {
      case 'daily':
        return format(selectedDate, 'PPP');
      case 'weekly':
        const weekStart = startOfWeek(selectedDate, { weekStartsOn: 1 });
        const weekEnd = endOfWeek(selectedDate, { weekStartsOn: 1 });
        return `${format(weekStart, 'MMM d')} - ${format(weekEnd, 'MMM d, yyyy')}`;
      case 'monthly':
        return format(selectedDate, 'MMMM yyyy');
      case 'custom':
        return `${format(customStartDate, 'MMM d')} - ${format(customEndDate, 'MMM d, yyyy')}`;
      default:
        return 'Select date';
    }
  };

  return (
    <Tabs defaultValue="transactions" className="space-y-6">
      <TabsList>
        <TabsTrigger value="transactions">Transaction Analytics</TabsTrigger>
        <TabsTrigger value="materials">Material Distribution</TabsTrigger>
      </TabsList>

      <TabsContent value="transactions" className="space-y-6">
        {/* Filters */}
        <div className="flex flex-wrap gap-4 items-end">
          {/* Period Type */}
          <div className="space-y-2">
            <Label>Period</Label>
            <Select value={periodType} onValueChange={(v) => handlePeriodChange(v as PeriodType)}>
              <SelectTrigger className="w-[130px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="daily">Daily</SelectItem>
                <SelectItem value="weekly">Weekly</SelectItem>
                <SelectItem value="monthly">Monthly</SelectItem>
                <SelectItem value="custom">Custom</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Date Picker */}
          {periodType !== 'custom' ? (
            <div className="space-y-2">
              <Label>Date Range</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-[240px] justify-start text-left font-normal",
                      !selectedDate && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {getDatePickerLabel()}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={selectedDate}
                    onSelect={(date) => date && setSelectedDate(date)}
                    initialFocus
                    className="pointer-events-auto"
                  />
                </PopoverContent>
              </Popover>
            </div>
          ) : (
            <>
              <div className="space-y-2">
                <Label>Start Date</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className="w-[150px] justify-start text-left font-normal">
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {format(customStartDate, 'MMM d, yyyy')}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={customStartDate}
                      onSelect={(date) => date && setCustomStartDate(date)}
                      initialFocus
                      className="pointer-events-auto"
                    />
                  </PopoverContent>
                </Popover>
              </div>
              <div className="space-y-2">
                <Label>End Date</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className="w-[150px] justify-start text-left font-normal">
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {format(customEndDate, 'MMM d, yyyy')}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={customEndDate}
                      onSelect={(date) => date && setCustomEndDate(date)}
                      initialFocus
                      className="pointer-events-auto"
                    />
                  </PopoverContent>
                </Popover>
              </div>
            </>
          )}

          {/* Project Filter */}
          <div className="space-y-2">
            <Label>Project</Label>
            <Select value={selectedProjectId} onValueChange={setSelectedProjectId}>
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="All Projects" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Projects</SelectItem>
                {projects?.map((project) => (
                  <SelectItem key={project.id} value={project.id}>
                    {project.project_code} - {project.project_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* View Mode Toggle */}
          <div className="flex gap-1 ml-auto">
            <Button
              variant={viewMode === 'chart' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setViewMode('chart')}
            >
              <BarChart3 className="h-4 w-4 mr-2" />
              Charts
            </Button>
            <Button
              variant={viewMode === 'table' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setViewMode('table')}
            >
              <TableIcon className="h-4 w-4 mr-2" />
              Tables
            </Button>
          </div>
        </div>

        {/* Summary Cards */}
        <ReportSummaryCards
          totalIssued={analytics?.summary.totalIssued || 0}
          totalReturned={analytics?.summary.totalReturned || 0}
          netUsage={analytics?.summary.netUsage || 0}
          uniqueItems={analytics?.summary.uniqueItems || 0}
          uniqueFloors={analytics?.summary.uniqueFloors || 0}
          isLoading={isLoading}
        />

        {/* Charts or Tables based on view mode */}
        {viewMode === 'chart' ? (
          <>
            <div className="grid gap-6 md:grid-cols-2">
              <FloorWiseChart data={analytics?.byFloor || []} isLoading={isLoading} />
              <ItemWiseChart data={analytics?.byItem || []} isLoading={isLoading} />
            </div>
            <TrendChart data={analytics?.trend || []} isLoading={isLoading} />
          </>
        ) : (
          <>
            <div className="grid gap-6 md:grid-cols-2">
              <FloorWiseTable data={analytics?.byFloor || []} isLoading={isLoading} />
              <ItemWiseTable data={analytics?.byItem || []} isLoading={isLoading} />
            </div>
            <TrendTable data={analytics?.trend || []} isLoading={isLoading} />
          </>
        )}
      </TabsContent>

      <TabsContent value="materials" className="space-y-6">
        <MaterialDistributionSection />
      </TabsContent>
    </Tabs>
  );
}
