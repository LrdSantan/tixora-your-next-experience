declare module "@paystack/inline-js" {
  export interface PaystackInlineTransaction {
    reference?: string;
    trans?: string;
    status?: string;
    message?: string;
  }

  export interface NewTransactionOptions {
    key: string;
    email: string;
    amount: number;
    ref?: string;
    currency?: string;
    channels?: string[];
    metadata?: Record<string, unknown>;
    onSuccess: (transaction: PaystackInlineTransaction) => void;
    onCancel?: () => void;
  }

  export default class PaystackPop {
    newTransaction(options: NewTransactionOptions): void;
  }
}
