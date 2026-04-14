import React from "react";
import { Skeleton } from "@/components/ui/skeleton";

export const EventCardSkeleton = React.memo(() => {
  return (
    <div className="bg-card rounded-xl overflow-hidden border border-border h-full flex flex-col">
      {/* Image Area */}
      <Skeleton className="aspect-[16/10] w-full rounded-none" />
      
      <div className="p-4 flex flex-col flex-1">
        {/* Category Pill */}
        <Skeleton className="h-[22px] w-[60px] rounded-full" />
        
        {/* Title: 2 lines */}
        <div className="mt-2 min-h-[2.5rem] flex flex-col gap-1">
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-3/4" />
        </div>
        
        {/* Date Row */}
        <div className="flex items-center gap-1.5 mt-2">
          <Skeleton className="w-3.5 h-3.5 rounded-full" />
          <Skeleton className="h-3 w-[120px]" />
        </div>
        
        {/* Venue Row */}
        <div className="flex items-center gap-1.5 mt-1">
          <Skeleton className="w-3.5 h-3.5 rounded-full" />
          <Skeleton className="h-3 w-[160px]" />
        </div>
        
        {/* Bottom Price/Button Area */}
        <div className="flex items-center justify-between pt-3 mt-auto border-t border-border">
          <Skeleton className="h-4 w-[80px]" />
          <Skeleton className="h-8 w-[90px] rounded-md" />
        </div>
      </div>
    </div>
  );
});

EventCardSkeleton.displayName = "EventCardSkeleton";
