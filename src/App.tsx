import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/contexts/auth-context";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import CartDrawer from "@/components/CartDrawer";
import Index from "./pages/Index";
import EventDetail from "./pages/EventDetail";
import LoginPage from "./pages/Login";
import SignupPage from "./pages/Signup";
import CheckoutPage from "./pages/Checkout";
import ConfirmationPage from "./pages/Confirmation";
import MyTicketsPage from "./pages/MyTickets";
import NotFound from "./pages/NotFound";
import CreateEvent from "./pages/CreateEvent";
import AdminDashboard from "./pages/AdminDashboard";
import VerifyTicketPage from "./pages/VerifyTicket";

const queryClient = new QueryClient();

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
        </BrowserRouter>
      </TooltipProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
