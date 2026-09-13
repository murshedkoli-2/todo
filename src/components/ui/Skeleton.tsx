import React from "react";

interface SkeletonProps extends React.HTMLAttributes<HTMLDivElement> {
  className?: string;
}

export function Skeleton({ className = "", ...props }: SkeletonProps) {
  return (
    <div
      className={`skeleton relative overflow-hidden bg-sunken animate-pulse ${className}`}
      {...props}
    />
  );
}

export function CardSkeleton() {
  return (
    <div className="card-tile !p-0 overflow-hidden border border-line">
      {/* Cover Skeleton */}
      <Skeleton className="h-32 w-full rounded-none" />

      {/* Header bar */}
      <div className="flex items-center gap-2 px-4 h-11 border-b border-line bg-sunken/40">
        <Skeleton className="w-2 h-2 rounded-full" />
        <Skeleton className="w-16 h-3 rounded" />
        <div className="flex-1" />
        <Skeleton className="w-6 h-6 rounded-md" />
      </div>

      {/* Content */}
      <div className="p-4 sm:p-5 flex flex-col gap-3">
        <Skeleton className="w-3/4 h-5 rounded" />
        <Skeleton className="w-1/2 h-3.5 rounded" />

        {/* Chips */}
        <div className="flex gap-2 mt-1">
          <Skeleton className="w-16 h-6 rounded-full" />
          <Skeleton className="w-20 h-6 rounded-full" />
        </div>

        <div className="pt-3 border-t border-line flex items-center justify-between mt-2">
          <Skeleton className="w-24 h-4 rounded" />
          <Skeleton className="w-8 h-8 rounded-full" />
        </div>
      </div>
    </div>
  );
}

export function RowSkeleton() {
  return (
    <div className="well px-4 py-3 flex items-center justify-between gap-3 border-b border-line">
      <div className="flex items-center gap-3 min-w-0 flex-1">
        <Skeleton className="w-5 h-5 rounded-md flex-shrink-0" />
        <div className="flex flex-col gap-1.5 flex-1 min-w-0">
          <Skeleton className="w-48 h-4 rounded" />
          <Skeleton className="w-28 h-3 rounded" />
        </div>
      </div>
      <div className="flex items-center gap-3 flex-shrink-0">
        <Skeleton className="w-20 h-5 rounded-full" />
        <Skeleton className="w-16 h-4 rounded" />
      </div>
    </div>
  );
}

export default Skeleton;
