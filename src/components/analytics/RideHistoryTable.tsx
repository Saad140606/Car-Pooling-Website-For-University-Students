"use client";

import React, { useState, useMemo, useCallback, memo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Search,
  Filter,
  Calendar,
  ChevronDown,
  ChevronUp,
  ChevronLeft,
  ChevronRight,
  Car,
  User,
  Star,
  MapPin,
  Clock,
  CheckCircle,
  XCircle,
  AlertCircle,
  Loader2,
  X,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { RideHistoryEntry, RideHistoryFilters, PaginationState } from '@/lib/analyticsTypes';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';

// ============================================================================
// FILTER BADGE
// ============================================================================

interface FilterBadgeProps {
  label: string;
  onRemove: () => void;
}

const FilterBadge = memo(function FilterBadge({ label, onRemove }: FilterBadgeProps) {
  return (
    <motion.span
      initial={{ opacity: 0, scale: 0.8 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.8 }}
      className="inline-flex items-center gap-1 px-2 py-1 bg-primary/20 text-primary text-xs rounded-full"
    >
      {label}
      <button
        onClick={onRemove}
        className="hover:bg-primary/30 rounded-full p-0.5 transition-colors"
      >
        <X className="w-3 h-3" />
      </button>
    </motion.span>
  );
});

// ============================================================================
// FILTER DROPDOWN
// ============================================================================

interface FilterDropdownProps {
  label: string;
  options: { value: string; label: string }[];
  selected: string[];
  onChange: (values: string[]) => void;
}

const FilterDropdown = memo(function FilterDropdown({
  label,
  options,
  selected,
  onChange,
}: FilterDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);

  const toggleOption = (value: string) => {
    if (selected.includes(value)) {
      onChange(selected.filter(v => v !== value));
    } else {
      onChange([...selected, value]);
    }
  };

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          'flex items-center gap-2 px-3 py-2 rounded-lg border transition-all w-full sm:w-auto justify-between',
          'bg-slate-900/50 border-slate-700/50 hover:border-slate-600',
          selected.length > 0 && 'border-primary/50 bg-primary/10'
        )}
      >
        <Filter className="w-4 h-4 text-slate-400" />
        <span className="text-sm text-slate-300">{label}</span>
        {selected.length > 0 && (
          <Badge variant="secondary" className="ml-1 bg-primary/20 text-primary">
            {selected.length}
          </Badge>
        )}
        <ChevronDown className={cn('w-4 h-4 text-slate-400 transition-transform', isOpen && 'rotate-180')} />
      </button>

      <AnimatePresence>
        {isOpen && (
          <>
            <div className="fixed inset-0 z-10" onClick={() => setIsOpen(false)} />
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="absolute top-full left-0 mt-2 w-48 py-2 bg-slate-900 border border-slate-700 rounded-lg shadow-xl z-20"
            >
              {options.map(option => (
                <button
                  key={option.value}
                  onClick={() => toggleOption(option.value)}
                  className={cn(
                    'w-full flex items-center gap-2 px-3 py-2 text-sm transition-colors',
                    selected.includes(option.value)
                      ? 'bg-primary/10 text-primary'
                      : 'text-slate-300 hover:bg-slate-800'
                  )}
                >
                  <div className={cn(
                    'w-4 h-4 rounded border transition-colors',
                    selected.includes(option.value)
                      ? 'bg-primary border-primary'
                      : 'border-slate-600'
                  )}>
                    {selected.includes(option.value) && (
                      <CheckCircle className="w-full h-full text-white" />
                    )}
                  </div>
                  {option.label}
                </button>
              ))}
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
});

// ============================================================================
// RIDE HISTORY ROW - DESKTOP
// ============================================================================

interface RideHistoryRowProps {
  ride: RideHistoryEntry;
  index: number;
}

