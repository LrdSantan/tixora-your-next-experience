import { Link } from "react-router-dom";
import { Ticket, ArrowRight, Sparkles, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

const ResellMarketplace = () => {
  return (
    <div className="container mx-auto px-4 py-20 min-h-[70vh] flex flex-col items-center justify-center">
      {/* Visual Element */}
      <div className="relative mb-8">
        <div className="absolute -inset-1 rounded-full bg-gradient-to-r from-primary to-green-400 opacity-25 blur-lg animate-pulse" />
        <div className="relative bg-background border border-border rounded-full p-6 shadow-xl">
          <Ticket className="h-16 w-16 text-primary rotate-[-15deg]" />
        </div>
        <Badge className="absolute -top-2 -right-4 bg-primary text-primary-foreground px-3 py-1 font-bold border-2 border-background">
          RESELL 2.0
        </Badge>
      </div>

      {/* Text Content */}
      <div className="text-center max-w-2xl">
        <h1 className="text-4xl md:text-6xl font-black tracking-tight mb-6">
          The Marketplace is <span className="text-primary">Evolving</span>
        </h1>
        
        <p className="text-xl text-muted-foreground mb-10 leading-relaxed">
          We're building a secure, 1-click fan-to-fan resale pool. 
          No scalpers, no fake tickets—just pure experiences. 
        </p>

        {/* Feature Teasers */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12 text-left">
          <div className="p-4 rounded-2xl bg-muted/50 border border-border">
            <div className="flex items-center gap-2 mb-2">
              <Sparkles className="h-4 w-4 text-primary" />
              <span className="font-bold text-sm uppercase tracking-wider">Verified</span>
            </div>
            <p className="text-sm text-muted-foreground">Automatic ownership transfer on payment.</p>
          </div>
          
          <div className="p-4 rounded-2xl bg-muted/50 border border-border">
            <div className="flex items-center gap-2 mb-2">
              <Clock className="h-4 w-4 text-primary" />
              <span className="font-bold text-sm uppercase tracking-wider">Fast</span>
            </div>
            <p className="text-sm text-muted-foreground">Instant QR rotation for new buyers.</p>
          </div>

          <div className="p-4 rounded-2xl bg-muted/50 border border-border">
            <div className="flex items-center gap-2 mb-2">
              <Ticket className="h-4 w-4 text-primary" />
              <span className="font-bold text-sm uppercase tracking-wider">Fair</span>
            </div>
            <p className="text-sm text-muted-foreground">Original price caps to keep fans happy.</p>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <Link to="/">
            <Button size="lg" className="h-14 px-8 text-lg font-bold gap-2">
              Browse Upcoming Events <ArrowRight className="h-5 w-5" />
            </Button>
          </Link>
          <Button variant="outline" size="lg" className="h-14 px-8 text-lg font-bold cursor-default opacity-70">
            Resell Pool Opening Soon
          </Button>
        </div>

        <p className="mt-12 text-sm text-muted-foreground uppercase tracking-[0.2em] font-semibold">
          Tixora · Your Next Experience
        </p>
      </div>
    </div>
  );
};

export default ResellMarketplace;