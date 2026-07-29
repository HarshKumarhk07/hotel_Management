import React, { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { 
  Filter, 
  X, 
  Search, 
  Calendar, 
  Car, 
  User, 
  CheckCircle2, 
  CreditCard,
  Building,
  RotateCcw,
  ChevronDown,
  Hash
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

export interface ValetFilterState {
  fromDate?: string;
  toDate?: string;
  bookingStatus?: string;
  paymentStatus?: string;
  status?: string;
  assignedValet?: string;
  customerName?: string;
  bookingId?: string;
  carNumber?: string;
  vehicleType?: string;
  property?: string;
}

interface ValetFiltersProps {
  filters: ValetFilterState;
  onFilterChange: (filters: ValetFilterState) => void;
  isOpen: boolean;
  setIsOpen: (open: boolean) => void;
}

export function ValetFilters({ filters, onFilterChange, isOpen, setIsOpen }: ValetFiltersProps) {
  const [localFilters, setLocalFilters] = useState<ValetFilterState>(filters);
  const [datePreset, setDatePreset] = useState<string>('custom');

  // Fetch managers for the assigned valet dropdown
  const { data: managers } = useQuery({
    queryKey: ['active-valet-managers'],
    queryFn: async () => {
      const res = await api.get('/valet/admin/managers?limit=100');
      return res.data.data.items;
    }
  });

  // Sync prop filters to local state when opened
  useEffect(() => {
    if (isOpen) {
      setLocalFilters(filters);
    }
  }, [filters, isOpen]);

  const handleChange = (key: keyof ValetFilterState, value: string | undefined) => {
    setLocalFilters(prev => ({ ...prev, [key]: value }));
  };

  const handleDatePreset = (preset: string) => {
    setDatePreset(preset);
    const now = new Date();
    let fromDate: Date | undefined;
    let toDate: Date | undefined;

    switch (preset) {
      case 'today':
        fromDate = new Date(now.setHours(0, 0, 0, 0));
        toDate = new Date(now.setHours(23, 59, 59, 999));
        break;
      case 'yesterday':
        const yesterday = new Date(now);
        yesterday.setDate(yesterday.getDate() - 1);
        fromDate = new Date(yesterday.setHours(0, 0, 0, 0));
        toDate = new Date(yesterday.setHours(23, 59, 59, 999));
        break;
      case 'this_week':
        const firstDay = new Date(now.setDate(now.getDate() - now.getDay()));
        fromDate = new Date(firstDay.setHours(0, 0, 0, 0));
        toDate = new Date(now.setHours(23, 59, 59, 999));
        break;
      case 'this_month':
        fromDate = new Date(now.getFullYear(), now.getMonth(), 1);
        toDate = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
        break;
      case 'custom':
      default:
        fromDate = undefined;
        toDate = undefined;
        break;
    }

    setLocalFilters(prev => ({
      ...prev,
      fromDate: fromDate ? fromDate.toISOString().split('T')[0] : undefined,
      toDate: toDate ? toDate.toISOString().split('T')[0] : undefined,
    }));
  };

  const handleApply = () => {
    onFilterChange(localFilters);
    setIsOpen(false);
  };

  const handleReset = () => {
    const emptyFilters = {};
    setLocalFilters(emptyFilters);
    setDatePreset('custom');
    onFilterChange(emptyFilters);
  };

  const activeFilterCount = Object.values(filters).filter(v => v !== undefined && v !== '').length;

  if (!isOpen) return null;

  return (
    <>
      {/* Mobile Backdrop */}
      <div 
        className="fixed inset-0 z-40 bg-zinc-950/50 backdrop-blur-sm lg:hidden transition-opacity"
        onClick={() => setIsOpen(false)}
      />
      
      {/* Filter Panel */}
      <div className={`
        fixed inset-y-0 right-0 z-50 w-full max-w-sm bg-white shadow-2xl flex flex-col
        transform transition-transform duration-300 ease-in-out lg:relative lg:translate-x-0 lg:max-w-xs lg:border-l lg:border-zinc-200 lg:shadow-none
        ${isOpen ? 'translate-x-0' : 'translate-x-full lg:hidden'}
      `}>
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-100">
          <div className="flex items-center gap-2">
            <Filter className="h-4 w-4 text-zinc-500" />
            <h2 className="text-sm font-bold text-zinc-900">Advanced Filters</h2>
            {activeFilterCount > 0 && (
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-brand text-[10px] font-bold text-white">
                {activeFilterCount}
              </span>
            )}
          </div>
          <button 
            onClick={() => setIsOpen(false)}
            className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-700 hover:bg-zinc-100 transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-5 space-y-6">
          
          {/* Date Range */}
          <div className="space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-500 flex items-center gap-1.5">
              <Calendar className="h-3.5 w-3.5" /> Date Range
            </h3>
            
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => handleDatePreset('today')}
                className={`py-1.5 px-2 text-xs font-semibold rounded-lg border transition-colors ${datePreset === 'today' ? 'bg-brand/10 border-brand/20 text-brand' : 'bg-white border-zinc-200 text-zinc-600 hover:bg-zinc-50'}`}
              >
                Today
              </button>
              <button
                type="button"
                onClick={() => handleDatePreset('yesterday')}
                className={`py-1.5 px-2 text-xs font-semibold rounded-lg border transition-colors ${datePreset === 'yesterday' ? 'bg-brand/10 border-brand/20 text-brand' : 'bg-white border-zinc-200 text-zinc-600 hover:bg-zinc-50'}`}
              >
                Yesterday
              </button>
              <button
                type="button"
                onClick={() => handleDatePreset('this_week')}
                className={`py-1.5 px-2 text-xs font-semibold rounded-lg border transition-colors ${datePreset === 'this_week' ? 'bg-brand/10 border-brand/20 text-brand' : 'bg-white border-zinc-200 text-zinc-600 hover:bg-zinc-50'}`}
              >
                This Week
              </button>
              <button
                type="button"
                onClick={() => handleDatePreset('this_month')}
                className={`py-1.5 px-2 text-xs font-semibold rounded-lg border transition-colors ${datePreset === 'this_month' ? 'bg-brand/10 border-brand/20 text-brand' : 'bg-white border-zinc-200 text-zinc-600 hover:bg-zinc-50'}`}
              >
                This Month
              </button>
            </div>

            <div className="grid grid-cols-2 gap-2 pt-1">
              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] font-bold text-zinc-500">From</label>
                <input 
                  type="date"
                  value={localFilters.fromDate || ''}
                  onChange={(e) => {
                    setDatePreset('custom');
                    handleChange('fromDate', e.target.value);
                  }}
                  className="w-full rounded-lg border border-zinc-200 bg-zinc-50 px-2 py-1.5 text-xs text-zinc-800 outline-none focus:border-brand"
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] font-bold text-zinc-500">To</label>
                <input 
                  type="date"
                  value={localFilters.toDate || ''}
                  onChange={(e) => {
                    setDatePreset('custom');
                    handleChange('toDate', e.target.value);
                  }}
                  className="w-full rounded-lg border border-zinc-200 bg-zinc-50 px-2 py-1.5 text-xs text-zinc-800 outline-none focus:border-brand"
                />
              </div>
            </div>
          </div>

          <div className="h-px bg-zinc-100" />

          {/* Status Filters */}
          <div className="space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-500 flex items-center gap-1.5">
              <CheckCircle2 className="h-3.5 w-3.5" /> Statuses
            </h3>
            
            <div className="flex flex-col gap-1.5">
              <label className="text-[10px] font-bold text-zinc-500">Valet Status</label>
              <div className="relative">
                <select 
                  value={localFilters.status || ''}
                  onChange={(e) => handleChange('status', e.target.value)}
                  className="w-full appearance-none rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 text-xs text-zinc-800 outline-none focus:border-brand"
                >
                  <option value="">All Statuses</option>
                  <option value="PARKED">Parked</option>
                  <option value="REQUESTED">Requested</option>
                  <option value="BRINGING">Bringing</option>
                  <option value="READY">Ready</option>
                  <option value="DELIVERED">Delivered</option>
                </select>
                <ChevronDown className="absolute right-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-zinc-400 pointer-events-none" />
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-[10px] font-bold text-zinc-500">Booking Status</label>
              <div className="relative">
                <select 
                  value={localFilters.bookingStatus || ''}
                  onChange={(e) => handleChange('bookingStatus', e.target.value)}
                  className="w-full appearance-none rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 text-xs text-zinc-800 outline-none focus:border-brand"
                >
                  <option value="">All</option>
                  <option value="CONFIRMED">Confirmed</option>
                  <option value="CHECKED_IN">Checked In</option>
                  <option value="CHECKED_OUT">Checked Out</option>
                </select>
                <ChevronDown className="absolute right-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-zinc-400 pointer-events-none" />
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-[10px] font-bold text-zinc-500">Payment Status</label>
              <div className="relative">
                <select 
                  value={localFilters.paymentStatus || ''}
                  onChange={(e) => handleChange('paymentStatus', e.target.value)}
                  className="w-full appearance-none rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 text-xs text-zinc-800 outline-none focus:border-brand"
                >
                  <option value="">All</option>
                  <option value="PAID">Paid</option>
                  <option value="PENDING">Pending</option>
                  <option value="REFUNDED">Refunded</option>
                </select>
                <ChevronDown className="absolute right-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-zinc-400 pointer-events-none" />
              </div>
            </div>
          </div>

          <div className="h-px bg-zinc-100" />

          {/* Guest & Vehicle Info */}
          <div className="space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-500 flex items-center gap-1.5">
              <Car className="h-3.5 w-3.5" /> Identity & Vehicle
            </h3>
            
            <div className="flex flex-col gap-1.5">
              <label className="text-[10px] font-bold text-zinc-500">Car Number</label>
              <input 
                type="text"
                placeholder="e.g. KA03..."
                value={localFilters.carNumber || ''}
                onChange={(e) => handleChange('carNumber', e.target.value)}
                className="w-full rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 text-xs text-zinc-800 uppercase outline-none focus:border-brand"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-[10px] font-bold text-zinc-500">Vehicle Type (Brand/Model)</label>
              <input 
                type="text"
                placeholder="e.g. BMW"
                value={localFilters.vehicleType || ''}
                onChange={(e) => handleChange('vehicleType', e.target.value)}
                className="w-full rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 text-xs text-zinc-800 outline-none focus:border-brand"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-[10px] font-bold text-zinc-500">Customer Name / Room No.</label>
              <input 
                type="text"
                placeholder="Search guest..."
                value={localFilters.customerName || ''}
                onChange={(e) => handleChange('customerName', e.target.value)}
                className="w-full rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 text-xs text-zinc-800 outline-none focus:border-brand"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-[10px] font-bold text-zinc-500">Booking ID</label>
              <div className="relative">
                <Hash className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-zinc-400" />
                <input 
                  type="text"
                  placeholder="ID..."
                  value={localFilters.bookingId || ''}
                  onChange={(e) => handleChange('bookingId', e.target.value)}
                  className="w-full rounded-lg border border-zinc-200 bg-zinc-50 pl-8 pr-3 py-2 text-xs text-zinc-800 outline-none focus:border-brand"
                />
              </div>
            </div>
          </div>

          <div className="h-px bg-zinc-100" />

          {/* Operational */}
          <div className="space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-500 flex items-center gap-1.5">
              <Building className="h-3.5 w-3.5" /> Operational
            </h3>

            <div className="flex flex-col gap-1.5">
              <label className="text-[10px] font-bold text-zinc-500">Assigned Valet Manager</label>
              <div className="relative">
                <select 
                  value={localFilters.assignedValet || ''}
                  onChange={(e) => handleChange('assignedValet', e.target.value)}
                  className="w-full appearance-none rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 text-xs text-zinc-800 outline-none focus:border-brand"
                >
                  <option value="">Any Valet</option>
                  {managers?.map((m: any) => (
                    <option key={m._id} value={m._id}>{m.name}</option>
                  ))}
                </select>
                <ChevronDown className="absolute right-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-zinc-400 pointer-events-none" />
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-[10px] font-bold text-zinc-500">Hotel/Property</label>
              <input 
                type="text"
                placeholder="Property Name"
                value={localFilters.property || ''}
                onChange={(e) => handleChange('property', e.target.value)}
                className="w-full rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 text-xs text-zinc-800 outline-none focus:border-brand"
              />
            </div>
          </div>

        </div>

        {/* Footer Actions */}
        <div className="border-t border-zinc-100 p-4 bg-zinc-50 flex gap-3 mt-auto shrink-0">
          <Button 
            variant="outline" 
            onClick={handleReset}
            className="flex-1 flex items-center justify-center gap-2 text-xs font-semibold"
          >
            <RotateCcw className="h-3.5 w-3.5" /> Reset
          </Button>
          <Button 
            onClick={handleApply}
            className="flex-1 bg-[#D4AF37] hover:bg-[#AE963C] text-white flex items-center justify-center gap-2 text-xs font-semibold"
          >
            <CheckCircle2 className="h-3.5 w-3.5" /> Apply Filters
          </Button>
        </div>
      </div>
    </>
  );
}
