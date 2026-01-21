import { useState, useEffect, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table";
import { 
  Users, 
  Clock, 
  Loader2, 
  AlertCircle,
  UserCheck,
  UserX,
  HardHat,
  Wrench,
  Zap,
  Building2,
  Briefcase
} from "lucide-react";
import { format } from "date-fns";
import { 
  useLabourAttendance, 
  useLaboursByLocation,
  useBulkCreateAttendance,
  useUpdateLabourAttendance,
  type LabourAttendanceWithLabour
} from "@/hooks/construction/useLabourAttendance";
import type { DailySiteReport } from "@/types/construction";

interface LabourAttendanceSectionProps {
  report: DailySiteReport;
  locationId: string | null;
  isEditing?: boolean;
  onAttendanceChange?: (summary: AttendanceSummary) => void;
}

export interface AttendanceSummary {
  total: number;
  present: number;
  absent: number;
  categoryBreakdown: Record<string, number>;
}

// Define the specific categories we want to track
const TRACKED_CATEGORIES = [
  { key: "Civil Skill", label: "Civil Skill", icon: HardHat },
  { key: "Civil Labour (Unskill)", label: "Civil Labour", icon: Users },
  { key: "MEP", label: "MEP", icon: Zap },
  { key: "Aluminium", label: "Aluminium", icon: Building2 },
  { key: "Officer", label: "Officer", icon: Briefcase },
];

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
    if (!attendance) return { total: 0, present: 0, absent: 0, categoryBreakdown: {} };

    const present = attendance.filter(a => a.attendance_status === 'present');
    const absent = attendance.filter(a => a.attendance_status === 'absent');
    const categoryBreakdown: Record<string, number> = {};

    // Only count present labours for category breakdown
    present.forEach(a => {
      const cat = a.category || a.labour?.category || 'Other';
      categoryBreakdown[cat] = (categoryBreakdown[cat] || 0) + 1;
    });

    return {
      total: attendance.length,
      present: present.length,
      absent: absent.length,
      categoryBreakdown,
    };
  }, [attendance]);

  useEffect(() => {
    onAttendanceChange?.(summary);
  }, [summary, onAttendanceChange]);

  const handleStatusChange = async (attendanceRecord: LabourAttendanceWithLabour, status: 'present' | 'absent') => {
    if (status === 'absent') {
      // Clear times when marking absent
      await updateAttendance.mutateAsync({
        id: attendanceRecord.id,
        attendance_status: 'absent',
        in_time: null,
        out_time: null,
      });
      setTimeInputs(prev => ({
        ...prev,
        [attendanceRecord.id]: { in: "", out: "" },
      }));
    } else {
      // Just update status to present
      await updateAttendance.mutateAsync({
        id: attendanceRecord.id,
        attendance_status: 'present',
      });
    }
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

    // Format time value for database
    const timeValue = value ? `${value}:00` : null;
    if (field === 'in') {
      await updateAttendance.mutateAsync({
        id: attendanceRecord.id,
        in_time: timeValue,
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
      {/* Status Summary Cards */}
      <div className="grid grid-cols-2 gap-4">
        <Card className="border-green-200 bg-green-50/50">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <UserCheck className="h-4 w-4 text-green-600" />
              Present
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-green-600">{summary.present}</p>
          </CardContent>
        </Card>

        <Card className="border-red-200 bg-red-50/50">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <UserX className="h-4 w-4 text-red-600" />
              Absent
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-red-600">{summary.absent}</p>
          </CardContent>
        </Card>
      </div>

      {/* Category-wise Cards (Only Present Labours) */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {TRACKED_CATEGORIES.map(({ key, label, icon: Icon }) => {
          const count = summary.categoryBreakdown[key] || 0;
          return (
            <Card key={key} className="border">
              <CardHeader className="pb-1 pt-3 px-3">
                <CardTitle className="text-xs font-medium flex items-center gap-1.5 text-muted-foreground">
                  <Icon className="h-3.5 w-3.5" />
                  {label}
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-0 pb-3 px-3">
                <p className="text-xl font-bold">{count}</p>
              </CardContent>
            </Card>
          );
        })}
      </div>

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
                    <TableHead className="w-[120px]">Status</TableHead>
                    <TableHead className="text-center w-[130px]">In Time</TableHead>
                    <TableHead className="text-center w-[130px]">Out Time</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {attendance.map((att) => {
                    const isPresent = att.attendance_status === 'present';
                    return (
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
                          {isEditing ? (
                            <Select
                              value={att.attendance_status || 'absent'}
                              onValueChange={(value: 'present' | 'absent') => handleStatusChange(att, value)}
                              disabled={updateAttendance.isPending}
                            >
                              <SelectTrigger className="w-[110px] h-8">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="present">
                                  <span className="flex items-center gap-1.5">
                                    <span className="h-2 w-2 rounded-full bg-green-500" />
                                    Present
                                  </span>
                                </SelectItem>
                                <SelectItem value="absent">
                                  <span className="flex items-center gap-1.5">
                                    <span className="h-2 w-2 rounded-full bg-red-500" />
                                    Absent
                                  </span>
                                </SelectItem>
                              </SelectContent>
                            </Select>
                          ) : (
                            <Badge 
                              variant={isPresent ? 'default' : 'secondary'}
                              className={isPresent ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}
                            >
                              {isPresent ? 'Present' : 'Absent'}
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-center">
                          {isEditing ? (
                            <Input
                              type="time"
                              value={(timeInputs[att.id]?.in || "").substring(0, 5)}
                              onChange={(e) => handleTimeChange(att, 'in', e.target.value)}
                              className="w-[110px] mx-auto h-8"
                              disabled={!isPresent}
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
                              className="w-[110px] mx-auto h-8"
                              disabled={!isPresent}
                            />
                          ) : (
                            formatTimeDisplay(att.out_time)
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
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
