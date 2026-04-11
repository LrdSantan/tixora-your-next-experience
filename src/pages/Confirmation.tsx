import { CheckCircle } from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { QRCodeSVG } from "qrcode.react";

const ConfirmationPage = () => {
  const orderId = `TXR-${Date.now().toString(36).toUpperCase()}`;

  return (
    <div className="container mx-auto px-4 py-16 max-w-2xl text-center">
      <div className="animate-scale-in mb-6">
        <CheckCircle className="w-20 h-20 text-primary mx-auto" strokeWidth={1.5} />
      </div>
      <h1 className="text-3xl font-extrabold text-primary mb-2" style={{ animation: "fade-in-up 0.6s ease-out 0.3s forwards", opacity: 0 }}>
        Your tickets are on their way!
      </h1>
      <p className="text-muted-foreground mb-8" style={{ animation: "fade-in-up 0.6s ease-out 0.4s forwards", opacity: 0 }}>
        A confirmation email has been sent to your inbox.
      </p>

      {/* Sample ticket card */}
      <div className="bg-background border border-border rounded-xl overflow-hidden text-left mb-8" style={{ animation: "fade-in-up 0.6s ease-out 0.5s forwards", opacity: 0 }}>
        <div className="bg-primary text-primary-foreground px-6 py-3">
          <p className="font-bold text-sm">TIXORA E-TICKET</p>
        </div>
        <div className="flex flex-col sm:flex-row">
          <div className="flex-1 p-6 border-l-4 border-primary space-y-2">
            <p className="text-xs text-muted-foreground">Event</p>
            <p className="font-bold text-foreground">Sample Event</p>
            <p className="text-xs text-muted-foreground">Date & Venue</p>
            <p className="text-sm text-foreground">TBD · Lagos, Nigeria</p>
            <p className="text-xs text-muted-foreground">Order ID</p>
            <p className="text-sm font-mono text-primary">{orderId}</p>
          </div>
          <div className="p-6 flex items-center justify-center border-t sm:border-t-0 sm:border-l border-border">
            <QRCodeSVG value={orderId} size={100} />
          </div>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row gap-3 justify-center">
        <Button className="bg-primary text-primary-foreground">Download Tickets (PDF)</Button>
        <Link to="/my-tickets">
          <Button variant="outline" className="border-primary text-primary w-full sm:w-auto">View My Tickets</Button>
        </Link>
      </div>
    </div>
  );
};

export default ConfirmationPage;