const RideHistoryRow = memo(function RideHistoryRow({ ride, index }: RideHistoryRowProps) {
  const statusConfig = {
    completed: { color: 'text-emerald-500', bg: 'bg-emerald-500/10', icon: CheckCircle, label: 'Completed' },
    cancelled: { color: 'text-red-500', bg: 'bg-red-500/10', icon: XCircle, label: 'Cancelled' },
    active: { color: 'text-blue-500', bg: 'bg-blue-500/10', icon: Clock, label: 'Active' },
    pending: { color: 'text-amber-500', bg: 'bg-amber-500/10', icon: AlertCircle, label: 'Pending' },
  };

  const status = statusConfig[ride.status] || statusConfig.pending;
  const StatusIcon = status.icon;

  const formatDate = (date: Date) => {
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <motion.tr
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05 }}
      className="border-b border-slate-800/50 hover:bg-slate-800/30 transition-colors"
    >
      {/* Date & Time */}
      <td className="px-4 py-4">
        <div className="flex flex-col">
          <span className="text-sm text-white font-medium">{formatDate(ride.date)}</span>
          <span className="text-xs text-slate-500">{formatTime(ride.date)}</span>
        </div>
      </td>

      {/* Route */}
      <td className="px-4 py-4">
        <div className="flex items-center gap-2">
          <MapPin className="w-4 h-4 text-primary flex-shrink-0" />
          <div className="min-w-0">
            <p className="text-sm text-white truncate max-w-[200px]">{ride.from}</p>
            <p className="text-xs text-slate-500 truncate max-w-[200px]">→ {ride.to}</p>
          </div>
        </div>
      </td>

      {/* Role */}
      <td className="px-4 py-4">
        <div className={cn(
          'inline-flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-medium',
          ride.role === 'driver' ? 'bg-purple-500/10 text-purple-400' : 'bg-blue-500/10 text-blue-400'
        )}>
          {ride.role === 'driver' ? <Car className="w-3 h-3" /> : <User className="w-3 h-3" />}
          {ride.role === 'driver' ? 'Ride Provider' : 'Passenger'}
        </div>
      </td>

      {/* Status */}
      <td className="px-4 py-4">
        <div className={cn(
          'inline-flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-medium',
          status.bg, status.color
        )}>
          <StatusIcon className="w-3 h-3" />
          {status.label}
        </div>
      </td>

      {/* Rating */}
      <td className="px-4 py-4">
        {ride.ratingReceived ? (
          <div className="flex items-center gap-1">
            <Star className="w-4 h-4 text-amber-400 fill-amber-400" />
            <span className="text-sm text-white font-medium">{ride.ratingReceived.toFixed(1)}</span>
          </div>
        ) : (
          <span className="text-xs text-slate-500">—</span>
        )}
      </td>

      {/* Seats / Passengers */}
      <td className="px-4 py-4">
        {ride.role === 'driver' ? (
          <span className="text-sm text-white">{ride.passengers || 0} passengers</span>
        ) : (
          <span className="text-sm text-white">1 seat</span>
        )}
      </td>

      {/* Fare */}
      <td className="px-4 py-4">
        <span className="text-sm text-white font-medium">PKR {ride.fare}</span>
      </td>
    </motion.tr>
  );
});

// ============================================================================
// RIDE HISTORY CARD - MOBILE
// ============================================================================

