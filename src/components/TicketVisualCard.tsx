import { forwardRef } from "react";
import { QRCodeSVG } from "qrcode.react";
import { Ticket } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatPrice, formatDate } from "@/lib/mock-data";
import { formatPurchaseDate } from "@/lib/ticket-utils";
import { cn } from "@/lib/utils";

export type TicketVisualModel = {
  reference: string;
  ticketCode?: string;
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
  const BASE_URL = "https://tixora-your-next-experience.vercel.app";
  const qrValue = ticket.ticketCode
    ? `${BASE_URL}/verify/${ticket.ticketCode}`
    : ticket.reference;

  return (
    <div className={cn("rounded-xl border border-border bg-card shadow-sm", className)}>
      <div
        ref={ref}
        className="relative overflow-hidden bg-white p-6 text-neutral-900 md:p-8 print:p-8"
        data-ticket-pdf-root
      >
        {expired && (
          <div className="mb-4 rounded-lg bg-red-600 px-3 py-2 text-center text-sm font-bold tracking-wide text-white">
            Expired — this event date has passed
          </div>
        )}
        {ticket.isUsed && (
          <div className="mb-4 rounded-lg bg-neutral-600 px-3 py-2 text-center text-sm font-bold tracking-wide text-white">
            ✓ Ticket Used{ticket.usedAt ? ` · ${new Date(ticket.usedAt).toLocaleString()}` : ""}
          </div>
        )}

        <div className="flex flex-wrap items-start justify-between gap-4 border-b border-neutral-200 pb-4">
          <div className="flex items-center gap-2">
            <Ticket className="h-8 w-8 shrink-0 rotate-[-30deg] text-[#1A7A4A]" aria-hidden />
            <div>
              <p className="text-lg font-extrabold tracking-tight text-[#1A7A4A]">TIXORA</p>
              <p className="text-[10px] uppercase tracking-widest text-neutral-500">Official e-ticket</p>
            </div>
          </div>
          <span className="inline-flex items-center rounded-full bg-[#1A7A4A]/10 px-3 py-1 text-xs font-bold uppercase tracking-wide text-[#1A7A4A]">
            {ticket.tierName}
          </span>
        </div>

        <div className="mt-5 flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0 flex-1 space-y-4">
            <h2 className="text-2xl font-extrabold leading-tight text-neutral-900 md:text-3xl">{ticket.eventTitle}</h2>

            <dl className="grid gap-2 text-sm">
              <div>
                <dt className="text-xs font-medium uppercase tracking-wide text-neutral-500">When</dt>
                <dd className="font-semibold text-neutral-900">
                  {formatDate(ticket.eventDate)} · {ticket.eventTime}
                </dd>
              </div>
              <div>
                <dt className="text-xs font-medium uppercase tracking-wide text-neutral-500">Where</dt>
                <dd className="font-semibold text-neutral-900">
                  {ticket.venue}, {ticket.city}
                </dd>
              </div>
              <div>
                <dt className="text-xs font-medium uppercase tracking-wide text-neutral-500">Tickets</dt>
                <dd className="font-semibold text-neutral-900">
                  {ticket.quantity} × {ticket.tierName} · {formatPrice(ticket.amountPaidKobo / 100)}
                </dd>
              </div>
              <div>
                <dt className="text-xs font-medium uppercase tracking-wide text-neutral-500">Buyer</dt>
                <dd className="font-semibold text-neutral-900">{ticket.buyerName}</dd>
                <dd className="text-neutral-600">{ticket.buyerEmail}</dd>
              </div>
              <div>
                <dt className="text-xs font-medium uppercase tracking-wide text-neutral-500">Purchased</dt>
                <dd className="font-mono text-sm text-neutral-800">{formatPurchaseDate(ticket.purchasedAt)}</dd>
              </div>
              {ticket.ticketCode && (
                <div>
                  <dt className="text-xs font-medium uppercase tracking-wide text-neutral-500">Ticket code</dt>
                  <dd className="break-all font-mono text-sm font-semibold text-[#1A7A4A]">{ticket.ticketCode}</dd>
                </div>
              )}
              <div>
                <dt className="text-xs font-medium uppercase tracking-wide text-neutral-500">Ticket reference</dt>
                <dd className="break-all font-mono text-sm font-semibold text-[#1A7A4A]">{ticket.reference}</dd>
              </div>
            </dl>

            {download && (
              <div className="pt-2 print:hidden" data-no-pdf>
                <Button
                  type="button"
                  className="bg-[#1A7A4A] text-white hover:bg-[#155a37]"
                  disabled={download.loading}
                  onClick={() => void download.onClick()}
                >
                  {download.loading ? "Preparing PDF…" : (download.label ?? "Download PDF")}
                </Button>
              </div>
            )}
          </div>

          <div className="relative flex shrink-0 flex-col items-center gap-2 lg:w-[140px]">
            <div className="relative rounded-lg border border-neutral-200 bg-white p-3">
              <QRCodeSVG value={qrValue} size={120} level="M" />
              {expired && (
                <div
                  className="pointer-events-none absolute inset-0 flex items-center justify-center overflow-hidden rounded-lg bg-white/40"
                  aria-hidden
                >
                  <span className="rotate-[-32deg] select-none text-center text-base font-black uppercase tracking-[0.25em] text-red-700/95">
                    EXPIRED
                  </span>
                </div>
              )}
            </div>
            <p className="max-w-[9rem] text-center text-[10px] text-neutral-500">
              {ticket.ticketCode ? `Scan to verify: ${ticket.ticketCode}` : `Scan at entry — ref. ${ticket.reference.slice(0, 10)}…`}
            </p>
          </div>
        </div>

        <p className="mt-8 border-t border-neutral-200 pt-4 text-center text-[11px] text-neutral-400">
          Powered by Tixora
        </p>

        {expired && (
          <div
            className="pointer-events-none absolute inset-0 flex items-center justify-center overflow-hidden"
            aria-hidden
          >
            <span className="rotate-[-35deg] select-none text-7xl font-black uppercase tracking-widest text-neutral-900/10">
              EXPIRED
            </span>
          </div>
        )}
      </div>
    </div>
  );
});
