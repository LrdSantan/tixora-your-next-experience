import { Ticket } from "lucide-react";
import { Link } from "react-router-dom";
import TixoraLogo from "./TixoraLogo";

const Footer = () => (
  <footer className="bg-background border-t border-border">
    <div className="container mx-auto px-4 py-6">
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 md:gap-8">
        <div className="space-y-2 md:space-y-4">
          <div className="scale-90 md:scale-100 origin-left">
            <TixoraLogo />
          </div>
          <p className="text-[12px] md:text-sm text-muted-foreground leading-relaxed truncate md:whitespace-normal max-w-[280px]">
            Tixora is Nigeria's modern event ticketing platform, built to make every event experience seamless.
          </p>
        </div>
        
        <div className="grid grid-cols-3 md:col-span-3 gap-4 md:gap-8">
          <div>
            <h4 className="font-bold text-foreground text-[13px] md:text-base mb-2 md:mb-4">Explore</h4>
            <ul className="space-y-2 text-[12px] md:text-sm">
              <li><Link to="/search?q=concerts" className="text-muted-foreground hover:text-primary transition-colors">Concerts</Link></li>
              <li><Link to="/search?q=sports" className="text-muted-foreground hover:text-primary transition-colors">Sports</Link></li>
              <li><Link to="/search?q=comedy" className="text-muted-foreground hover:text-primary transition-colors">Comedy</Link></li>
              <li><Link to="/search?q=festivals" className="text-muted-foreground hover:text-primary transition-colors">Festivals</Link></li>
            </ul>
          </div>
          <div>
            <h4 className="font-bold text-foreground text-[13px] md:text-base mb-2 md:mb-4">Company</h4>
            <ul className="space-y-2 text-[12px] md:text-sm">
              <li><Link to="/about" className="text-muted-foreground hover:text-primary transition-colors">About Us</Link></li>
              <li><Link to="/contact" className="text-muted-foreground hover:text-primary transition-colors">Contact</Link></li>
            </ul>
          </div>
          <div>
            <h4 className="font-bold text-foreground text-[13px] md:text-base mb-2 md:mb-4">Support</h4>
            <ul className="space-y-2 text-[12px] md:text-sm">
              <li><Link to="/faq" className="text-muted-foreground hover:text-primary transition-colors">Help</Link></li>
              <li><Link to="/privacy" className="text-muted-foreground hover:text-primary transition-colors">Privacy</Link></li>
              <li><Link to="/terms" className="text-muted-foreground hover:text-primary transition-colors">Terms</Link></li>
            </ul>
          </div>
        </div>
      </div>
      <div className="mt-8 pt-6 border-t border-border text-center">
        <p className="text-[10px] text-muted-foreground uppercase tracking-widest">
          © {new Date().getFullYear()} TIXORA TECHNOLOGY. All rights reserved.
        </p>
      </div>
    </div>
  </footer>
);

export default Footer;
