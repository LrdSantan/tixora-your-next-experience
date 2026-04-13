import { useState, useEffect } from "react";
import { Star } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { getSupabaseClient } from "@/lib/supabase";
import { useAuth } from "@/contexts/auth-context";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

type Review = {
  id: string;
  rating: number;
  comment: string;
  user_name: string;
  created_at: string;
};

export function EventReviews({ eventId }: { eventId: string }) {
  const { user } = useAuth();
  const supabase = getSupabaseClient();
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);
  const [canReview, setCanReview] = useState(false);
  const [userReview, setUserReview] = useState<Review | null>(null);

  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    async function loadReviews() {
      if (!supabase) return;
      try {
        const { data } = await supabase
          .from("reviews")
          .select("*")
          .eq("event_id", eventId)
          .order("created_at", { ascending: false });
        
        if (data) {
          setReviews(data);
          if (user) {
            const hasReviewed = data.find(r => r.user_id === user.id);
            if (hasReviewed) setUserReview(hasReviewed);
          }
        }

        if (user && !userReview) {
          // Check if user has a ticket for this event
          const { data: tickets } = await supabase
            .from("tickets")
            .select("id")
            .eq("event_id", eventId)
            .eq("user_id", user.id)
            .limit(1);

          if (tickets && tickets.length > 0) {
            setCanReview(true);
          }
        }
      } catch (err) {
        console.error("Failed to load reviews:", err);
      } finally {
        setLoading(false);
      }
    }
    loadReviews();
  }, [supabase, eventId, user, userReview]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!supabase || !user) return;
    setSubmitting(true);
    try {
      const meta = user.user_metadata as { full_name?: string };
      const userName = meta.full_name || user.email?.split("@")[0] || "Anonymous";

      const { error } = await supabase.from("reviews").insert({
        event_id: eventId,
        user_id: user.id,
        rating,
        comment,
        user_name: userName
      });

      if (error) {
         if (error.code === '23505') {
            toast.error("You have already reviewed this event.");
         } else {
            throw error;
         }
      } else {
        toast.success("Review submitted!");
        // Reload reviews natively by changing a state
        const { data } = await supabase.from("reviews").select("*").eq("event_id", eventId).order("created_at", { ascending: false });
        if (data) setReviews(data);
        setCanReview(false);
      }
    } catch (err: any) {
      toast.error(err.message || "Failed to submit review");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <div className="text-sm text-muted-foreground animate-pulse mt-8">Loading reviews...</div>;

  return (
    <div className="mt-12 border-t pt-8">
      <h2 className="text-2xl font-bold mb-6">Reviews & Ratings</h2>

      {canReview && !userReview && (
        <div className="mb-8 p-6 bg-card border rounded-2xl shadow-sm">
          <h3 className="font-semibold mb-2">Write a review</h3>
          <p className="text-sm text-muted-foreground mb-4">You attended this event. Share your experience!</p>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="flex gap-1">
              {[1, 2, 3, 4, 5].map((star) => (
                <button
                  type="button"
                  key={star}
                  onClick={() => setRating(star)}
                  className="focus:outline-none transition-transform hover:scale-110 active:scale-95"
                >
                  <Star className={cn("w-6 h-6", star <= rating ? "fill-amber-400 text-amber-400" : "fill-neutral-200 text-neutral-200")} />
                </button>
              ))}
            </div>
            <Textarea
              placeholder="What did you think of the event?"
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              className="resize-none"
              rows={3}
            />
            <Button type="submit" disabled={submitting} className="bg-amber-500 hover:bg-amber-600 text-white">
              {submitting ? "Submitting..." : "Submit Review"}
            </Button>
          </form>
        </div>
      )}

      {user && userReview && (
        <div className="mb-8 p-4 bg-amber-50 border border-amber-200 rounded-xl">
          <p className="text-sm text-amber-800 font-medium">You have reviewed this event.</p>
        </div>
      )}

      <div className="space-y-4">
        {reviews.length === 0 ? (
          <p className="text-muted-foreground">No reviews yet.</p>
        ) : (
          reviews.map((review) => (
            <div key={review.id} className="p-5 border bg-white rounded-2xl shadow-sm">
              <div className="flex justify-between items-start mb-2">
                <div>
                  <h4 className="font-bold">{review.user_name}</h4>
                  <p className="text-xs text-muted-foreground">{new Date(review.created_at).toLocaleDateString()}</p>
                </div>
                <div className="flex gap-0.5">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <Star key={star} className={cn("w-4 h-4", star <= review.rating ? "fill-amber-400 text-amber-400" : "fill-neutral-200 text-neutral-200")} />
                  ))}
                </div>
              </div>
              {review.comment && <p className="text-sm text-foreground mt-3 leading-relaxed">{review.comment}</p>}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
