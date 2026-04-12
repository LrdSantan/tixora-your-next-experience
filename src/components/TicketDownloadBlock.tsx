import { useRef, useState } from "react";
import { TicketVisualCard, type TicketVisualModel } from "@/components/TicketVisualCard";
import { downloadTicketPdfFromElement } from "@/lib/download-ticket-pdf";
import { isEventDatePassed } from "@/lib/ticket-utils";

type Props = {
  model: TicketVisualModel;
  className?: string;
};

export function TicketDownloadBlock({ model, className }: Props) {
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

  return (
    <TicketVisualCard
      ref={ref}
      className={className}
      ticket={model}
      expired={expired}
      download={{ onClick: onDownload, loading, label: "Download PDF" }}
    />
  );
}
