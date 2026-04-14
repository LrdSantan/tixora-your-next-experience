export default function Privacy() {
  return (
    <div className="container mx-auto px-4 py-16 max-w-3xl">
      <h1 className="text-3xl font-bold mb-2">Privacy Policy</h1>
      <p className="text-muted-foreground mb-8">Effective date: April 2026</p>

      <section className="prose prose-slate max-w-none space-y-8">
        <div>
          <h2 className="text-xl font-bold mb-3">1. Introduction</h2>
          <p className="leading-relaxed text-muted-foreground">
            Tixora ("we", "our", "us") is committed to protecting your personal information. This Privacy Policy explains how we collect, use, and share your information when you use our platform.
          </p>
        </div>

        <div>
          <h2 className="text-xl font-bold mb-3">2. Information We Collect</h2>
          <p className="leading-relaxed text-muted-foreground mb-3">We collect information that you provides directly to us, including:</p>
          <ul className="list-disc list-inside space-y-2 text-muted-foreground">
            <li>Name and contact information (email address and phone number)</li>
            <li>Payment information (processed securely via Paystack — we do not store your card details)</li>
            <li>Event attendance data and ticket purchase history</li>
          </ul>
        </div>

        <div>
          <h2 className="text-xl font-bold mb-3">3. How We Use Your Information</h2>
          <p className="leading-relaxed text-muted-foreground mb-3">We use the information we collect to:</p>
          <ul className="list-disc list-inside space-y-2 text-muted-foreground">
            <li>Process ticket purchases and manage transactions</li>
            <li>Send order confirmations and digital tickets</li>
            <li>Allow event organizers to verify tickets at the venue</li>
            <li>Improve our platform and provide customer support</li>
          </ul>
        </div>

        <div>
          <h2 className="text-xl font-bold mb-3">4. Data Sharing</h2>
          <p className="leading-relaxed text-muted-foreground">
            We do not sell your personal data. We share your information only with essential third-party services required to operate Tixora, specifically:
          </p>
          <ul className="list-disc list-inside space-y-2 text-muted-foreground mt-3">
            <li><strong>Paystack:</strong> For secure payment processing.</li>
            <li><strong>Resend:</strong> For the delivery of confirmation and support emails.</li>
          </ul>
        </div>

        <div>
          <h2 className="text-xl font-bold mb-3">5. Data Retention</h2>
          <p className="leading-relaxed text-muted-foreground">
            Ticket-related data is retained for 12 months after the event date for verification and accounting purposes, after which it may be archived or deleted.
          </p>
        </div>

        <div>
          <h2 className="text-xl font-bold mb-3">6. Your Rights</h2>
          <p className="leading-relaxed text-muted-foreground">
            You have the right to access the data we hold about you. You can request the deletion of your account and your personal data at any time by contacting our support team.
          </p>
        </div>

        <div>
          <h2 className="text-xl font-bold mb-3">7. Cookies</h2>
          <p className="leading-relaxed text-muted-foreground">
            We use cookies primarily for authentication (keeping you logged in) and basic platform analytics to improve user experience.
          </p>
        </div>

        <div className="pt-8 border-t">
          <h2 className="text-xl font-bold mb-3">Contact Us</h2>
          <p className="leading-relaxed text-muted-foreground">
            If you have any questions about this Privacy Policy, please contact us at <a href="mailto:support@tixora.ng" className="text-primary font-medium hover:underline">support@tixora.ng</a>.
          </p>
        </div>
      </section>
    </div>
  );
}
