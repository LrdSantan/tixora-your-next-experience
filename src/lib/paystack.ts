import PaystackPop from "@paystack/inline-js";

/** Stored tier prices are whole Naira; Paystack amounts are in kobo. */
export function nairaToKobo(naira: number): number {
  return Math.round(naira * 100);
}

export function generatePaymentReference(): string {
  return `tix_${crypto.randomUUID().replace(/-/g, "")}`;
}

export function openPaystackInline(options: {
  publicKey: string;
  email: string;
  amountKobo: number;
  reference: string;
  metadata?: any;
  onSuccess: (reference: string) => void;
  onCancel?: () => void;
}): void {
  const popup = new PaystackPop();
  popup.newTransaction({
    key: options.publicKey,
    email: options.email,
    amount: options.amountKobo,
    ref: options.reference,
    currency: "NGN",
    metadata: options.metadata,
    onSuccess: (transaction) => {
      options.onSuccess(transaction.reference ?? options.reference);
    },
    onCancel: options.onCancel,
  });
}
