export default function Terms() {
  return (
    <div className="container mx-auto px-4 py-16 max-w-3xl">
      <h1 className="text-3xl font-bold mb-2">Terms of Service</h1>
      <p className="text-muted-foreground mb-8">Effective date: April 2026</p>

      <section className="prose prose-slate max-w-none space-y-8">
        <div>
          <h2 className="text-xl font-bold mb-3">1. Acceptance of Terms</h2>
          <p className="leading-relaxed text-muted-foreground">
            By accessing or using Tixora, you agree to be bound by these Terms of Service. If you do not agree, please do not use our platform.
          </p>
        </div>

        <div>
          <h2 className="text-xl font-bold mb-3">2. Ticket Purchases</h2>
          <p className="leading-relaxed text-muted-foreground">
            All ticket sales are final. Refunds are only issued if an event is cancelled by the organizer. Tixora acts as a ticketing agent and is not responsible for event cancellations, though we will facilitate refunds where possible according to the organizer's instructions.
          </p>
        </div>

        <div>
          <h2 className="text-xl font-bold mb-3">3. Organizer Responsibilities</h2>
          <p className="leading-relaxed text-muted-foreground">
            Event organizers are solely responsible for the accuracy of their event information, delivering the event as described, and handling refund requests for cancelled or significantly modified events.
          </p>
        </div>

        <div>
          <h2 className="text-xl font-bold mb-3">4. Prohibited Conduct</h2>
          <p className="leading-relaxed text-muted-foreground text-sm font-medium mb-3 italic">You agree not to:</p>
          <ul className="list-disc list-inside space-y-2 text-muted-foreground">
            <li>Resell tickets above their original face value.</li>
            <li>Create fraudulent events or list misleading information.</li>
            <li>Use stolen or unauthorized payment information.</li>
            <li>Use the platform for any illegal purpose or activity.</li>
          </ul>
        </div>

        <div>
          <h2 className="text-xl font-bold mb-3">5. Platform Fees</h2>
          <p className="leading-relaxed text-muted-foreground">
            Tixora may charge a service fee on ticket purchases. This fee is non-refundable unless the event is cancelled.
          </p>
        </div>

        <div>
          <h2 className="text-xl font-bold mb-3">6. Limitation of Liability</h2>
          <p className="leading-relaxed text-muted-foreground">
            Tixora is not liable for any losses, injuries, or damages arising from event cancellations, organizer misconduct, or attendance at any event listed on our platform.
          </p>
        </div>

        <div>
          <h2 className="text-xl font-bold mb-3">7. Governing Law</h2>
          <p className="leading-relaxed text-muted-foreground">
            These terms are governed by and construed in accordance with the laws of the Federal Republic of Nigeria.
          </p>
        </div>

        <div className="pt-8 border-t">
          <h2 className="text-xl font-bold mb-3">Questions?</h2>
          <p className="leading-relaxed text-muted-foreground">
            If you have any questions about these terms, please reach out to <a href="mailto:support@tixora.ng" className="text-primary font-medium hover:underline">support@tixora.ng</a>.
          </p>
        </div>
      </section>
    </div>
  );
}
