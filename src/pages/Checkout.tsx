import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useCartStore } from "@/store/cart-store";
import { formatPrice } from "@/lib/mock-data";

const STEPS = ["Cart", "Attendee Info", "Payment", "Confirmation"];

const CheckoutPage = () => {
  const [step, setStep] = useState(0);
  const { items, subtotal, clearCart, updateQuantity, removeItem } = useCartStore();
  const navigate = useNavigate();
  const [attendee, setAttendee] = useState({ name: "", email: "", phone: "" });

  const handleComplete = () => {
    clearCart();
    navigate("/confirmation");
  };

  if (items.length === 0 && step === 0) {
    return (
      <div className="container mx-auto px-4 py-20 text-center">
        <p className="text-muted-foreground mb-4">Your cart is empty</p>
        <Button onClick={() => navigate("/")} className="bg-primary text-primary-foreground">Browse Events</Button>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-3xl">
      {/* Step Indicator */}
      <div className="flex items-center justify-center mb-10">
        {STEPS.map((s, i) => (
          <div key={s} className="flex items-center">
            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ${
              i < step ? "bg-secondary text-secondary-foreground" :
              i === step ? "bg-primary text-primary-foreground" :
              "bg-muted text-muted-foreground"
            }`}>
              {i < step ? <Check className="w-4 h-4" /> : i + 1}
            </div>
            <span className={`hidden sm:inline text-xs ml-1.5 font-medium ${i === step ? "text-primary" : "text-muted-foreground"}`}>{s}</span>
            {i < STEPS.length - 1 && <div className={`w-8 sm:w-16 h-0.5 mx-2 ${i < step ? "bg-secondary" : "bg-muted"}`} />}
          </div>
        ))}
      </div>

      {/* Step 0: Cart Review */}
      {step === 0 && (
        <div className="space-y-4">
          <h2 className="text-xl font-bold text-foreground">Review Your Cart</h2>
          {items.map((item) => (
            <div key={item.tierId} className="flex items-center justify-between bg-card border border-border rounded-xl p-4">
              <div>
                <p className="font-semibold text-foreground">{item.eventTitle}</p>
                <p className="text-sm text-muted-foreground">{item.tierName} × {item.quantity}</p>
              </div>
              <p className="font-bold text-primary">{formatPrice(item.unitPrice * item.quantity)}</p>
            </div>
          ))}
          <div className="flex justify-between items-center pt-4 border-t border-border">
            <span className="font-medium text-foreground">Subtotal</span>
            <span className="text-2xl font-bold text-primary">{formatPrice(subtotal())}</span>
          </div>
          <Button onClick={() => setStep(1)} className="w-full bg-primary text-primary-foreground h-12 font-semibold">Continue</Button>
        </div>
      )}

      {/* Step 1: Attendee Info */}
      {step === 1 && (
        <div className="space-y-4">
          <h2 className="text-xl font-bold text-foreground">Attendee Details</h2>
          <div className="bg-card border border-border rounded-xl p-6 space-y-4">
            {[
              { label: "Full Name", key: "name" as const, type: "text", placeholder: "John Doe" },
              { label: "Email", key: "email" as const, type: "email", placeholder: "john@example.com" },
              { label: "Phone Number", key: "phone" as const, type: "tel", placeholder: "+234 800 000 0000" },
            ].map((f) => (
              <div key={f.key} className="space-y-1.5">
                <label className="text-sm font-medium text-foreground">{f.label}</label>
                <input
                  type={f.type}
                  value={attendee[f.key]}
                  onChange={(e) => setAttendee({ ...attendee, [f.key]: e.target.value })}
                  placeholder={f.placeholder}
                  className="w-full px-4 py-2.5 border border-input rounded-lg bg-background text-foreground text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all"
                />
              </div>
            ))}
          </div>
          <div className="flex gap-3">
            <Button onClick={() => setStep(0)} variant="outline" className="flex-1 border-primary text-primary">Back</Button>
            <Button onClick={() => setStep(2)} className="flex-1 bg-primary text-primary-foreground">Continue to Payment</Button>
          </div>
        </div>
      )}

      {/* Step 2: Payment */}
      {step === 2 && (
        <div className="space-y-4">
          <h2 className="text-xl font-bold text-foreground">Payment</h2>
          <div className="bg-card border border-border rounded-xl p-6 space-y-3">
            <h3 className="font-semibold text-foreground">Order Summary</h3>
            {items.map((item) => (
              <div key={item.tierId} className="flex justify-between text-sm">
                <span className="text-muted-foreground">{item.eventTitle} — {item.tierName} × {item.quantity}</span>
                <span className="text-foreground font-medium">{formatPrice(item.unitPrice * item.quantity)}</span>
              </div>
            ))}
            <div className="pt-3 border-t border-border flex justify-between">
              <span className="font-semibold text-foreground">Total</span>
              <span className="text-xl font-bold text-primary">{formatPrice(subtotal())}</span>
            </div>
          </div>
          <p className="text-xs text-muted-foreground text-center">Paystack integration will process your payment securely.</p>
          <div className="flex gap-3">
            <Button onClick={() => setStep(1)} variant="outline" className="flex-1 border-primary text-primary">Back</Button>
            <Button onClick={handleComplete} className="flex-1 bg-primary text-primary-foreground font-semibold">
              Pay {formatPrice(subtotal())}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
};

export default CheckoutPage;
