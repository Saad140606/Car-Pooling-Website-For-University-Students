"use client";

import React, { useState } from "react";
import {
  Calendar,
  Download,
  Filter,
  RefreshCcw,
  ChevronDown,
  X,
} from "lucide-react";

export interface DateRange {
  from: Date;
  to: Date;
  preset?: string;
}

export interface FilterOption {
  id: string;
  label: string;
  value: string;
}

interface AnalyticsLayoutProps {
  children: React.ReactNode;
  title: string;
  portalName: "FAST" | "NED" | "Karachi";
  dateRange: DateRange;
  onDateRangeChange: (range: DateRange) => void;
  onRefresh?: () => void;
  onExport?: () => void;
  filters?: {
    label: string;
    options: FilterOption[];
    selected: string[];
    onChange: (selected: string[]) => void;
  }[];
  isLoading?: boolean;
}

const DATE_PRESETS = [
  { label: "Today", days: 0 },
  { label: "Last 7 Days", days: 7 },
  { label: "Last 30 Days", days: 30 },
  { label: "Last 90 Days", days: 90 },
  { label: "This Year", days: 365 },
];

export const AnalyticsLayout: React.FC<AnalyticsLayoutProps> = ({
  children,
  title,
  portalName,
  dateRange,
  onDateRangeChange,
  onRefresh,
  onExport,
  filters = [],
  isLoading = false,
}) => {
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showFilters, setShowFilters] = useState(false);

  const portalColors = {
    FAST: {
      primary: "from-primary to-primary/80",
      badge: "bg-primary/20 text-primary border-primary/30",
    },
    NED: {
      primary: "from-purple-600 to-purple-500",
      badge: "bg-purple-500/20 text-purple-400 border-purple-500/30",
    },
  };

  const handlePresetSelect = (days: number, label: string) => {
    const to = new Date();
    const from = new Date();
    from.setDate(from.getDate() - days);

    onDateRangeChange({ from, to, preset: label });
    setShowDatePicker(false);
  };

  const formatDateRange = () => {
    if (dateRange.preset) return dateRange.preset;

    const formatDate = (date: Date) =>
      date.toLocaleDateString("en-US", { month: "short", day: "numeric" });

    return `${formatDate(dateRange.from)} - ${formatDate(dateRange.to)}`;
  };

  const activeFiltersCount = filters.reduce(
    (count, filter) => count + filter.selected.length,
    0
  );

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="sticky top-0 z-40 backdrop-blur-xl bg-background/80 border-b border-white/10">
        <div className="container mx-auto px-4 sm:px-6 py-4">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
            {/* Title & Portal Badge */}
            <div className="flex items-center gap-3">
              <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold text-white animate-fade-slide-up">
                {title}
              </h1>
              <span
                className={`
                  px-3 py-1 rounded-full text-sm font-semibold border
                  ${portalColors[portalName].badge}
                  animate-scale-up
                `}
                style={{ animationDelay: "100ms" }}
              >
                {portalName}
              </span>
            </div>

            {/* Actions */}
            <div className="flex flex-col sm:flex-row flex-wrap items-stretch sm:items-center gap-2 w-full lg:w-auto">
              {/* Date Range Picker */}
              <div className="relative">
                <button
                  onClick={() => setShowDatePicker(!showDatePicker)}
                  className="
                    flex items-center justify-between gap-2 px-4 py-2 rounded-lg w-full sm:w-auto
                    bg-card border border-white/10
                    hover:border-primary/50 hover:bg-card/80
                    transition-all duration-300
                    text-white/80 hover:text-white
                    animate-fade-slide-up
                  "
                  style={{ animationDelay: "150ms" }}
                >
                  <Calendar className="w-4 h-4" />
                  <span className="text-sm font-medium">{formatDateRange()}</span>
                  <ChevronDown className="w-4 h-4" />
                </button>

                {showDatePicker && (
                  <>
                    <div
                      className="fixed inset-0 z-10"
                      onClick={() => setShowDatePicker(false)}
                    />
                    <div
                      className="
                        absolute top-full left-0 sm:left-auto sm:right-0 mt-2 w-56 max-w-[90vw] p-2
                        bg-card border border-white/10 rounded-lg shadow-2xl
                        animate-scale-up z-20
                      "
                    >
                      {DATE_PRESETS.map((preset, idx) => (
                        <button
                          key={preset.label}
                          onClick={() => handlePresetSelect(preset.days, preset.label)}
                          className={`
                            w-full px-4 py-2.5 rounded-lg text-left text-sm
                            transition-all duration-200
                            hover:bg-primary/10 hover:text-primary
                            stagger-item
                            ${
                              dateRange.preset === preset.label
                                ? "bg-primary/20 text-primary font-medium"
                                : "text-white/70"
                            }
                          `}
                          style={{ animationDelay: `${idx * 30}ms` }}
                        >
                          {preset.label}
                        </button>
                      ))}
                    </div>
                  </>
                )}
              </div>

              {/* Filters Button */}
              {filters.length > 0 && (
                <div className="relative">
                  <button
                    onClick={() => setShowFilters(!showFilters)}
                    className="
                        relative flex items-center justify-between gap-2 px-4 py-2 rounded-lg w-full sm:w-auto
                      bg-card border border-white/10
                      hover:border-primary/50 hover:bg-card/80
                      transition-all duration-300
                      text-white/80 hover:text-white
                      animate-fade-slide-up
                    "
                    style={{ animationDelay: "200ms" }}
                  >
                    <Filter className="w-4 h-4" />
                    <span className="text-sm font-medium">Filters</span>
                    {activeFiltersCount > 0 && (
                      <span className="absolute -top-1 -right-1 w-5 h-5 bg-primary rounded-full text-xs flex items-center justify-center font-bold animate-bounce-in">
                        {activeFiltersCount}
                      </span>
                    )}
                  </button>

                  {showFilters && (
                    <>
                      <div
                        className="fixed inset-0 z-10"
                        onClick={() => setShowFilters(false)}
                      />
                      <div
                        className="
                          absolute top-full left-0 sm:left-auto sm:right-0 mt-2 w-72 max-w-[90vw] p-4
                          bg-card border border-white/10 rounded-lg shadow-2xl
                          animate-slide-down z-20 max-h-96 overflow-y-auto
                        "
                      >
                        <div className="flex items-center justify-between mb-4">
                          <h3 className="text-sm font-semibold text-white">Filters</h3>
                          {activeFiltersCount > 0 && (
                            <button
                              onClick={() => {
                                filters.forEach((f) => f.onChange([]));
                              }}
                              className="text-xs text-primary hover:text-primary/80 transition-colors"
                            >
                              Clear All
                            </button>
                          )}
                        </div>

                        <div className="space-y-4">
                          {filters.map((filter, filterIdx) => (
                            <div
                              key={filter.label}
                              className="stagger-item"
                              style={{ animationDelay: `${filterIdx * 50}ms` }}
                            >
                              <div className="text-xs font-medium text-white/60 mb-2">
                                {filter.label}
                              </div>
                              <div className="space-y-1">
                                {filter.options.map((option) => {
                                  const isSelected = filter.selected.includes(option.value);

                                  return (
                                    <button
                                      key={option.id}
                                      onClick={() => {
                                        const newSelected = isSelected
                                          ? filter.selected.filter((v) => v !== option.value)
                                          : [...filter.selected, option.value];
                                        filter.onChange(newSelected);
                                      }}
                                      className={`
                                        w-full px-3 py-2 rounded-lg text-left text-sm
                                        transition-all duration-200
                                        ${
                                          isSelected
                                            ? "bg-primary/20 text-primary border border-primary/30"
                                            : "bg-white/5 text-white/70 hover:bg-white/10 hover:text-white"
                                        }
                                      `}
                                    >
                                      {option.label}
                                    </button>
                                  );
                                })}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </>
                  )}
                </div>
              )}

              {/* Refresh Button */}
              {onRefresh && (
                <button
                  onClick={onRefresh}
                  disabled={isLoading}
                  className="
                    p-2 rounded-lg
                    bg-card border border-white/10
                    hover:border-primary/50 hover:bg-card/80
                    transition-all duration-300
                    text-white/80 hover:text-white
                    disabled:opacity-50 disabled:cursor-not-allowed
                    animate-fade-slide-up
                  "
                  style={{ animationDelay: "250ms" }}
                  title="Refresh data"
                >
                  <RefreshCcw className={`w-4 h-4 ${isLoading ? "animate-spin" : ""}`} />
                </button>
              )}

              {/* Export Button */}
              {onExport && (
                <button
                  onClick={onExport}
                  className="
                    flex items-center gap-2 px-4 py-2 rounded-lg
                    bg-gradient-to-r ${portalColors[portalName].primary}
                    hover:shadow-xl hover:scale-105
                    transition-all duration-300
                    text-white font-medium
                    animate-fade-slide-up
                  "
                  style={{ animationDelay: "300ms" }}
                >
                  <Download className="w-4 h-4" />
                  <span className="text-sm">Export</span>
                </button>
              )}
            </div>
          </div>

          {/* Active Filters */}
          {activeFiltersCount > 0 && (
            <div className="flex flex-wrap items-center gap-2 mt-4 animate-slide-down">
              <span className="text-xs text-white/50">Active filters:</span>
              {filters.map((filter) =>
                filter.selected.map((value) => {
                  const option = filter.options.find((o) => o.value === value);
                  if (!option) return null;

                  return (
                    <button
                      key={`${filter.label}-${value}`}
                      onClick={() => {
                        filter.onChange(filter.selected.filter((v) => v !== value));
                      }}
                      className="
                        flex items-center gap-1.5 px-2.5 py-1 rounded-full
                        bg-primary/20 border border-primary/30
                        text-primary text-xs font-medium
                        hover:bg-primary/30 transition-all duration-200
                        animate-scale-up
                      "
                    >
                      <span>{option.label}</span>
                      <X className="w-3 h-3" />
                    </button>
                  );
                })
              )}
            </div>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="container mx-auto px-3 sm:px-4 md:px-6 py-4 sm:py-6 md:py-8">
        {isLoading && (
          <div className="absolute inset-0 bg-background/50 backdrop-blur-sm flex items-center justify-center z-30">
            <div className="flex items-center gap-3">
              <RefreshCcw className="w-6 h-6 text-primary animate-spin" />
              <span className="text-white font-medium">Loading...</span>
            </div>
          </div>
        )}
        {children}
      </div>
    </div>
  );
};
