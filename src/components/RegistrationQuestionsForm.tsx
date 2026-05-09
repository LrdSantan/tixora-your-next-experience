import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { getSupabaseClient } from "@/lib/supabase";
import type { RegistrationQuestion, RegistrationAnswer } from "@/lib/mock-data";

interface Props {
  eventId: string;
  /** Called with the current answers every time anything changes */
  onChange: (answers: RegistrationAnswer[]) => void;
}

export function RegistrationQuestionsForm({ eventId, onChange }: Props) {
  const supabase = getSupabaseClient();
  const [isLoading, setIsLoading] = useState(true);
  const [questions, setQuestions] = useState<RegistrationQuestion[]>([]);
  const [answers, setAnswers] = useState<Record<string, string>>({});

  // Load questions for this event
  useEffect(() => {
    let isMounted = true;
    async function load() {
      if (!supabase) { setIsLoading(false); return; }
      setIsLoading(true);
      const { data, error } = await supabase
        .from("registration_questions")
        .select("id, event_id, question_text, question_type, options, is_required, display_order")
        .eq("event_id", eventId)
        .order("display_order", { ascending: true });

      if (!error && data && isMounted) {
        setQuestions(data.map((q) => ({
          id: q.id,
          event_id: q.event_id,
          question_text: q.question_text,
          question_type: q.question_type as RegistrationQuestion["question_type"],
          options: (q.options as string[]) ?? [],
          is_required: q.is_required,
          display_order: q.display_order,
        })));
      }
      if (isMounted) setIsLoading(false);
    }
    load();
    return () => { isMounted = false; };
  }, [eventId, supabase]);

  // Notify parent whenever answers change
  useEffect(() => {
    const result: RegistrationAnswer[] = Object.entries(answers)
      .filter(([, v]) => v.trim() !== "")
      .map(([question_id, answer]) => ({ question_id, answer }));
    onChange(result);
  }, [answers, onChange]);

  const setAnswer = (questionId: string, value: string) => {
    setAnswers((prev) => ({ ...prev, [questionId]: value }));
  };

  if (isLoading) {
    return (
      <div className="flex justify-center py-4">
        <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (questions.length === 0) return null;

  return (
    <div className="mt-6 space-y-4 rounded-xl border border-border bg-muted/30 p-5">
      <div>
        <h3 className="text-sm font-semibold text-foreground">A few questions from the organizer</h3>
        <p className="text-xs text-muted-foreground mt-0.5">All questions are optional</p>
      </div>

      <div className="space-y-4">
        {questions.map((q) => (
          <div key={q.id} className="space-y-1.5">
            <Label className="text-sm font-medium text-foreground">
              {q.question_text}
            </Label>

            {q.question_type === "short_text" && (
              <Input
                placeholder="Your answer..."
                value={answers[q.id] ?? ""}
                onChange={(e) => setAnswer(q.id, e.target.value)}
              />
            )}

            {q.question_type === "long_text" && (
              <Textarea
                placeholder="Your answer..."
                rows={3}
                className="resize-none"
                value={answers[q.id] ?? ""}
                onChange={(e) => setAnswer(q.id, e.target.value)}
              />
            )}

            {q.question_type === "multiple_choice" && (q.options ?? []).length > 0 && (
              <div className="space-y-2 pt-0.5">
                {(q.options ?? []).map((opt) => (
                  <label key={opt} className="flex items-center gap-2.5 cursor-pointer">
                    <input
                      type="radio"
                      name={`rq-${q.id}`}
                      value={opt}
                      checked={answers[q.id] === opt}
                      onChange={() => setAnswer(q.id, opt)}
                      className="h-4 w-4 accent-green-700"
                    />
                    <span className="text-sm">{opt}</span>
                  </label>
                ))}
              </div>
            )}

            {q.question_type === "checkbox" && (
              <label className="flex items-center gap-2.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={answers[q.id] === "yes"}
                  onChange={(e) => setAnswer(q.id, e.target.checked ? "yes" : "")}
                  className="h-4 w-4 rounded accent-green-700"
                />
                <span className="text-sm">{q.question_text}</span>
              </label>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
