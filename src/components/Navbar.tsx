import { useState } from "react";
import { Link } from "react-router-dom";
import { ShoppingCart, Menu, X, Search } from "lucide-react";
import TixoraLogo from "./TixoraLogo";
import { useCartStore } from "@/store/cart-store";
import { Button } from "@/components/ui/button";

const Navbar = () => {
  const [mobileOpen, setMobileOpen] = useState(false);
  const { toggleCart, totalItems } = useCartStore();
  const count = totalItems();

  return (
    <nav className="sticky top-0 z-50 bg-background/95 backdrop-blur border-b border-border">
      <div className="container mx-auto px-4 h-16 flex items-center justify-between">
        <TixoraLogo />

        {/* Center search - desktop */}
        <div className="hidden md:flex items-center bg-muted rounded-full px-4 py-2 w-80">
          <Search className="w-4 h-4 text-muted-foreground mr-2" />
          <input
            type="text"
            placeholder="Search events, venues..."
            className="bg-transparent text-sm outline-none w-full text-foreground placeholder:text-muted-foreground"
          />
        </div>

        {/* Right side */}
        <div className="flex items-center gap-3">
          <button onClick={toggleCart} className="relative p-2">
            <ShoppingCart className="w-5 h-5 text-foreground" />
            {count > 0 && (
              <span className="absolute -top-0.5 -right-0.5 bg-primary text-primary-foreground text-[10px] font-bold rounded-full w-5 h-5 flex items-center justify-center">
                {count}
              </span>
            )}
          </button>
          <Link to="/login" className="hidden sm:block">
            <Button variant="outline" size="sm" className="border-primary text-primary hover:bg-primary hover:text-primary-foreground">
              Sign In
            </Button>
          </Link>
          <button onClick={() => setMobileOpen(!mobileOpen)} className="md:hidden p-2">
            {mobileOpen ? <X className="w-5 h-5 text-primary" /> : <Menu className="w-5 h-5 text-primary" />}
          </button>
        </div>
      </div>

      {/* Mobile menu */}
      {mobileOpen && (
        <div className="md:hidden border-t border-border bg-background px-4 py-4 space-y-3">
          <div className="flex items-center bg-muted rounded-full px-4 py-2">
            <Search className="w-4 h-4 text-muted-foreground mr-2" />
            <input
              type="text"
              placeholder="Search events..."
              className="bg-transparent text-sm outline-none w-full text-foreground placeholder:text-muted-foreground"
            />
          </div>
          <Link to="/login" onClick={() => setMobileOpen(false)}>
            <Button className="w-full bg-primary text-primary-foreground">Sign In</Button>
          </Link>
        </div>
      )}
    </nav>
  );
};

export default Navbar;
