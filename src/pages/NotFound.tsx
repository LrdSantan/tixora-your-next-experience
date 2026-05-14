import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import { Helmet } from "react-helmet-async";

const NotFound = () => {
  return (
    <div className="min-h-screen bg-[#080C0A] flex flex-col items-center justify-center text-white px-4">
      <Helmet>
        <title>404 - Page Not Found | Tixora</title>
      </Helmet>
      
      <div className="flex flex-col items-center max-w-md w-full space-y-8 text-center">
        <div className="text-[#1A7A4A] text-8xl font-black opacity-20">404</div>
        
        <div className="space-y-4">
          <h1 className="text-3xl font-bold">Page not found</h1>
          <p className="text-white/60">
            The page you're looking for doesn't exist or has been moved.
          </p>
        </div>

        <Button 
          asChild
          className="bg-[#1A7A4A] hover:bg-[#1A7A4A]/90 text-white h-14 px-10 rounded-xl font-bold text-lg shadow-[0_10px_20px_rgba(26,122,74,0.2)]"
        >
          <Link to="/">Go Home</Link>
        </Button>
      </div>
    </div>
  );
};

export default NotFound;
