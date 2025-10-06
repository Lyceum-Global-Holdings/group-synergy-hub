import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Search, Filter } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { format } from "date-fns";
import { useState } from "react";

interface ScorecardFiltersProps {
  searchTerm: string;
  onSearchChange: (value: string) => void;
  statusFilter: string;
  onStatusFilterChange: (value: string) => void;
  performanceFilter: string;
  onPerformanceFilterChange: (value: string) => void;
  dateFrom: Date | undefined;
  dateTo: Date | undefined;
  onDateFromChange: (date: Date | undefined) => void;
  onDateToChange: (date: Date | undefined) => void;
  onReset: () => void;
}

export const ScorecardFilters = ({
  searchTerm,
  onSearchChange,
  statusFilter,
  onStatusFilterChange,
  performanceFilter,
  onPerformanceFilterChange,
  dateFrom,
  dateTo,
  onDateFromChange,
  onDateToChange,
  onReset,
}: ScorecardFiltersProps) => {
  const hasActiveFilters = statusFilter !== 'all' || performanceFilter !== 'all' || dateFrom || dateTo;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by supplier, product, or evaluation number..."
            value={searchTerm}
            onChange={(e) => onSearchChange(e.target.value)}
            className="pl-10"
          />
        </div>
      </div>

      <div className="flex items-center gap-4 flex-wrap">
        <Select value={statusFilter} onValueChange={onStatusFilterChange}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="All Statuses" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            <SelectItem value="draft">Draft</SelectItem>
            <SelectItem value="completed">Completed</SelectItem>
            <SelectItem value="archived">Archived</SelectItem>
          </SelectContent>
        </Select>

        <Select value={performanceFilter} onValueChange={onPerformanceFilterChange}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="All Performance" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Performance</SelectItem>
            <SelectItem value="excellent">Excellent (≥85%)</SelectItem>
            <SelectItem value="good">Good (70-84%)</SelectItem>
            <SelectItem value="fair">Fair (55-69%)</SelectItem>
            <SelectItem value="poor">Poor (&lt;55%)</SelectItem>
          </SelectContent>
        </Select>

        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" className="w-[180px] justify-start">
              {dateFrom ? format(dateFrom, "MMM dd, yyyy") : "From Date"}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0">
            <Calendar
              mode="single"
              selected={dateFrom}
              onSelect={onDateFromChange}
              initialFocus
            />
          </PopoverContent>
        </Popover>

        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" className="w-[180px] justify-start">
              {dateTo ? format(dateTo, "MMM dd, yyyy") : "To Date"}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0">
            <Calendar
              mode="single"
              selected={dateTo}
              onSelect={onDateToChange}
              initialFocus
            />
          </PopoverContent>
        </Popover>

        {hasActiveFilters && (
          <Button variant="ghost" onClick={onReset}>
            Reset Filters
          </Button>
        )}
      </div>
    </div>
  );
};