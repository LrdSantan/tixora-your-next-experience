import { forwardRef } from "react";
import { QRCodeSVG } from "qrcode.react";
import { Ticket } from "lucide-react";
import { formatPrice, formatDate } from "@/lib/mock-data";
import { formatPurchaseDate } from "@/lib/ticket-utils";
import { cn } from "@/lib/utils";

export type TicketVisualModel = {
  reference: string;
  ticketCode?: string;
  qrToken?: string;
  eventTitle: string;
  eventDate: string;
  eventTime: string;
  venue: string;
  city: string;
  tierName: string;
  quantity: number;
  amountPaidKobo: number;
  buyerName: string;
  buyerEmail: string;
  purchasedAt: string;
  isUsed?: boolean;
  usedAt?: string | null;
  coverImageUrl?: string;
};

type TicketVisualCardProps = {
  ticket: TicketVisualModel;
  expired: boolean;
  download?: {
    onClick: () => void | Promise<void>;
    loading?: boolean;
    label?: string;
  };
  className?: string;
};

export const TicketVisualCard = forwardRef<HTMLDivElement, TicketVisualCardProps>(function TicketVisualCard(
  { ticket, expired, download, className },
  ref,
) {
  const tokenToUse = ticket.qrToken || ticket.ticketCode || ticket.reference;
  const qrValue = `https://tixoraafrica.com.ng/verify/${tokenToUse}`;

  return (
    <div className={cn("relative", className)}>
      <div
        ref={ref}
        className="relative overflow-hidden font-sans select-none"
        style={{ backgroundColor: "#111d15", border: "1px solid rgba(26,122,74,0.3)", borderRadius: "16px" }}
        data-ticket-pdf-root
      >
        {/* Top section — event banner */}
        <div className="relative h-[120px] w-full bg-[#1A7A4A]/20 overflow-hidden">
          {ticket.coverImageUrl && (
            <img 
              src={ticket.coverImageUrl} 
              alt={ticket.eventTitle} 
              className="absolute inset-0 w-full h-full object-cover" 
            />
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-[#111d15] via-[#111d15]/40 to-transparent" />
          <div className="absolute bottom-3 left-5 right-5">
            <h2 className="text-white font-bold text-lg leading-tight truncate drop-shadow-sm">
              {ticket.eventTitle}
            </h2>
          </div>
        </div>

        {/* Middle section — ticket header */}
        <div className="px-5 pt-4 pb-5">
          <h3 className="text-white font-bold text-[16px] leading-tight">{ticket.eventTitle}</h3>
          <p className="text-[#2ECC71] text-[12px] font-semibold mt-1 tracking-wide">{ticket.tierName}</p>
        </div>

        {/* Dashed divider with notches using pseudo-elements */}
        <div className="relative w-full h-[1px] border-t border-dashed border-white/15 
          before:content-[''] before:absolute before:left-0 before:top-1/2 before:-translate-y-1/2 before:w-[14px] before:h-[14px] before:rounded-full before:-translate-x-1/2 before:bg-[#080C0A] before:border-r before:border-[rgba(26,122,74,0.3)]
          after:content-[''] after:absolute after:right-0 after:top-1/2 after:-translate-y-1/2 after:w-[14px] after:h-[14px] after:rounded-full after:translate-x-1/2 after:bg-[#080C0A] after:border-l after:border-[rgba(26,122,74,0.3)]" />

        {/* Detail grid — two columns */}
        <div className="px-5 py-5 grid grid-cols-2 gap-y-5 gap-x-4">
          <div>
            <div className="text-[9px] uppercase tracking-[0.2em] font-bold text-white/40">NAME</div>
            <div className="text-white text-[12px] font-semibold mt-1 truncate">{ticket.buyerName}</div>
          </div>
          <div>
            <div className="text-[9px] uppercase tracking-[0.2em] font-bold text-white/40">LOCATION</div>
            <div className="text-white text-[12px] font-semibold mt-1 truncate">{ticket.venue}{ticket.city ? `, ${ticket.city}` : ""}</div>
          </div>
          <div>
            <div className="text-[9px] uppercase tracking-[0.2em] font-bold text-white/40">DATE</div>
            <div className="text-white text-[12px] font-semibold mt-1">{formatDate(ticket.eventDate)}</div>
          </div>
          <div>
            <div className="text-[9px] uppercase tracking-[0.2em] font-bold text-white/40">TIME</div>
            <div className="text-white text-[12px] font-semibold mt-1">{ticket.eventTime}</div>
          </div>
          <div>
            <div className="text-[9px] uppercase tracking-[0.2em] font-bold text-white/40">TICKET TYPE</div>
            <div className="text-white text-[12px] font-semibold mt-1 truncate">{ticket.tierName}</div>
          </div>
          <div>
            <div className="text-[9px] uppercase tracking-[0.2em] font-bold text-white/40">STATUS</div>
            <div className="text-white text-[12px] font-semibold mt-1">
              {ticket.isUsed ? (
                <span className="text-white/40">USED</span>
              ) : expired ? (
                <span className="text-red-400">EXPIRED</span>
              ) : (
                <span className="text-[#2ECC71]">VALID</span>
              )}
            </div>
          </div>
        </div>

        {/* Dashed border top above QR section */}
        <div className="relative w-full h-[1px] border-t border-dashed border-white/15 
          before:content-[''] before:absolute before:left-0 before:top-1/2 before:-translate-y-1/2 before:w-[14px] before:h-[14px] before:rounded-full before:-translate-x-1/2 before:bg-[#080C0A] before:border-r before:border-[rgba(26,122,74,0.3)]
          after:content-[''] after:absolute after:right-0 after:top-1/2 after:-translate-y-1/2 after:w-[14px] after:h-[14px] after:rounded-full after:translate-x-1/2 after:bg-[#080C0A] after:border-l after:border-[rgba(26,122,74,0.3)]" />

        {/* Bottom section — QR code */}
        <div className="px-5 py-7 flex flex-col items-center">
          <div className="bg-white p-3 rounded-xl mb-3">
            <QRCodeSVG 
              value={qrValue} 
              size={200} 
              level="H" 
              includeMargin={false}
              className="w-full h-full max-w-[200px] max-h-[200px]"
            />
          </div>
          <p className="text-[10px] uppercase tracking-wider font-medium text-white/35">
            Scan this QR code at entrance
          </p>
        </div>
      </div>
    </div>
  );
});

