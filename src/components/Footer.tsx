import { Ticket } from "lucide-react";
import { Link } from "react-router-dom";
import TixoraLogo from "./TixoraLogo";

const Footer = () => (
  <footer className="bg-background border-t border-border">
    <div className="container mx-auto px-4 py-12">
      <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
        <div className="space-y-3">
          <TixoraLogo />
          <p className="text-sm text-muted-foreground">Your go-to platform for discovering and booking the best events in Nigeria.</p>
        </div>
        <div>
          <h4 className="font-semibold text-foreground mb-3">Explore</h4>
          <ul className="space-y-2 text-sm">
            {["Concerts", "Sports", "Comedy", "Festivals"].map((c) => (
              <li key={c}><Link to="/" className="text-muted-foreground hover:text-primary transition-colors">{c}</Link></li>
            ))}
          </ul>
        </div>
        <div>
          <h4 className="font-semibold text-foreground mb-3">Company</h4>
          <ul className="space-y-2 text-sm">
            {["About Us", "Contact", "Careers", "Press"].map((c) => (
              <li key={c}><a href="#" className="text-muted-foreground hover:text-primary transition-colors">{c}</a></li>
            ))}
          </ul>
        </div>
        <div>
          <h4 className="font-semibold text-foreground mb-3">Support</h4>
          <ul className="space-y-2 text-sm">
            {["Help Centre", "Privacy Policy", "Terms of Service", "Refund Policy"].map((c) => (
              <li key={c}><a href="#" className="text-muted-foreground hover:text-primary transition-colors">{c}</a></li>
            ))}
          </ul>
        </div>
      </div>
      <div className="mt-10 pt-6 border-t border-border text-center text-sm text-muted-foreground">
        © {new Date().getFullYear()} TIXORA. All rights reserved.
      </div>
    </div>
  </footer>
);

export default Footer;