const RideHistoryCard = memo(function RideHistoryCard({ ride, index }: RideHistoryRowProps) {
  const [expanded, setExpanded] = useState(false);

  const statusConfig = {
    completed: { color: 'text-emerald-500', bg: 'bg-emerald-500/10', icon: CheckCircle, label: 'Completed' },
    cancelled: { color: 'text-red-500', bg: 'bg-red-500/10', icon: XCircle, label: 'Cancelled' },
    active: { color: 'text-blue-500', bg: 'bg-blue-500/10', icon: Clock, label: 'Active' },
    pending: { color: 'text-amber-500', bg: 'bg-amber-500/10', icon: AlertCircle, label: 'Pending' },
  };

  const status = statusConfig[ride.status] || statusConfig.pending;
  const StatusIcon = status.icon;

  const formatDate = (date: Date) => {
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05 }}
      className="bg-slate-900/50 border border-slate-800/50 rounded-xl overflow-hidden"
    >
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full p-4 flex items-center justify-between"
      >
        <div className="flex items-center gap-3">
          <div className={cn(
            'p-2 rounded-lg',
            ride.role === 'driver' ? 'bg-purple-500/10' : 'bg-blue-500/10'
          )}>
            {ride.role === 'driver' ? (
              <Car className="w-5 h-5 text-purple-400" />
            ) : (
              <User className="w-5 h-5 text-blue-400" />
            )}
          </div>
          <div className="text-left">
            <p className="text-sm text-white font-medium truncate max-w-[180px]">
              {ride.from} → {ride.to}
            </p>
            <p className="text-xs text-slate-500">{formatDate(ride.date)}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className={cn(
            'px-2 py-1 rounded-full text-xs font-medium',
            status.bg, status.color
          )}>
            {status.label}
          </div>
          {expanded ? (
            <ChevronUp className="w-4 h-4 text-slate-400" />
          ) : (
            <ChevronDown className="w-4 h-4 text-slate-400" />
          )}
        </div>
      </button>

      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="border-t border-slate-800/50"
          >
            <div className="p-4 grid grid-cols-2 gap-4">
              <div>
                <p className="text-xs text-slate-500">Role</p>
                <p className="text-sm text-white capitalize">{ride.role}</p>
              </div>
              <div>
                <p className="text-xs text-slate-500">Fare</p>
                <p className="text-sm text-white font-medium">PKR {ride.fare}</p>
              </div>
              <div>
                <p className="text-xs text-slate-500">Rating</p>
                {ride.ratingReceived ? (
                  <div className="flex items-center gap-1">
                    <Star className="w-4 h-4 text-amber-400 fill-amber-400" />
                    <span className="text-sm text-white">{ride.ratingReceived.toFixed(1)}</span>
                  </div>
                ) : (
                  <span className="text-sm text-slate-500">—</span>
                )}
              </div>
              <div>
                <p className="text-xs text-slate-500">
                  {ride.role === 'driver' ? 'Passengers' : 'Seats'}
                </p>
                <p className="text-sm text-white">
                  {ride.role === 'driver' ? ride.passengers || 0 : 1}
                </p>
              </div>
              {ride.distanceKm && (
                <div>
                  <p className="text-xs text-slate-500">Distance</p>
                  <p className="text-sm text-white">{ride.distanceKm.toFixed(1)} km</p>
                </div>
              )}
              {ride.durationMinutes && (
                <div>
                  <p className="text-xs text-slate-500">Duration</p>
                  <p className="text-sm text-white">{ride.durationMinutes} min</p>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
});

// ============================================================================
// PAGINATION
// ============================================================================

interface PaginationProps {
  currentPage: number;
  totalPages: number;
  totalItems: number;
  pageSize: number;
  onPageChange: (page: number) => void;
}

const Pagination = memo(function Pagination({
  currentPage,
  totalPages,
  totalItems,
  pageSize,
  onPageChange,
}: PaginationProps) {
  const startItem = (currentPage - 1) * pageSize + 1;
  const endItem = Math.min(currentPage * pageSize, totalItems);

  return (
    <div className="flex flex-col sm:flex-row items-center justify-between gap-4 mt-4 pt-4 border-t border-slate-800/50">
      <p className="text-sm text-slate-500">
        Showing {startItem} - {endItem} of {totalItems} rides
      </p>
      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={() => onPageChange(currentPage - 1)}
          disabled={currentPage <= 1}
          className="border-slate-700 hover:bg-slate-800"
        >
          <ChevronLeft className="w-4 h-4" />
        </Button>
        <div className="flex items-center gap-1">
          {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
            let pageNum: number;
            if (totalPages <= 5) {
              pageNum = i + 1;
            } else if (currentPage <= 3) {
              pageNum = i + 1;
            } else if (currentPage >= totalPages - 2) {
              pageNum = totalPages - 4 + i;
            } else {
              pageNum = currentPage - 2 + i;
            }
            return (
              <button
                key={pageNum}
                onClick={() => onPageChange(pageNum)}
                className={cn(
                  'w-8 h-8 rounded-lg text-sm font-medium transition-colors',
                  currentPage === pageNum
                    ? 'bg-primary text-white'
                    : 'text-slate-400 hover:bg-slate-800'
                )}
              >
                {pageNum}
              </button>
            );
          })}
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => onPageChange(currentPage + 1)}
          disabled={currentPage >= totalPages}
          className="border-slate-700 hover:bg-slate-800"
        >
          <ChevronRight className="w-4 h-4" />
        </Button>
      </div>
    </div>
  );
});

