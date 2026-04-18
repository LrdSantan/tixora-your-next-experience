import React, { Suspense } from "react";
import { HelmetProvider } from "react-helmet-async";
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
import { InviteBanner } from "@/components/InviteBanner";
import OrganizerEventsPage from '@/pages/organizer/Events';
import OrganizerDashboard from '@/pages/organizer/Dashboard';

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
const SearchPage = React.lazy(() => import("./pages/Search"));

const OrganizerTeamPage = React.lazy(() => import("./pages/organizer/Team"));
const AboutPage = React.lazy(() => import("./pages/About"));
const ContactPage = React.lazy(() => import("./pages/Contact"));
const BlogPage = React.lazy(() => import("./pages/Blog"));
const BlogPostPage = React.lazy(() => import("./pages/BlogPost"));
const PrivacyPage = React.lazy(() => import("./pages/Privacy"));
const TermsPage = React.lazy(() => import("./pages/Terms"));
const FAQPage = React.lazy(() => import("./pages/FAQ"));
const ResellMarketplace = React.lazy(() => import("./pages/ResellMarketplace"));
const ResellCheckout = React.lazy(() => import("./pages/ResellCheckout"));
const ClaimTicket = React.lazy(() => import("./pages/ClaimTicket"));
const SettingsPage = React.lazy(() => import("./pages/Settings"));
const AdminPayoutsPage = React.lazy(() => import("./pages/AdminPayouts"));
const HighSpeedScannerPage = React.lazy(() => import("./pages/admin/HighSpeedScanner"));

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
    {showNav && <InviteBanner />}
    <main className="flex-1">{children}</main>
    {showNav && <Footer />}
  </div>
);

const App = () => (
  <HelmetProvider>
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
                <Route path="/search" element={<AppLayout><SearchPage /></AppLayout>} />
                <Route path="/organizer/dashboard" element={<AppLayout><OrganizerDashboard /></AppLayout>} />
                <Route path="/organizer/events" element={<AppLayout><OrganizerEventsPage /></AppLayout>} />

                <Route path="/organizer/team" element={<AppLayout><OrganizerTeamPage /></AppLayout>} />
                <Route path="/about" element={<AppLayout><AboutPage /></AppLayout>} />
                <Route path="/contact" element={<AppLayout><ContactPage /></AppLayout>} />
                <Route path="/blog" element={<AppLayout><BlogPage /></AppLayout>} />
                <Route path="/blog/:slug" element={<AppLayout><BlogPostPage /></AppLayout>} />
                <Route path="/privacy" element={<AppLayout><PrivacyPage /></AppLayout>} />
                <Route path="/terms" element={<AppLayout><TermsPage /></AppLayout>} />
                <Route path="/faq" element={<AppLayout><FAQPage /></AppLayout>} />
                <Route path="/marketplace" element={<AppLayout><ResellMarketplace /></AppLayout>} />
                <Route path="/resell/checkout/:resellId" element={<AppLayout><ResellCheckout /></AppLayout>} />
                <Route path="/claim-ticket/:transferToken" element={<AppLayout><ClaimTicket /></AppLayout>} />
                <Route path="/settings" element={<AppLayout><SettingsPage /></AppLayout>} />
                <Route path="/admin/payouts" element={<AppLayout showNav={false}><AdminPayoutsPage /></AppLayout>} />
                <Route path="/admin/events/:id/scan" element={<AppLayout><HighSpeedScannerPage /></AppLayout>} />
                <Route path="/verify/:qrToken?" element={<VerifyTicketPage />} />
                <Route path="*" element={<AppLayout><NotFound /></AppLayout>} />
              </Routes>
            </Suspense>
          </BrowserRouter>
        </TooltipProvider>
      </AuthProvider>
    </QueryClientProvider>
  </HelmetProvider>
);

export default App;
