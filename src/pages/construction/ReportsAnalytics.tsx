import { SiteReportAnalytics } from "@/components/construction/reports/SiteReportAnalytics";

const ReportsAnalytics = () => {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Reports Analytics</h1>
        <p className="text-muted-foreground">
          Analyze material transactions by floor, item, and time period
        </p>
      </div>
      <SiteReportAnalytics />
    </div>
  );
};

export default ReportsAnalytics;
