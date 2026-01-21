import { useState, useEffect, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { 
  Users, 
  Clock, 
  LogIn, 
  LogOut, 
  Loader2, 
  AlertCircle,
  UserCheck,
  HardHat
} from "lucide-react";
import { format } from "date-fns";
import { 
  useLabourAttendance, 
  useLaboursByLocation,
  useBulkCreateAttendance,
  useUpdateLabourAttendance,
  type LabourAttendanceWithLabour
} from "@/hooks/construction/useLabourAttendance";
import type { DailySiteReport, LabourMaster } from "@/types/construction";

interface LabourAttendanceSectionProps {
  report: DailySiteReport;
  locationId: string | null;
  isEditing?: boolean;
  onAttendanceChange?: (summary: AttendanceSummary) => void;
}

export interface AttendanceSummary {
  total: number;
  present: number;
  skilled: number;
  unskilled: number;
  categoryBreakdown: Record<string, number>;
}

export function LabourAttendanceSection({ 
  report, 
  locationId, 
  isEditing = false,
  onAttendanceChange 
}: LabourAttendanceSectionProps) {
  const { data: attendance, isLoading: attendanceLoading } = useLabourAttendance(report.id);
  const { data: locationLabours, isLoading: laboursLoading } = useLaboursByLocation(locationId);
  const bulkCreate = useBulkCreateAttendance();
  const updateAttendance = useUpdateLabourAttendance();

  const [timeInputs, setTimeInputs] = useState<Record<string, { in: string; out: string }>>({});

  // Initialize attendance records for all labours at this location
  useEffect(() => {
    if (locationId && locationLabours && locationLabours.length > 0 && report.id && isEditing) {
      const labourIds = locationLabours.map(l => l.id);
      bulkCreate.mutate({
        siteReportId: report.id,
        locationId,
        attendanceDate: report.report_date,
        labourIds,
      });
    }
  }, [locationId, locationLabours?.length, report.id, report.report_date, isEditing]);

  // Initialize time inputs from attendance data
  useEffect(() => {
    if (attendance) {
      const inputs: Record<string, { in: string; out: string }> = {};
      attendance.forEach(att => {
        inputs[att.id] = {
          in: att.in_time || "",
          out: att.out_time || "",
        };
      });
      setTimeInputs(inputs);
    }
  }, [attendance]);

  // Calculate and emit summary
  const summary = useMemo<AttendanceSummary>(() => {
    if (!attendance) return { total: 0, present: 0, skilled: 0, unskilled: 0, categoryBreakdown: {} };

    const present = attendance.filter(a => a.attendance_status === 'present' || a.in_time);
    const categoryBreakdown: Record<string, number> = {};

    present.forEach(a => {
      const cat = a.category || a.labour?.category || 'Other';
      categoryBreakdown[cat] = (categoryBreakdown[cat] || 0) + 1;
    });

    const skilled = present.filter(a => {
      const cat = (a.category || a.labour?.category || '').toLowerCase();
      return cat.includes('skilled') && !cat.includes('unskilled');
    }).length;

    const unskilled = present.filter(a => {
      const cat = (a.category || a.labour?.category || '').toLowerCase();
      return cat.includes('unskilled') || cat.includes('non-skilled');
    }).length;

    return {
      total: attendance.length,
      present: present.length,
      skilled,
      unskilled,
      categoryBreakdown,
    };
  }, [attendance]);

  useEffect(() => {
    onAttendanceChange?.(summary);
  }, [summary, onAttendanceChange]);

  const handleMarkIn = async (attendanceRecord: LabourAttendanceWithLabour) => {
    const currentTime = format(new Date(), "HH:mm:ss");
    await updateAttendance.mutateAsync({
      id: attendanceRecord.id,
      in_time: currentTime,
      attendance_status: 'present',
    });
    setTimeInputs(prev => ({
      ...prev,
      [attendanceRecord.id]: { ...prev[attendanceRecord.id], in: currentTime },
    }));
  };

  const handleMarkOut = async (attendanceRecord: LabourAttendanceWithLabour) => {
    const currentTime = format(new Date(), "HH:mm:ss");
    await updateAttendance.mutateAsync({
      id: attendanceRecord.id,
      out_time: currentTime,
    });
    setTimeInputs(prev => ({
      ...prev,
      [attendanceRecord.id]: { ...prev[attendanceRecord.id], out: currentTime },
    }));
  };

  const handleTimeChange = async (
    attendanceRecord: LabourAttendanceWithLabour, 
    field: 'in' | 'out', 
    value: string
  ) => {
    setTimeInputs(prev => ({
      ...prev,
      [attendanceRecord.id]: { ...prev[attendanceRecord.id], [field]: value },
    }));

    // Debounce the update
    const timeValue = value ? `${value}:00` : null;
    if (field === 'in') {
      await updateAttendance.mutateAsync({
        id: attendanceRecord.id,
        in_time: timeValue,
        attendance_status: timeValue ? 'present' : 'absent',
      });
    } else {
      await updateAttendance.mutateAsync({
        id: attendanceRecord.id,
        out_time: timeValue,
      });
    }
  };

  const formatTimeDisplay = (time: string | null) => {
    if (!time) return "-";
    // Convert HH:mm:ss to HH:mm for display
    return time.substring(0, 5);
  };

  const isLoading = attendanceLoading || laboursLoading || bulkCreate.isPending;

  if (!locationId) {
    return (
      <Card className="border-dashed">
        <CardContent className="py-8">
          <div className="flex flex-col items-center justify-center text-center text-muted-foreground">
            <AlertCircle className="h-8 w-8 mb-2" />
            <p>Select a location to view and manage labour attendance</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (isLoading) {
    return (
      <Card>
        <CardContent className="py-8">
          <div className="flex items-center justify-center">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            <span className="ml-2 text-muted-foreground">Loading attendance data...</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Users className="h-4 w-4 text-blue-500" />
              Total Labours
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{summary.total}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <UserCheck className="h-4 w-4 text-green-500" />
              Present
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-green-600">{summary.present}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <HardHat className="h-4 w-4 text-orange-500" />
              Skilled
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-orange-600">{summary.skilled}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Users className="h-4 w-4 text-purple-500" />
              Non-Skilled
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-purple-600">{summary.unskilled}</p>
          </CardContent>
        </Card>
      </div>

      {/* Category Breakdown */}
      {Object.keys(summary.categoryBreakdown).length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Category Breakdown (Present)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {Object.entries(summary.categoryBreakdown).map(([category, count]) => (
                <Badge key={category} variant="secondary">
                  {category}: {count}
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Attendance Table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Clock className="h-4 w-4" />
            Labour Attendance - {format(new Date(report.report_date), "MMM d, yyyy")}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {attendance && attendance.length > 0 ? (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[100px]">Employee ID</TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead>Company</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-center">In Time</TableHead>
                    <TableHead className="text-center">Out Time</TableHead>
                    {isEditing && <TableHead className="text-center">Actions</TableHead>}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {attendance.map((att) => (
                    <TableRow key={att.id}>
                      <TableCell className="font-mono text-xs">
                        {att.labour?.employee_id || "-"}
                      </TableCell>
                      <TableCell className="font-medium">
                        {att.labour?.name || "-"}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">
                          {att.category || att.labour?.category || "N/A"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {att.labour?.labour_company || "-"}
                      </TableCell>
                      <TableCell>
                        <Badge 
                          variant={att.attendance_status === 'present' ? 'default' : 'secondary'}
                          className={att.attendance_status === 'present' ? 'bg-green-100 text-green-800' : ''}
                        >
                          {att.attendance_status === 'present' ? 'Present' : 'Absent'}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-center">
                        {isEditing ? (
                          <Input
                            type="time"
                            value={(timeInputs[att.id]?.in || "").substring(0, 5)}
                            onChange={(e) => handleTimeChange(att, 'in', e.target.value)}
                            className="w-24 mx-auto"
                          />
                        ) : (
                          formatTimeDisplay(att.in_time)
                        )}
                      </TableCell>
                      <TableCell className="text-center">
                        {isEditing ? (
                          <Input
                            type="time"
                            value={(timeInputs[att.id]?.out || "").substring(0, 5)}
                            onChange={(e) => handleTimeChange(att, 'out', e.target.value)}
                            className="w-24 mx-auto"
                            disabled={!att.in_time}
                          />
                        ) : (
                          formatTimeDisplay(att.out_time)
                        )}
                      </TableCell>
                      {isEditing && (
                        <TableCell className="text-center">
                          <div className="flex items-center justify-center gap-1">
                            <Button
                              size="sm"
                              variant={att.in_time ? "secondary" : "default"}
                              className="h-7 px-2"
                              onClick={() => handleMarkIn(att)}
                              disabled={updateAttendance.isPending}
                            >
                              <LogIn className="h-3 w-3 mr-1" />
                              IN
                            </Button>
                            <Button
                              size="sm"
                              variant={att.out_time ? "secondary" : "outline"}
                              className="h-7 px-2"
                              onClick={() => handleMarkOut(att)}
                              disabled={!att.in_time || updateAttendance.isPending}
                            >
                              <LogOut className="h-3 w-3 mr-1" />
                              OUT
                            </Button>
                          </div>
                        </TableCell>
                      )}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : (
            <div className="py-8 text-center text-muted-foreground">
              <Users className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p>No labours assigned to this location</p>
              <p className="text-sm">Add labours to this location in the Labour Master</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
