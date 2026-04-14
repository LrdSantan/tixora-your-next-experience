import React from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

interface TicketVisualCardSkeletonProps {
  className?: string;
}

export const TicketVisualCardSkeleton = React.memo(({ className }: TicketVisualCardSkeletonProps) => {
  return (
    <div className={cn("rounded-xl border border-border bg-card shadow-sm overflow-hidden", className)}>
      <div className="relative bg-white p-6 md:p-8">
        
        {/* Header */}
        <div className="flex flex-wrap items-start justify-between gap-4 border-b border-neutral-200 pb-4">
          <div className="flex items-center gap-2">
            <Skeleton className="h-8 w-8 rounded-full" />
            <div className="space-y-1">
              <Skeleton className="h-5 w-20" />
              <Skeleton className="h-3 w-24" />
            </div>
          </div>
          <Skeleton className="h-6 w-16 rounded-full" />
        </div>

        {/* Content Body */}
        <div className="mt-5 flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0 flex-1 space-y-4">
            <Skeleton className="h-8 w-3/4 md:h-9" />

            <div className="grid gap-4 mt-6">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="space-y-1.5">
                  <Skeleton className="h-3 w-16" />
                  <Skeleton className="h-4 w-3/4 max-w-[200px]" />
                </div>
              ))}
            </div>
            
            <div className="pt-4">
              <Skeleton className="h-10 w-[140px] rounded-md" />
            </div>
          </div>

          {/* QR Code section */}
          <div className="relative flex shrink-0 flex-col items-center gap-2 lg:w-[140px]">
            <Skeleton className="h-[146px] w-[146px] rounded-lg" />
            <Skeleton className="h-3 w-24 mt-2" />
          </div>
        </div>

        {/* Footer */}
        <div className="mt-8 border-t border-neutral-200 pt-4 flex justify-center">
          <Skeleton className="h-3 w-32" />
        </div>

      </div>
    </div>
  );
});

TicketVisualCardSkeleton.displayName = "TicketVisualCardSkeleton";
