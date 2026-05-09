import { useState, useEffect } from "react";
import { GripVertical, Plus, Trash2, X, Loader2, ClipboardList } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { getSupabaseClient } from "@/lib/supabase";
import type { RegistrationQuestion } from "@/lib/mock-data";

type LocalQuestion = Omit<RegistrationQuestion, "id" | "event_id"> & {
  _localId: string;
  _optionInput: string;
};

const QUESTION_TYPES = [
  { value: "short_text", label: "Short Text" },
  { value: "long_text", label: "Long Text" },
  { value: "multiple_choice", label: "Multiple Choice" },
  { value: "checkbox", label: "Checkbox" },
] as const;

function newQuestion(order: number): LocalQuestion {
  return {
    _localId: crypto.randomUUID(),
    _optionInput: "",
    question_text: "",
    question_type: "short_text",
    options: [],
    is_required: false,
    display_order: order,
  };
}

export function RegistrationQuestionsEditor({ eventId }: { eventId: string }) {
  const supabase = getSupabaseClient();
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [questions, setQuestions] = useState<LocalQuestion[]>([]);

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
        setQuestions(
          data.map((q) => ({
            _localId: q.id,
            _optionInput: "",
            question_text: q.question_text,
            question_type: q.question_type as LocalQuestion["question_type"],
            options: (q.options as string[]) ?? [],
            is_required: q.is_required,
            display_order: q.display_order,
          }))
        );
      }
      if (isMounted) setIsLoading(false);
    }
    load();
    return () => { isMounted = false; };
  }, [eventId, supabase]);

  const updateQ = (localId: string, patch: Partial<LocalQuestion>) => {
    setQuestions((prev) =>
      prev.map((q) => (q._localId === localId ? { ...q, ...patch } : q))
    );
  };

  const addQuestion = () => {
    setQuestions((prev) => [...prev, newQuestion(prev.length)]);
  };

  const removeQuestion = (localId: string) => {
    setQuestions((prev) => prev.filter((q) => q._localId !== localId));
  };

  const moveUp = (idx: number) => {
    if (idx === 0) return;
    setQuestions((prev) => {
      const next = [...prev];
      [next[idx - 1], next[idx]] = [next[idx], next[idx - 1]];
      return next.map((q, i) => ({ ...q, display_order: i }));
    });
  };

  const moveDown = (idx: number) => {
    setQuestions((prev) => {
      if (idx >= prev.length - 1) return prev;
      const next = [...prev];
      [next[idx], next[idx + 1]] = [next[idx + 1], next[idx]];
      return next.map((q, i) => ({ ...q, display_order: i }));
    });
  };

  const addOption = (localId: string, optionText: string) => {
    const trimmed = optionText.trim();
    if (!trimmed) return;
    setQuestions((prev) =>
      prev.map((q) =>
        q._localId === localId
          ? { ...q, options: [...(q.options ?? []), trimmed], _optionInput: "" }
          : q
      )
    );
  };

  const removeOption = (localId: string, optIdx: number) => {
    setQuestions((prev) =>
      prev.map((q) =>
        q._localId === localId
          ? { ...q, options: (q.options ?? []).filter((_, i) => i !== optIdx) }
          : q
      )
    );
  };

  const handleSave = async () => {
    if (!supabase) return;

    for (const q of questions) {
      if (!q.question_text.trim()) {
        toast.error("All questions must have text.");
        return;
      }
      if (q.question_type === "multiple_choice" && (q.options ?? []).length < 2) {
        toast.error("Multiple choice questions need at least 2 options.");
        return;
      }
    }

    setIsSaving(true);
    try {
      // Delete all existing questions for this event
      const { error: deleteError } = await supabase
        .from("registration_questions")
        .delete()
        .eq("event_id", eventId);
      if (deleteError) throw deleteError;

      // Insert new list
      if (questions.length > 0) {
        const payload = questions.map((q, i) => ({
          event_id: eventId,
          question_text: q.question_text.trim(),
          question_type: q.question_type,
          options: q.question_type === "multiple_choice" ? q.options : null,
          is_required: false,
          display_order: i,
        }));
        const { error: insertError } = await supabase
          .from("registration_questions")
          .insert(payload);
        if (insertError) throw insertError;
      }

      toast.success("Questions saved!");
    } catch (err: any) {
      toast.error(err.message || "Failed to save questions");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="mt-2 pt-3 border-t border-border space-y-3 bg-muted/30 rounded-lg p-3 mx-4 mb-4">
      <h4 className="text-sm font-semibold flex items-center gap-2">
        <ClipboardList className="w-4 h-4 text-primary" /> Registration Questions
        <span className="ml-auto text-[10px] font-normal text-muted-foreground">All questions are optional for attendees</span>
      </h4>

      {isLoading ? (
        <div className="flex justify-center py-4">
          <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <div className="space-y-3">
          {questions.length === 0 && (
            <p className="text-xs text-muted-foreground text-center py-2">No questions yet. Add one below.</p>
          )}

          {questions.map((q, idx) => (
            <div key={q._localId} className="bg-background border border-border rounded-lg p-3 space-y-2">
              {/* Row 1: order controls + text + type + delete */}
              <div className="flex items-start gap-2">
                <div className="flex flex-col gap-0.5 mt-1 shrink-0">
                  <button
                    type="button"
                    onClick={() => moveUp(idx)}
                    disabled={idx === 0}
                    className="h-4 w-4 flex items-center justify-center text-muted-foreground hover:text-foreground disabled:opacity-30"
                    aria-label="Move up"
                  >▲</button>
                  <button
                    type="button"
                    onClick={() => moveDown(idx)}
                    disabled={idx === questions.length - 1}
                    className="h-4 w-4 flex items-center justify-center text-muted-foreground hover:text-foreground disabled:opacity-30"
                    aria-label="Move down"
                  >▼</button>
                </div>

                <Input
                  className="h-8 text-sm flex-1 bg-muted/20"
                  placeholder="Question text..."
                  value={q.question_text}
                  onChange={(e) => updateQ(q._localId, { question_text: e.target.value })}
                />

                <select
                  value={q.question_type}
                  onChange={(e) =>
                    updateQ(q._localId, {
                      question_type: e.target.value as LocalQuestion["question_type"],
                      options: [],
                    })
                  }
                  className="h-8 rounded-md border border-input bg-background text-xs px-2 shrink-0"
                >
                  {QUESTION_TYPES.map((t) => (
                    <option key={t.value} value={t.value}>{t.label}</option>
                  ))}
                </select>

                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 w-8 p-0 text-red-500 hover:text-red-600 hover:bg-red-50 shrink-0"
                  onClick={() => removeQuestion(q._localId)}
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>

              {/* Multiple choice options */}
              {q.question_type === "multiple_choice" && (
                <div className="pl-6 space-y-1.5">
                  {(q.options ?? []).map((opt, optIdx) => (
                    <div key={optIdx} className="flex items-center gap-1.5">
                      <div className="h-2.5 w-2.5 rounded-full border-2 border-primary shrink-0" />
                      <span className="text-xs flex-1">{opt}</span>
                      <button
                        type="button"
                        onClick={() => removeOption(q._localId, optIdx)}
                        className="text-muted-foreground hover:text-red-500"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  ))}
                  <div className="flex gap-1.5">
                    <Input
                      className="h-7 text-xs"
                      placeholder="Add option..."
                      value={q._optionInput}
                      onChange={(e) => updateQ(q._localId, { _optionInput: e.target.value })}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          addOption(q._localId, q._optionInput);
                        }
                      }}
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-7 px-2"
                      onClick={() => addOption(q._localId, q._optionInput)}
                    >
                      <Plus className="w-3 h-3" />
                    </Button>
                  </div>
                </div>
              )}
            </div>
          ))}

          <Button
            variant="outline"
            size="sm"
            className="w-full h-8 border-dashed bg-background"
            onClick={addQuestion}
          >
            <Plus className="w-3.5 h-3.5 mr-1" /> Add Question
          </Button>

          <div className="flex justify-end pt-1">
            <Button size="sm" onClick={handleSave} disabled={isSaving} className="h-8 text-xs">
              {isSaving && <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />}
              Save Questions
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
