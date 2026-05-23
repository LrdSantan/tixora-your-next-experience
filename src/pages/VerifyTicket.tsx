import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import TixoraLogo from "@/components/TixoraLogo";

export default function VerifyTicketPage() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-[#080C0A] text-white p-8">
      <div className="max-w-md w-full text-center">
        <TixoraLogo className="mx-auto mb-8 w-24 h-24" />
        <h1 className="text-2xl md:text-3xl font-bold mb-4 text-[#2ECC71]">
          Ticket scanning is handled securely
        </h1>
        <p className="text-base md:text-lg text-[#1A7A4A] mb-6">
          This ticket can only be verified using the official Tixora scanner. If you're an event organizer, please log in and use the built-in scanner from your event dashboard.
        </p>
        <Link to="/auth">
          <Button className="bg-[#2ECC71] hover:bg-[#1A7A4A] text-white px-6 py-3 rounded-md text-lg font-medium">
            Go to Login
          </Button>
        </Link>
      </div>
    </div>
  );
}
