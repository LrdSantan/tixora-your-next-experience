import { useRef, useState, ReactNode } from "react";
import { TicketVisualCard, type TicketVisualModel } from "@/components/TicketVisualCard";
import { downloadTicketPdfFromElement } from "@/lib/download-ticket-pdf";
import { isEventDatePassed } from "@/lib/ticket-utils";
import { Button } from "@/components/ui/button";
import { Download, Loader2 } from "lucide-react";

type Props = {
  model: TicketVisualModel;
  className?: string;
  children?: ReactNode;
};

export function TicketDownloadBlock({ model, className, children }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const [loading, setLoading] = useState(false);
  const expired = isEventDatePassed(model.eventDate);

  const onDownload = async () => {
    if (!ref.current) return;
    setLoading(true);
    try {
      await downloadTicketPdfFromElement(ref.current, `tixora-${model.reference.slice(0, 24)}`);
    } finally {
      setLoading(false);
    }
  };

  const actionButtonClass = "bg-[rgba(255,255,255,0.06)] border-[rgba(255,255,255,0.12)] text-white hover:bg-[rgba(255,255,255,0.1)] transition-colors h-9 px-4 text-xs font-semibold rounded-lg border";

  return (
    <div className={className}>
      <TicketVisualCard
        ref={ref}
        ticket={model}
        expired={expired}
      />
      <div className="mt-4 flex flex-wrap gap-2 justify-end">
        <button
          onClick={onDownload}
          disabled={loading}
          className={actionButtonClass}
        >
          {loading ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin mr-2 inline" />
          ) : (
            <Download className="h-3.5 w-3.5 mr-2 inline" />
          )}
          Download PDF
        </button>
        {children}
      </div>
    </div>
  );
}
