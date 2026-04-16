import { CheckCircle } from "lucide-react";
import { Link, useLocation } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { TicketDownloadBlock } from "@/components/TicketDownloadBlock";
import type { TicketVisualModel } from "@/components/TicketVisualCard";
import type { ConfirmationLocationState, ConfirmationTicket } from "@/lib/confirmation-state";

function toModel(
  t: ConfirmationTicket,
  buyerName: string,
  buyerEmail: string,
  purchasedAt: string,
): TicketVisualModel {
  return {
    reference: t.reference,
    ticketCode: t.ticketCode,
    qrToken: t.qrToken,
    eventTitle: t.eventTitle,
    eventDate: t.date,
    eventTime: t.time,
    venue: t.venue,
    city: t.city,
    tierName: t.tierName,
    quantity: t.quantity,
    amountPaidKobo: t.amountPaidKobo,
    buyerName,
    buyerEmail,
    purchasedAt,
  };
}

const ConfirmationPage = () => {
  const location = useLocation();
  const state = location.state as ConfirmationLocationState | null;
  const tickets = state?.tickets?.filter(Boolean) ?? [];
  const buyerName = state?.buyerName?.trim() || "Guest";
  const buyerEmail = state?.buyerEmail?.trim() || "";
  const purchasedAt = state?.purchasedAt || new Date().toISOString();

  if (!tickets || tickets.length === 0) {
    return (
      <div className="container mx-auto max-w-lg px-4 py-16 text-center flex flex-col items-center">
        <h2 className="mb-4 text-2xl font-bold">Nothing to show here</h2>
        <p className="mb-6 text-muted-foreground">This page can only be accessed right after a purchase. Check your tickets below.</p>
        <Button asChild style={{ backgroundColor: "#1A7A4A" }}>
          <Link to="/my-tickets">View My Tickets</Link>
        </Button>
      </div>
    );
  }

  // Group tickets by event title
  const ticketsByEvent = tickets.reduce<Record<string, { eventTitle: string; tickets: (typeof tickets) }>>((acc, t) => {
    const key = t.eventTitle;
    if (!acc[key]) acc[key] = { eventTitle: key, tickets: [] };
    acc[key].tickets.push(t);
    return acc;
  }, {});
  const eventGroups = Object.values(ticketsByEvent);
  const multipleEvents = eventGroups.length > 1;

  return (
    <div className="container mx-auto max-w-3xl px-4 py-12">
      <div className="mb-8 text-center">
        <div className="animate-scale-in mb-4">
          <CheckCircle className="mx-auto h-16 w-16 text-primary" strokeWidth={1.5} />
        </div>
        <h1 className="text-3xl font-extrabold text-primary">Payment successful</h1>
        <p className="mt-2 text-muted-foreground">
          {tickets.length === 1
            ? "Your ticket is confirmed. Save or print it below."
            : `${tickets.length} tickets confirmed. Each has its own unique QR code.`}
        </p>
      </div>

      <div className="space-y-10">
        {eventGroups.map((group) => (
          <div key={group.eventTitle}>
            {multipleEvents && (
              <h2 className="mb-4 text-lg font-bold text-foreground border-b border-border pb-2">
                {group.eventTitle}
              </h2>
            )}
            <div className="space-y-8">
              {group.tickets.map((t, idx) => (
                <div key={t.id} className="relative">
                  {group.tickets.length > 1 && (
                    <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      Ticket {idx + 1} of {group.tickets.length}
                    </p>
                  )}
                  <TicketDownloadBlock model={toModel(t, buyerName, buyerEmail, purchasedAt)} />
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      <div className="mt-10 flex flex-col justify-center gap-3 sm:flex-row">
        <Link to="/my-tickets">
          <Button variant="outline" className="border-primary text-primary w-full sm:w-auto">
            View My Tickets
          </Button>
        </Link>
        <Button asChild variant="ghost" className="w-full sm:w-auto">
          <Link to="/">Browse more events</Link>
        </Button>
      </div>
    </div>
  );
};

export default ConfirmationPage;
