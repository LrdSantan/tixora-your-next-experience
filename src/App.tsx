import React, { Suspense } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/contexts/auth-context";
import { Loader2 } from "lucide-react";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import CartDrawer from "@/components/CartDrawer";

const Index = React.lazy(() => import("./pages/Index"));
const EventDetail = React.lazy(() => import("./pages/EventDetail"));
const LoginPage = React.lazy(() => import("./pages/Login"));
const SignupPage = React.lazy(() => import("./pages/Signup"));
const CheckoutPage = React.lazy(() => import("./pages/Checkout"));
const ConfirmationPage = React.lazy(() => import("./pages/Confirmation"));
const MyTicketsPage = React.lazy(() => import("./pages/MyTickets"));
const NotFound = React.lazy(() => import("./pages/NotFound"));
const CreateEvent = React.lazy(() => import("./pages/CreateEvent"));
const AdminDashboard = React.lazy(() => import("./pages/AdminDashboard"));
const VerifyTicketPage = React.lazy(() => import("./pages/VerifyTicket"));

const queryClient = new QueryClient();

function DelayedFallback() {
  const [show, setShow] = React.useState(false);
  
  React.useEffect(() => {
    const timer = setTimeout(() => setShow(true), 200);
    return () => clearTimeout(timer);
  }, []);
  
  if (!show) return null;
  
  return (
    <div className="flex items-center justify-center min-h-screen">
      <Loader2 className="h-8 w-8 animate-spin text-primary" />
    </div>
  );
}

const AppLayout = ({ children, showNav = true }: { children: React.ReactNode; showNav?: boolean }) => (
  <div className="min-h-screen flex flex-col">
    {showNav && <Navbar />}
    <CartDrawer />
    <main className="flex-1">{children}</main>
    {showNav && <Footer />}
  </div>
);

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Suspense fallback={<DelayedFallback />}>
            <Routes>
              <Route path="/" element={<AppLayout><Index /></AppLayout>} />
              <Route path="/events/:id" element={<AppLayout><EventDetail /></AppLayout>} />
              <Route path="/checkout" element={<AppLayout><CheckoutPage /></AppLayout>} />
              <Route path="/confirmation" element={<AppLayout><ConfirmationPage /></AppLayout>} />
              <Route path="/my-tickets" element={<AppLayout><MyTicketsPage /></AppLayout>} />
              <Route path="/login" element={<AppLayout showNav={false}><LoginPage /></AppLayout>} />
              <Route path="/signup" element={<AppLayout showNav={false}><SignupPage /></AppLayout>} />
              <Route path="/create-event" element={<AppLayout><CreateEvent /></AppLayout>} />
              <Route path="/admin" element={<AppLayout showNav={false}><AdminDashboard /></AppLayout>} />
              <Route path="/verify/:ticketCode" element={<VerifyTicketPage />} />
              <Route path="*" element={<AppLayout><NotFound /></AppLayout>} />
            </Routes>
          </Suspense>
        </BrowserRouter>
      </TooltipProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
