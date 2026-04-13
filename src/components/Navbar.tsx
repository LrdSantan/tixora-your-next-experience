import { useState, useEffect } from "react";
import { Link, useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { ShoppingCart, Menu, X, LogOut, Ticket, Home, Plus } from "lucide-react";
import TixoraLogo from "./TixoraLogo";
import { EventSearchInput } from "@/components/EventSearchInput";
import { useCartStore } from "@/store/cart-store";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/auth-context";

const Navbar = () => {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [offHomeDraft, setOffHomeDraft] = useState("");
  const location = useLocation();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const isHome = location.pathname === "/";

  const navSearchValue = isHome ? (searchParams.get("q") ?? "") : offHomeDraft;

  useEffect(() => {
    if (!isHome) setOffHomeDraft("");
  }, [isHome]);

  const updateHomeQuery = (value: string) => {
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        if (value) next.set("q", value);
        else next.delete("q");
        return next;
      },
      { replace: true },
    );
  };

  const onNavSearchChange = (value: string) => {
    if (isHome) updateHomeQuery(value);
    else setOffHomeDraft(value);
  };

  const onNavEnterWithoutSelection = () => {
    if (isHome) return;
    const trimmed = offHomeDraft.trim();
    if (trimmed) navigate(`/?q=${encodeURIComponent(trimmed)}`);
  };

  const { toggleCart, totalItems } = useCartStore();
  const { user, loading, signOut } = useAuth();
  const count = totalItems();

  const displayName =
    (user?.user_metadata?.full_name as string | undefined)?.trim() ||
    user?.email?.split("@")[0] ||
    "Account";

  return (
    <nav className="sticky top-0 z-50 bg-background/95 backdrop-blur border-b border-border">
      <div className="container mx-auto px-4 h-16 flex items-center justify-between">
        <TixoraLogo />

        <div className="hidden md:flex w-80">
          <EventSearchInput
            variant="nav"
            value={navSearchValue}
            onChange={onNavSearchChange}
            onEnterWithoutSelection={onNavEnterWithoutSelection}
            placeholder={isHome ? "Search events, venues..." : "Search — press Enter to go home"}
            aria-label="Search events"
          />
        </div>

        <div className="flex items-center gap-3">
          {!isHome && (
            <Link to="/" className="hidden sm:block">
              <Button variant="ghost" size="sm" className="text-foreground gap-1.5">
                <Home className="w-4 h-4" />
                Home
              </Button>
            </Link>
          )}
          <Link to="/my-tickets" className="hidden sm:block">
            <Button variant="ghost" size="sm" className="text-foreground gap-1.5">
              <Ticket className="w-4 h-4" />
              My tickets
            </Button>
          </Link>
          <Link to="/create-event" className="hidden sm:block">
            <Button variant="ghost" size="sm" className="text-foreground gap-1.5">
              <Plus className="w-4 h-4" />
              Create Event
            </Button>
          </Link>
          <button type="button" onClick={toggleCart} className="relative p-2">
            <ShoppingCart className="w-5 h-5 text-foreground" />
            {count > 0 && (
              <span className="absolute -top-0.5 -right-0.5 bg-primary text-primary-foreground text-[10px] font-bold rounded-full w-5 h-5 flex items-center justify-center">
                {count}
              </span>
            )}
          </button>
          {loading ? (
            <div className="hidden sm:block h-9 w-20 rounded-md bg-muted animate-pulse" />
          ) : user ? (
            <div className="hidden sm:flex items-center gap-2">
              <span className="text-sm text-muted-foreground max-w-[140px] truncate" title={user.email ?? ""}>
                {displayName}
              </span>
              <Button variant="outline" size="sm" className="border-border gap-1" onClick={() => signOut()}>
                <LogOut className="w-3.5 h-3.5" />
                Sign out
              </Button>
            </div>
          ) : (
            <Link to="/login" className="hidden sm:block">
              <Button variant="outline" size="sm" className="border-primary text-primary hover:bg-primary hover:text-primary-foreground">
                Sign In
              </Button>
            </Link>
          )}
          <button type="button" onClick={() => setMobileOpen(!mobileOpen)} className="md:hidden p-2">
            {mobileOpen ? <X className="w-5 h-5 text-primary" /> : <Menu className="w-5 h-5 text-primary" />}
          </button>
        </div>
      </div>

      {mobileOpen && (
        <div className="md:hidden border-t border-border bg-background px-4 py-4 space-y-3">
          <EventSearchInput
            variant="nav"
            value={navSearchValue}
            onChange={onNavSearchChange}
            onEnterWithoutSelection={onNavEnterWithoutSelection}
            onSuggestionNavigate={() => setMobileOpen(false)}
            placeholder={isHome ? "Search events..." : "Search — Enter for home"}
            aria-label="Search events"
          />
          {!isHome && (
            <Link to="/" onClick={() => setMobileOpen(false)}>
              <Button variant="outline" className="w-full border-border gap-2">
                <Home className="w-4 h-4" />
                Home
              </Button>
            </Link>
          )}
          <Link to="/my-tickets" onClick={() => setMobileOpen(false)}>
            <Button variant="outline" className="w-full border-border gap-2">
              <Ticket className="w-4 h-4" />
              My tickets
            </Button>
          </Link>
          <Link to="/create-event" onClick={() => setMobileOpen(false)}>
            <Button variant="outline" className="w-full border-border gap-2">
              <Plus className="w-4 h-4" />
              Create Event
            </Button>
          </Link>
          {user ? (
            <>
              <p className="text-sm text-muted-foreground truncate">{user.email}</p>
              <Button className="w-full bg-primary text-primary-foreground" onClick={() => { void signOut(); setMobileOpen(false); }}>
                Sign out
              </Button>
            </>
          ) : (
            <Link to="/login" onClick={() => setMobileOpen(false)}>
              <Button className="w-full bg-primary text-primary-foreground">Sign In</Button>
            </Link>
          )}
        </div>
      )}
    </nav>
  );
};

export default Navbar;