// ============================================================================
// MAIN RIDE HISTORY TABLE
// ============================================================================

interface RideHistoryTableProps {
  rides: RideHistoryEntry[];
  isLoading?: boolean;
}

export const RideHistoryTable = memo(function RideHistoryTable({
  rides,
  isLoading = false,
}: RideHistoryTableProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string[]>([]);
  const [roleFilter, setRoleFilter] = useState<string[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 10;

  // Filter rides
  const filteredRides = useMemo(() => {
    return rides.filter(ride => {
      // Search filter
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        const matchesSearch =
          ride.from.toLowerCase().includes(query) ||
          ride.to.toLowerCase().includes(query);
        if (!matchesSearch) return false;
      }

      // Status filter
      if (statusFilter.length > 0 && !statusFilter.includes(ride.status)) {
        return false;
      }

      // Role filter
      if (roleFilter.length > 0 && !roleFilter.includes(ride.role)) {
        return false;
      }

      return true;
    });
  }, [rides, searchQuery, statusFilter, roleFilter]);

  // Paginate rides
  const paginatedRides = useMemo(() => {
    const startIndex = (currentPage - 1) * pageSize;
    return filteredRides.slice(startIndex, startIndex + pageSize);
  }, [filteredRides, currentPage, pageSize]);

  const totalPages = Math.ceil(filteredRides.length / pageSize);

  // Reset to page 1 when filters change
  const handleStatusFilterChange = useCallback((values: string[]) => {
    setStatusFilter(values);
    setCurrentPage(1);
  }, []);

  const handleRoleFilterChange = useCallback((values: string[]) => {
    setRoleFilter(values);
    setCurrentPage(1);
  }, []);

  const handleSearchChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchQuery(e.target.value);
    setCurrentPage(1);
  }, []);

  const clearAllFilters = useCallback(() => {
    setSearchQuery('');
    setStatusFilter([]);
    setRoleFilter([]);
    setCurrentPage(1);
  }, []);

  const hasActiveFilters = searchQuery || statusFilter.length > 0 || roleFilter.length > 0;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 text-primary animate-spin" />
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-slate-900/50 border border-slate-800/50 rounded-xl overflow-hidden backdrop-blur-md"
    >
      {/* Header & Filters */}
      <div className="p-4 border-b border-slate-800/50">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <h3 className="text-lg font-semibold text-white">Ride History</h3>
            <p className="text-sm text-slate-500">
              {filteredRides.length} ride{filteredRides.length !== 1 ? 's' : ''} found
            </p>
          </div>

          <div className="flex flex-col sm:flex-row flex-wrap items-stretch sm:items-center gap-3">
            {/* Search */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
              <Input
                placeholder="Search routes..."
                value={searchQuery}
                onChange={handleSearchChange}
                className="pl-9 w-full sm:w-[200px] bg-slate-900/50 border-slate-700/50 focus:border-primary"
              />
            </div>

            {/* Status Filter */}
            <FilterDropdown
              label="Status"
              options={[
                { value: 'completed', label: 'Completed' },
                { value: 'cancelled', label: 'Cancelled' },
                { value: 'active', label: 'Active' },
                { value: 'pending', label: 'Pending' },
              ]}
              selected={statusFilter}
              onChange={handleStatusFilterChange}
            />

            {/* Role Filter */}
            <FilterDropdown
              label="Role"
              options={[
                { value: 'driver', label: 'Ride Provider' },
                { value: 'passenger', label: 'Passenger' },
              ]}
              selected={roleFilter}
              onChange={handleRoleFilterChange}
            />

            {/* Clear Filters */}
            {hasActiveFilters && (
              <Button
                variant="ghost"
                size="sm"
                onClick={clearAllFilters}
                className="text-slate-400 hover:text-white"
              >
                Clear all
              </Button>
            )}
          </div>
        </div>

        {/* Active filter badges */}
        {hasActiveFilters && (
          <div className="flex flex-wrap items-center gap-2 mt-3">
            <AnimatePresence mode="popLayout">
              {searchQuery && (
                <FilterBadge
                  label={`Search: ${searchQuery}`}
                  onRemove={() => setSearchQuery('')}
                />
              )}
              {statusFilter.map(status => (
                <FilterBadge
                  key={status}
                  label={status.charAt(0).toUpperCase() + status.slice(1)}
                  onRemove={() => setStatusFilter(statusFilter.filter(s => s !== status))}
                />
              ))}
              {roleFilter.map(role => (
                <FilterBadge
                  key={role}
                  label={role.charAt(0).toUpperCase() + role.slice(1)}
                  onRemove={() => setRoleFilter(roleFilter.filter(r => r !== role))}
                />
              ))}
            </AnimatePresence>
          </div>
        )}
      </div>

      {/* Desktop Table */}
      <div className="hidden lg:block overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-slate-800/50 bg-slate-900/30">
              <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">
                Date & Time
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">
                Route
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">
                Role
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">
                Status
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">
                Rating
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">
                Details
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">
                Fare
              </th>
            </tr>
          </thead>
          <tbody>
            {paginatedRides.length > 0 ? (
              paginatedRides.map((ride, index) => (
                <RideHistoryRow key={ride.id} ride={ride} index={index} />
              ))
            ) : (
              <tr>
                <td colSpan={7} className="px-4 py-12 text-center">
                  <div className="flex flex-col items-center gap-2">
                    <Car className="w-12 h-12 text-slate-700" />
                    <p className="text-slate-500">No rides found</p>
                    {hasActiveFilters && (
                      <Button
                        variant="link"
                        size="sm"
                        onClick={clearAllFilters}
                        className="text-primary"
                      >
                        Clear filters
                      </Button>
                    )}
                  </div>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Mobile Cards */}
      <div className="lg:hidden p-4 space-y-3">
        {paginatedRides.length > 0 ? (
          paginatedRides.map((ride, index) => (
            <RideHistoryCard key={ride.id} ride={ride} index={index} />
          ))
        ) : (
          <div className="flex flex-col items-center gap-2 py-12">
            <Car className="w-12 h-12 text-slate-700" />
            <p className="text-slate-500">No rides found</p>
            {hasActiveFilters && (
              <Button
                variant="link"
                size="sm"
                onClick={clearAllFilters}
                className="text-primary"
              >
                Clear filters
              </Button>
            )}
          </div>
        )}
      </div>

      {/* Pagination */}
      {filteredRides.length > pageSize && (
        <div className="px-4 pb-4">
          <Pagination
            currentPage={currentPage}
            totalPages={totalPages}
            totalItems={filteredRides.length}
            pageSize={pageSize}
            onPageChange={setCurrentPage}
          />
        </div>
      )}
    </motion.div>
  );
});

export default RideHistoryTable;
