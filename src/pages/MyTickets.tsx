import { Ticket } from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";

const MyTicketsPage = () => {
  // Mock — no real auth yet
  const isLoggedIn = false;

  if (!isLoggedIn) {
    return (
      <div className="container mx-auto px-4 py-20 text-center">
        <Ticket className="w-16 h-16 text-primary mx-auto mb-4 rotate-[-30deg]" />
        <h1 className="text-2xl font-bold text-foreground mb-2">Sign in to view your tickets</h1>
        <p className="text-muted-foreground mb-6">You need to be logged in to see your booked tickets.</p>
        <Link to="/login">
          <Button className="bg-primary text-primary-foreground">Sign In</Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold text-foreground mb-6">My Tickets</h1>
      <p className="text-muted-foreground">No tickets yet. Browse events to get started!</p>
    </div>
  );
};

export default MyTicketsPage;
