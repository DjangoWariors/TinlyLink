import { clsx } from 'clsx';

interface SkeletonProps {
  className?: string;
  width?: string | number;
  height?: string | number;
  rounded?: 'none' | 'sm' | 'md' | 'lg' | 'full';
}

export function Skeleton({ 
  className, 
  width, 
  height, 
  rounded = 'md' 
}: SkeletonProps) {
  const roundedClass = {
    none: 'rounded-none',
    sm: 'rounded-sm',
    md: 'rounded-md',
    lg: 'rounded-lg',
    full: 'rounded-full',
  };

  return (
    <div
      className={clsx(
        'animate-pulse bg-gray-200',
        roundedClass[rounded],
        className
      )}
      style={{ width, height }}
    />
  );
}

export function SkeletonText({ 
  lines = 1, 
  className 
}: { 
  lines?: number; 
  className?: string;
}) {
  return (
    <div className={clsx('space-y-2', className)}>
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton
          key={i}
          height={16}
          className={i === lines - 1 && lines > 1 ? 'w-3/4' : 'w-full'}
        />
      ))}
    </div>
  );
}

export function SkeletonCard() {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5">
      <div className="flex items-start gap-4">
        <Skeleton width={48} height={48} rounded="lg" />
        <div className="flex-1">
          <Skeleton height={20} className="w-1/3 mb-2" />
          <Skeleton height={16} className="w-2/3" />
        </div>
      </div>
    </div>
  );
}

export function SkeletonTable({ rows = 5 }: { rows?: number }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      {/* Header */}
      <div className="px-5 py-4 border-b border-gray-200 flex gap-4">
        <Skeleton height={16} className="w-1/4" />
        <Skeleton height={16} className="w-1/4" />
        <Skeleton height={16} className="w-1/6" />
        <Skeleton height={16} className="w-1/6" />
      </div>
      {/* Rows */}
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="px-5 py-4 border-b border-gray-100 flex gap-4">
          <Skeleton height={16} className="w-1/4" />
          <Skeleton height={16} className="w-1/4" />
          <Skeleton height={16} className="w-1/6" />
          <Skeleton height={16} className="w-1/6" />
        </div>
      ))}
    </div>
  );
}

export function SkeletonStatCard() {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5">
      <div className="flex items-center justify-between mb-3">
        <Skeleton height={14} className="w-20" />
        <Skeleton width={32} height={32} rounded="lg" />
      </div>
      <Skeleton height={32} className="w-24 mb-2" />
      <Skeleton height={14} className="w-16" />
    </div>
  );
}

export function SkeletonChart() {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5">
      <div className="flex items-center justify-between mb-6">
        <Skeleton height={20} className="w-32" />
        <div className="flex gap-2">
          <Skeleton height={32} className="w-20" rounded="lg" />
          <Skeleton height={32} className="w-20" rounded="lg" />
        </div>
      </div>
      <div className="h-64 flex items-end gap-2">
        {Array.from({ length: 12 }).map((_, i) => (
          <Skeleton
            key={i}
            className="flex-1"
            height={`${Math.random() * 60 + 20}%`}
            rounded="sm"
          />
        ))}
      </div>
    </div>
  );
}

export function SkeletonLinkRow() {
  return (
    <tr className="animate-pulse">
      <td className="px-3 sm:px-4 py-3 w-10 sm:w-12">
        <Skeleton width={16} height={16} rounded="sm" />
      </td>
      <td className="px-3 sm:px-4 py-3">
        <div className="space-y-1.5">
          <Skeleton height={16} className="w-24 sm:w-32" />
          <Skeleton height={12} className="w-20 sm:w-24" />
        </div>
      </td>
      <td className="px-3 sm:px-4 py-3 hidden md:table-cell">
        <Skeleton height={14} className="w-48" />
      </td>
      <td className="px-3 sm:px-4 py-3 text-center w-20 sm:w-24">
        <Skeleton height={16} className="w-10 sm:w-12 mx-auto" />
      </td>
      <td className="px-3 sm:px-4 py-3 text-center hidden sm:table-cell w-24">
        <Skeleton height={22} className="w-14 mx-auto" rounded="full" />
      </td>
      <td className="px-3 sm:px-4 py-3 w-12 sm:w-16">
        <Skeleton width={24} height={24} rounded="md" className="ml-auto" />
      </td>
    </tr>
  );
}

export function SkeletonDashboard() {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <Skeleton height={32} className="w-48 mb-2" />
          <Skeleton height={16} className="w-64" />
        </div>
        <Skeleton height={40} className="w-32" rounded="lg" />
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <SkeletonStatCard />
        <SkeletonStatCard />
        <SkeletonStatCard />
        <SkeletonStatCard />
      </div>

      {/* Chart */}
      <SkeletonChart />

      {/* Table */}
      <SkeletonTable rows={5} />
    </div>
  );
}
