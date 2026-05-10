import React from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

interface TicketVisualCardSkeletonProps {
  className?: string;
}

export const TicketVisualCardSkeleton = React.memo(({ className }: TicketVisualCardSkeletonProps) => {
  return (
    <div className={cn("relative", className)}>
      <div
        className="relative overflow-hidden"
        style={{ backgroundColor: "#111d15", border: "1px solid rgba(26,122,74,0.3)", borderRadius: "16px" }}
      >
        {/* Top section — event banner skeleton */}
        <div className="relative h-[120px] w-full bg-[#1A7A4A]/10 overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-t from-[#111d15] via-transparent to-transparent" />
          <div className="absolute bottom-3 left-5 right-5">
            <Skeleton className="h-6 w-3/4 bg-white/10" />
          </div>
        </div>

        {/* Middle section skeleton */}
        <div className="px-5 pt-4 pb-5 space-y-2">
          <Skeleton className="h-5 w-1/2 bg-white/10" />
          <Skeleton className="h-3 w-1/4 bg-white/5" />
        </div>

        {/* Dashed divider */}
        <div className="relative w-full h-[1px] border-t border-dashed border-white/10" />

        {/* Detail grid skeleton */}
        <div className="px-5 py-5 grid grid-cols-2 gap-y-5 gap-x-4">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="space-y-2">
              <Skeleton className="h-2 w-10 bg-white/5" />
              <Skeleton className="h-4 w-24 bg-white/10" />
            </div>
          ))}
        </div>

        {/* Dashed divider */}
        <div className="relative w-full h-[1px] border-t border-dashed border-white/10" />

        {/* Bottom section skeleton */}
        <div className="px-5 py-7 flex flex-col items-center">
          <Skeleton className="h-[200px] w-[200px] rounded-xl bg-white/10 mb-3" />
          <Skeleton className="h-2 w-32 bg-white/5" />
        </div>
      </div>
      
      {/* Action buttons skeleton below */}
      <div className="mt-4 flex gap-2 justify-end">
        <Skeleton className="h-9 w-24 rounded-lg bg-white/5" />
        <Skeleton className="h-9 w-24 rounded-lg bg-white/5" />
      </div>
    </div>
  );
});

TicketVisualCardSkeleton.displayName = "TicketVisualCardSkeleton";
