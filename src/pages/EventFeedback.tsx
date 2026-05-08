import { useState, useEffect } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import { Star, CheckCircle, AlertCircle, Loader2 } from "lucide-react";
import { getSupabaseClient } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export default function EventFeedback() {
  const { eventId } = useParams();
  const [searchParams] = useSearchParams();
  const ticketId = searchParams.get("ticket");

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [status, setStatus] = useState<"loading" | "valid" | "already-submitted" | "invalid" | "success">("loading");
  const [eventData, setEventData] = useState<any>(null);
  
  const [rating, setRating] = useState(0);
  const [hoverRating, setHoverRating] = useState(0);
  const [comment, setComment] = useState("");

  const supabase = getSupabaseClient();

  useEffect(() => {
    async function validateFeedback() {
      if (!eventId || !ticketId || !supabase) {
        setStatus("invalid");
        setLoading(false);
        return;
      }

      try {
        // 1. Check if event exists
        const { data: event, error: eventError } = await supabase
          .from("events")
          .select("id, title, date")
          .eq("id", eventId)
          .single();

        if (eventError || !event) {
          setStatus("invalid");
          setLoading(false);
          return;
        }
        setEventData(event);

        // 2. Check if ticket is valid for this event
        const { data: ticket, error: ticketError } = await supabase
          .from("tickets")
          .select("id, status")
          .eq("id", ticketId)
          .eq("event_id", eventId)
          .single();

        if (ticketError || !ticket || ticket.status !== "confirmed") {
          setStatus("invalid");
          setLoading(false);
          return;
        }

        // 3. Check if already submitted
        const { data: feedback } = await supabase
          .from("event_feedback")
          .select("id")
          .eq("ticket_id", ticketId)
          .maybeSingle();

        if (feedback) {
          setStatus("already-submitted");
        } else {
          setStatus("valid");
        }
      } catch (err) {
        console.error("Validation error:", err);
        setStatus("invalid");
      } finally {
        setLoading(false);
      }
    }

    validateFeedback();
  }, [eventId, ticketId, supabase]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (rating === 0) {
      toast.error("Please select a rating");
      return;
    }

    if (!supabase) return;

    try {
      setSubmitting(true);
      const { error } = await supabase.from("event_feedback").insert({
        event_id: eventId,
        ticket_id: ticketId,
        rating,
        comment,
      });

      if (error) throw error;
      setStatus("success");
    } catch (err: any) {
      toast.error(err.message || "Failed to submit feedback");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-muted/30">
        <Loader2 className="w-10 h-10 animate-spin text-primary" />
      </div>
    );
  }

  if (status === "invalid") {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 bg-muted/30">
        <div className="max-w-md w-full bg-card p-8 rounded-2xl border border-border text-center space-y-4">
          <AlertCircle className="w-12 h-12 text-red-500 mx-auto" />
          <h1 className="text-xl font-bold">Invalid Feedback Link</h1>
          <p className="text-muted-foreground">This feedback link is invalid or the event could not be found.</p>
        </div>
      </div>
    );
  }

  if (status === "already-submitted") {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 bg-muted/30">
        <div className="max-w-md w-full bg-card p-8 rounded-2xl border border-border text-center space-y-4">
          <CheckCircle className="w-12 h-12 text-primary mx-auto" />
          <h1 className="text-xl font-bold">Feedback Already Submitted</h1>
          <p className="text-muted-foreground">You have already submitted feedback for this event. Thank you!</p>
        </div>
      </div>
    );
  }

  if (status === "success") {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 bg-muted/30">
        <div className="max-w-md w-full bg-card p-8 rounded-2xl border border-border text-center space-y-4 animate-in zoom-in duration-300">
          <CheckCircle className="w-12 h-12 text-primary mx-auto" />
          <h1 className="text-2xl font-bold">Thanks for your feedback! 🎉</h1>
          <p className="text-muted-foreground">Your response helps the organizers improve future experiences.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-muted/30 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-card p-8 rounded-2xl border border-border shadow-sm space-y-8">
        {/* Header */}
        <div className="text-center space-y-2">
          <h1 className="text-2xl font-bold tracking-tight">{eventData?.title}</h1>
          <p className="text-sm text-muted-foreground">
            {eventData?.date && new Date(eventData.date).toLocaleDateString("en-NG", { dateStyle: "long" })}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-8">
          {/* Star Rating */}
          <div className="space-y-3 text-center">
            <p className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Rate your experience</p>
            <div className="flex items-center justify-center gap-1">
              {[1, 2, 3, 4, 5].map((star) => (
                <button
                  key={star}
                  type="button"
                  onMouseEnter={() => setHoverRating(star)}
                  onMouseLeave={() => setHoverRating(0)}
                  onClick={() => setRating(star)}
                  className="p-1 transition-transform active:scale-90"
                >
                  <Star
                    className={cn(
                      "w-10 h-10 transition-colors",
                      (hoverRating || rating) >= star 
                        ? "fill-primary text-primary" 
                        : "text-muted-foreground/30"
                    )}
                  />
                </button>
              ))}
            </div>
            {rating > 0 && (
              <p className="text-sm font-medium text-primary animate-in fade-in slide-in-from-top-1">
                {rating === 1 ? "Poor" : rating === 2 ? "Fair" : rating === 3 ? "Good" : rating === 4 ? "Very Good" : "Excellent!"}
              </p>
            )}
          </div>

          {/* Comment */}
          <div className="space-y-2">
            <label className="text-sm font-semibold">Tell us about your experience</label>
            <Textarea
              placeholder="What did you like? What could be improved?"
              className="min-h-[120px] rounded-xl resize-none focus:ring-primary"
              value={comment}
              onChange={(e) => setComment(e.target.value)}
            />
          </div>

          <Button 
            type="submit" 
            className="w-full h-12 bg-primary hover:brightness-110 text-white font-bold rounded-xl shadow-lg shadow-primary/20 transition-all"
            disabled={submitting || rating === 0}
          >
            {submitting ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Submitting...
              </>
            ) : (
              "Submit Feedback"
            )}
          </Button>
        </form>
      </div>
    </div>
  );
}
