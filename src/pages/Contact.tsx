import { useState } from "react";
import { Mail, MapPin, Clock, Twitter, Loader2, Send } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { getSupabaseClient } from "@/lib/supabase";

export default function Contact() {
  const [form, setForm] = useState({
    name: "",
    email: "",
    subject: "",
    message: ""
  });
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name || !form.email || !form.subject || !form.message) {
      toast.error("Please fill in all fields");
      return;
    }

    if (form.message.length < 20) {
      toast.error("Message must be at least 20 characters");
      return;
    }

    setLoading(true);
    try {
      const supabase = getSupabaseClient();
      if (!supabase) throw new Error("Supabase client not initialized");

      const { data, error } = await supabase.functions.invoke("send-contact-email", {
        body: form
      });

      if (error) throw error;

      toast.success("Thanks for reaching out! We'll get back to you within 24 hours.");
      setForm({ name: "", email: "", subject: "", message: "" });
    } catch (err: any) {
      console.error("Contact error:", err);
      toast.error("Failed to send message. Please try again later.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container mx-auto px-4 py-16 max-w-6xl">
      <div className="grid lg:grid-cols-2 gap-16 items-start">
        {/* Info Column */}
        <div className="space-y-12">
          <div>
            <h1 className="text-4xl font-extrabold text-foreground mb-6">Get in Touch</h1>
            <p className="text-lg text-muted-foreground leading-relaxed">
              Have a question, partnership inquiry, or need support? We'd love to hear from you.
            </p>
          </div>

          <div className="space-y-8">
            <div className="flex gap-4">
              <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                <Mail className="w-6 h-6 text-primary" />
              </div>
              <div>
                <h3 className="font-bold text-lg mb-1">Email Us</h3>
                <p className="text-muted-foreground">support@tixora.ng</p>
                <p className="text-sm text-muted-foreground italic">(Internal: yusufquadir50@gmail.com)</p>
              </div>
            </div>

            <div className="flex gap-4">
              <div className="w-12 h-12 rounded-xl bg-blue-50 flex items-center justify-center shrink-0">
                <MapPin className="w-6 h-6 text-blue-500" />
              </div>
              <div>
                <h3 className="font-bold text-lg mb-1">Office Location</h3>
                <p className="text-muted-foreground">Abuja, Nigeria</p>
              </div>
            </div>

            <div className="flex gap-4">
              <div className="w-12 h-12 rounded-xl bg-amber-50 flex items-center justify-center shrink-0">
                <Clock className="w-6 h-6 text-amber-500" />
              </div>
              <div>
                <h3 className="font-bold text-lg mb-1">Response Time</h3>
                <p className="text-muted-foreground">Within 24 hours</p>
              </div>
            </div>

            <div className="flex gap-4">
              <div className="w-12 h-12 rounded-xl bg-slate-50 flex items-center justify-center shrink-0">
                <Twitter className="w-6 h-6 text-blue-400" />
              </div>
              <div>
                <h3 className="font-bold text-lg mb-1">Connect on X</h3>
                <a 
                  href="https://x.com/ifwayodeji" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="text-primary hover:underline font-medium"
                >
                  @ifwayodeji
                </a>
              </div>
            </div>
          </div>
        </div>

        {/* Form Column */}
        <div className="bg-card border border-border p-8 md:p-10 rounded-3xl shadow-sm">
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-2">
              <label className="text-sm font-semibold">Full Name</label>
              <Input 
                required
                placeholder="Yusuf Ayodeji"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                className="rounded-xl border-border h-12"
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-semibold">Email Address</label>
              <Input 
                required
                type="email"
                placeholder="yusuf@example.com"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                className="rounded-xl border-border h-12"
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-semibold">Subject</label>
              <Select 
                value={form.subject}
                onValueChange={(v) => setForm({ ...form, subject: v })}
              >
                <SelectTrigger className="rounded-xl h-12">
                  <SelectValue placeholder="Select inquiry type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="General Inquiry">General Inquiry</SelectItem>
                  <SelectItem value="Event Organizer Inquiry">Event Organizer Inquiry</SelectItem>
                  <SelectItem value="Technical Support">Technical Support</SelectItem>
                  <SelectItem value="Partnership">Partnership</SelectItem>
                  <SelectItem value="Report an Issue">Report an Issue</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-semibold">Message</label>
              <Textarea 
                required
                placeholder="Tell us how we can help..."
                value={form.message}
                onChange={(e) => setForm({ ...form, message: e.target.value })}
                className="rounded-xl border-border min-h-[160px] resize-none py-3"
              />
              <p className="text-[10px] text-muted-foreground text-right border-t pt-1">
                {form.message.length} / 20 characters minimum
              </p>
            </div>

            <Button 
              type="submit" 
              className="w-full h-14 bg-primary text-primary-foreground font-bold rounded-xl text-lg group"
              disabled={loading}
            >
              {loading ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <>
                  Send Message
                  <Send className="w-5 h-5 ml-2 group-hover:translate-x-1 transition-transform" />
                </>
              )}
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}
