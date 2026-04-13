export type ConfirmationTicket = {
  id: string;
  reference: string;
  ticketCode: string;
  amountPaidKobo: number;
  quantity: number;
  eventTitle: string;
  tierName: string;
  venue: string;
  city: string;
  date: string;
  time: string;
};

export type ConfirmationLocationState = {
  tickets: ConfirmationTicket[];
  buyerName: string;
  buyerEmail: string;
  purchasedAt: string;
};
