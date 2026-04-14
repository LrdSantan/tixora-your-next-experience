import { Ticket } from "lucide-react";
import { Link } from "react-router-dom";
import TixoraLogo from "./TixoraLogo";

const Footer = () => (
  <footer className="bg-background border-t border-border">
    <div className="container mx-auto px-4 py-12">
      <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
        <div className="space-y-4">
          <TixoraLogo />
          <p className="text-sm text-muted-foreground leading-relaxed">
            Tixora is Nigeria's modern event ticketing platform, built to make every event experience seamless — from discovery to the door.
          </p>
        </div>
        <div>
          <h4 className="font-bold text-foreground mb-4">Explore</h4>
          <ul className="space-y-3 text-sm">
            <li><Link to="/search?q=concerts" className="text-muted-foreground hover:text-primary transition-colors">Concerts</Link></li>
            <li><Link to="/search?q=sports" className="text-muted-foreground hover:text-primary transition-colors">Sports</Link></li>
            <li><Link to="/search?q=comedy" className="text-muted-foreground hover:text-primary transition-colors">Comedy</Link></li>
            <li><Link to="/search?q=festivals" className="text-muted-foreground hover:text-primary transition-colors">Festivals</Link></li>
            <li><Link to="/blog" className="text-muted-foreground hover:text-primary transition-colors">Blog</Link></li>
          </ul>
        </div>
        <div>
          <h4 className="font-bold text-foreground mb-4">Company</h4>
          <ul className="space-y-3 text-sm">
            <li><Link to="/about" className="text-muted-foreground hover:text-primary transition-colors">About Us</Link></li>
            <li><Link to="/contact" className="text-muted-foreground hover:text-primary transition-colors">Contact</Link></li>
          </ul>
        </div>
        <div>
          <h4 className="font-bold text-foreground mb-4">Support</h4>
          <ul className="space-y-3 text-sm">
            <li><Link to="/faq" className="text-muted-foreground hover:text-primary transition-colors">Help Centre</Link></li>
            <li><Link to="/privacy" className="text-muted-foreground hover:text-primary transition-colors">Privacy Policy</Link></li>
            <li><Link to="/terms" className="text-muted-foreground hover:text-primary transition-colors">Terms of Service</Link></li>
          </ul>
        </div>
      </div>
      <div className="mt-16 pt-8 border-t border-border flex flex-col md:flex-row justify-between items-center gap-4 text-xs text-muted-foreground">
        <p>© {new Date().getFullYear()} TIXORA TECHNOLOGY. All rights reserved.</p>
        <p>Built with ❤️ for the Nigerian Event Community.</p>
      </div>
    </div>
  </footer>
);

export default Footer;
