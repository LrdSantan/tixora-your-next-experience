import { useState, useEffect } from "react";
import { Link, useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { ShoppingCart, Menu, X, LogOut, Ticket, Home, Plus, Tag, Users, CalendarDays, ChevronDown } from "lucide-react";
import TixoraLogo from "./TixoraLogo";
import { EventSearchInput } from "@/components/EventSearchInput";
import { useCartStore } from "@/store/cart-store";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
    if (trimmed) navigate(`/search?q=${encodeURIComponent(trimmed)}`);
  };

  const { toggleCart, totalItems } = useCartStore();
  const { user, loading, signOut } = useAuth();
  const count = totalItems();

  const ADMIN_EMAIL = "yusufquadir50@gmail.com";
  const isAdmin = !loading && user?.email === ADMIN_EMAIL;
  const isOrganizer = !loading && Boolean(user);

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

          {/* Desktop: user account dropdown */}
          {loading ? (
            <div className="hidden sm:block h-9 w-24 rounded-md bg-muted animate-pulse" />
          ) : user ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  className="hidden sm:flex items-center gap-1.5 border-border max-w-[180px]"
                >
                  <span className="truncate text-sm font-medium">{displayName}</span>
                  <ChevronDown className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48 border-none shadow-lg">
                {isOrganizer && (
                  <>
                    <DropdownMenuItem asChild>
                      <Link to="/organizer/events" className="cursor-pointer">
                        My Events
                      </Link>
                    </DropdownMenuItem>
                    <DropdownMenuItem asChild>
                      <Link to="/organizer/coupons" className="cursor-pointer">
                        My Coupons
                      </Link>
                    </DropdownMenuItem>
                    <DropdownMenuItem asChild>
                      <Link to="/organizer/team" className="cursor-pointer">
                        My Team
                      </Link>
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                  </>
                )}
                <DropdownMenuItem
                  className="text-destructive focus:text-destructive cursor-pointer"
                  onClick={() => void signOut()}
                >
                  Sign Out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
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

      {/* Mobile menu */}
      {mobileOpen && (
        <div className="md:hidden fixed inset-0 z-[100] bg-background flex flex-col h-screen w-full overflow-y-auto">
          <div className="container mx-auto px-4 h-16 flex items-center justify-between shrink-0">
            <TixoraLogo />
            <button type="button" onClick={() => setMobileOpen(false)} className="p-2">
              <X className="w-6 h-6 text-primary" />
            </button>
          </div>

          <div className="flex-1 flex flex-col px-6 py-4">
            <div className="mb-8">
              <EventSearchInput
                variant="nav"
                value={navSearchValue}
                onChange={onNavSearchChange}
                onEnterWithoutSelection={onNavEnterWithoutSelection}
                onSuggestionNavigate={() => setMobileOpen(false)}
                placeholder={isHome ? "Search events..." : "Search — Enter for home"}
                aria-label="Search events"
              />
            </div>

            <nav className="flex flex-col items-center">
              {!isHome && (
                <Link
                  to="/"
                  onClick={() => setMobileOpen(false)}
                  className="w-full py-5 text-center text-[19px] font-medium border-b border-muted transition-colors hover:text-primary"
                >
                  Home
                </Link>
              )}
              <Link
                to="/my-tickets"
                onClick={() => setMobileOpen(false)}
                className="w-full py-5 text-center text-[19px] font-medium border-b border-muted transition-colors hover:text-primary"
              >
                My Tickets
              </Link>
              <Link
                to="/create-event"
                onClick={() => setMobileOpen(false)}
                className="w-full py-5 text-center text-[19px] font-medium border-b border-muted transition-colors hover:text-primary"
              >
                Create Event
              </Link>
              
              {loading ? (
                <div className="w-full space-y-4 py-4">
                  <div className="h-10 w-3/4 mx-auto rounded-md bg-muted animate-pulse" />
                  <div className="h-10 w-2/3 mx-auto rounded-md bg-muted animate-pulse" />
                </div>
              ) : (
                <>
                  {isOrganizer && (
                    <>
                      <Link
                        to="/organizer/events"
                        onClick={() => setMobileOpen(false)}
                        className="w-full py-5 text-center text-[19px] font-medium border-b border-muted transition-colors hover:text-primary"
                      >
                        My Events
                      </Link>
                      <Link
                        to="/organizer/coupons"
                        onClick={() => setMobileOpen(false)}
                        className="w-full py-5 text-center text-[19px] font-medium border-b border-muted transition-colors hover:text-primary"
                      >
                        My Coupons
                      </Link>
                      <Link
                        to="/organizer/team"
                        onClick={() => setMobileOpen(false)}
                        className="w-full py-5 text-center text-[19px] font-medium border-b border-muted transition-colors hover:text-primary"
                      >
                        My Team
                      </Link>
                    </>
                  )}
                </>
              )}
            </nav>

            <div className="mt-auto pt-8 pb-10">
              {user ? (
                <div className="space-y-6">
                  <p className="text-sm text-center text-muted-foreground font-medium">{user.email}</p>
                  <Button
                    className="w-full h-14 bg-primary text-primary-foreground text-lg rounded-2xl font-bold hover:bg-primary/90 transition-all active:scale-[0.98]"
                    onClick={() => { void signOut(); setMobileOpen(false); }}
                  >
                    Sign Out
                  </Button>
                </div>
              ) : (
                <Link to="/login" onClick={() => setMobileOpen(false)} className="block w-full">
                  <Button className="w-full h-14 bg-primary text-primary-foreground text-lg rounded-2xl font-bold">
                    Sign In
                  </Button>
                </Link>
              )}
            </div>
          </div>
        </div>
      )}
    </nav>
  );
};

export default Navbar;