import React from "react";
import { Skeleton } from "@/components/ui/skeleton";

export const EventCardSkeleton = React.memo(() => {
  return (
    <div className="bg-[#0F1612] rounded-[16px] overflow-hidden border border-white/5 h-full flex flex-col">
      {/* Image Area */}
      <Skeleton className="aspect-[16/9] w-full rounded-none bg-white/5" />
      
      <div className="p-5 flex flex-col flex-1">
        {/* Category Pill */}
        <Skeleton className="h-[20px] w-[60px] rounded-full bg-white/10" />
        
        {/* Title: 2 lines */}
        <div className="mt-4 min-h-[2.5rem] flex flex-col gap-2">
          <Skeleton className="h-4 w-full bg-white/10" />
          <Skeleton className="h-4 w-3/4 bg-white/10" />
        </div>
        
        {/* Date/Venue Rows */}
        <div className="space-y-3 mt-4">
          <div className="flex items-center gap-2">
            <Skeleton className="w-3.5 h-3.5 rounded-full bg-white/5" />
            <Skeleton className="h-3 w-[120px] bg-white/5" />
          </div>
          <div className="flex items-center gap-2">
            <Skeleton className="w-3.5 h-3.5 rounded-full bg-white/5" />
            <Skeleton className="h-3 w-[160px] bg-white/5" />
          </div>
        </div>
        
        {/* Bottom Price/Button Area */}
        <div className="flex items-center justify-between pt-5 mt-auto border-t border-white/5">
          <Skeleton className="h-5 w-[80px] bg-white/10" />
          <Skeleton className="h-9 w-[100px] rounded-full bg-white/5" />
        </div>
      </div>
    </div>
  );
});

EventCardSkeleton.displayName = "EventCardSkeleton";
