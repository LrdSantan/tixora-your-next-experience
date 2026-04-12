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

  if (tickets.length === 0) {
    return (
      <div className="container mx-auto max-w-lg px-4 py-16 text-center">
        <p className="mb-6 text-muted-foreground">No ticket details here. Complete a purchase from checkout first.</p>
        <Button asChild className="bg-primary text-primary-foreground">
          <Link to="/">Browse events</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="container mx-auto max-w-3xl px-4 py-12">
      <div className="mb-8 text-center">
        <div className="animate-scale-in mb-4">
          <CheckCircle className="mx-auto h-16 w-16 text-primary" strokeWidth={1.5} />
        </div>
        <h1 className="text-3xl font-extrabold text-primary">Payment successful</h1>
        <p className="mt-2 text-muted-foreground">Your tickets are confirmed. Save or print them below.</p>
      </div>

      <div className="space-y-8">
        {tickets.map((t) => (
          <TicketDownloadBlock key={t.id} model={toModel(t, buyerName, buyerEmail, purchasedAt)} />
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
