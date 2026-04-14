import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

export default function FAQ() {
  const sections = [
    {
      title: "Buying Tickets",
      items: [
        {
          q: "How do I buy a ticket?",
          a: "Browse events on the home page, select your tickets, fill in your details and pay securely via Paystack."
        },
        {
          q: "What payment methods are accepted?",
          a: "We accept all debit cards, credit cards, and bank transfers via Paystack."
        },
        {
          q: "Will I receive a confirmation?",
          a: "Yes, a confirmation email with your e-ticket and QR code is sent immediately after payment."
        },
        {
          q: "Can I buy tickets for multiple events at once?",
          a: "Yes, you can add tickets from multiple events to your cart and check out in one transaction."
        }
      ]
    },
    {
      title: "At the Event",
      items: [
        {
          q: "How do I use my ticket at the event?",
          a: "Open your ticket on the Tixora app or email, and show the QR code at the door for scanning."
        },
        {
          q: "What if my ticket shows as used?",
          a: "Each QR code can only be scanned once. If you believe your ticket was scanned in error, contact support@tixora.ng"
        }
      ]
    },
    {
      title: "For Organizers",
      items: [
        {
          q: "How do I list an event?",
          a: "Click 'Create Event' in the navbar, fill in your event details and ticket tiers, and your event goes live immediately."
        },
        {
          q: "How do I scan tickets at my event?",
          a: "Use the Tixora verify link on any phone. Log in as the event organizer and scan attendee QR codes to mark them as used."
        },
        {
          q: "Can I create discount codes?",
          a: "Yes, go to My Coupons in your account to create percentage or fixed discount codes for your events."
        },
        {
          q: "When do I receive my payout?",
          a: "Organizer payouts are currently processed manually. Contact support@tixora.ng after your event to arrange payment."
        }
      ]
    },
    {
      title: "Account",
      items: [
        {
          q: "How do I create an account?",
          a: "Click Sign Up on the Tixora homepage and register with your email or Google account."
        },
        {
          q: "How do I delete my account?",
          a: "Email support@tixora.ng with your request and we will process it within 7 days."
        }
      ]
    }
  ];

  return (
    <div className="container mx-auto px-4 py-16 max-w-3xl">
      <div className="text-center mb-12">
        <h1 className="text-3xl font-bold text-foreground mb-4">Help & FAQ</h1>
        <p className="text-muted-foreground">Find answers to commonly asked questions about Tixora.</p>
      </div>

      <div className="space-y-12">
        {sections.map((section, idx) => (
          <div key={idx}>
            <h2 className="text-xl font-bold mb-6 text-primary">{section.title}</h2>
            <Accordion type="single" collapsible className="w-full space-y-4">
              {section.items.map((item, i) => (
                <AccordionItem key={i} value={`${idx}-${i}`} className="bg-card border rounded-xl px-2">
                  <AccordionTrigger className="hover:no-underline py-4 text-left font-semibold">
                    {item.q}
                  </AccordionTrigger>
                  <AccordionContent className="text-muted-foreground pb-4 leading-relaxed">
                    {item.a}
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </div>
        ))}
      </div>

      <div className="mt-20 p-8 bg-surface border border-border rounded-3xl text-center">
        <h3 className="text-lg font-bold mb-2">Still need help?</h3>
        <p className="text-muted-foreground mb-6">Our support team is available 24/7 to assist you.</p>
        <a 
          href="mailto:support@tixora.ng" 
          className="inline-flex h-11 items-center justify-center rounded-xl bg-primary px-8 text-sm font-bold text-white shadow transition-all hover:bg-primary/90 hover:scale-[1.02] active:scale-[0.98]"
        >
          Contact Support
        </a>
      </div>
    </div>
  );
}
