import { useCallback, useEffect, useId, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { useNavigate } from "react-router-dom";
import { Search } from "lucide-react";
import { cn } from "@/lib/utils";
import { useEvents } from "@/hooks/use-events";
import { getEventSearchSuggestions } from "@/lib/event-search-suggestions";
import type { Event } from "@/lib/mock-data";

type EventSearchInputProps = {
  value: string;
  onChange: (value: string) => void;
  variant: "hero" | "nav";
  /** Enter with no highlighted suggestion (e.g. go to home search from navbar). */
  onEnterWithoutSelection?: () => void;
  /** After opening an event from the list (e.g. close mobile menu). */
  onSuggestionNavigate?: () => void;
  /** Optional: use parent’s event list instead of fetching again. */
  events?: Event[];
  className?: string;
  placeholder?: string;
  "aria-label"?: string;
};

export function EventSearchInput({
  value,
  onChange,
  variant,
  onEnterWithoutSelection,
  onSuggestionNavigate,
  events: eventsProp,
  className,
  placeholder,
  "aria-label": ariaLabel,
}: EventSearchInputProps) {
  const navigate = useNavigate();
  const { data: fetched = [] } = useEvents();
  const events = eventsProp ?? fetched;

  const listId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const blurTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [focused, setFocused] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);

  const suggestions = useMemo(() => getEventSearchSuggestions(events, value, 8), [events, value]);
  const showList = focused && suggestions.length > 0;

  useEffect(() => {
    setActiveIndex(-1);
  }, [value, suggestions.length]);

  const clearBlurTimer = useCallback(() => {
    if (blurTimer.current) {
      clearTimeout(blurTimer.current);
      blurTimer.current = null;
    }
  }, []);

  const goToEvent = useCallback(
    (event: Event) => {
      navigate(`/events/${event.id}`);
      setFocused(false);
      setActiveIndex(-1);
      onSuggestionNavigate?.();
    },
    [navigate, onSuggestionNavigate],
  );

  const handleFocus = useCallback(() => {
    clearBlurTimer();
    setFocused(true);
  }, [clearBlurTimer]);

  const handleBlur = useCallback(() => {
    blurTimer.current = setTimeout(() => {
      setFocused(false);
      setActiveIndex(-1);
    }, 180);
  }, []);

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Escape") {
      e.preventDefault();
      setFocused(false);
      setActiveIndex(-1);
      return;
    }

    if (e.key === "ArrowDown") {
      if (suggestions.length === 0) return;
      e.preventDefault();
      setFocused(true);
      setActiveIndex((i) => (i < suggestions.length - 1 ? i + 1 : 0));
      return;
    }

    if (e.key === "ArrowUp") {
      if (suggestions.length === 0) return;
      e.preventDefault();
      setFocused(true);
      setActiveIndex((i) => (i <= 0 ? suggestions.length - 1 : i - 1));
      return;
    }

    if (e.key === "Enter") {
      if (showList && activeIndex >= 0 && suggestions[activeIndex]) {
        e.preventDefault();
        goToEvent(suggestions[activeIndex]);
        return;
      }
      onEnterWithoutSelection?.();
    }
  };

  useEffect(() => {
    const onDocMouseDown = (ev: MouseEvent) => {
      if (!rootRef.current?.contains(ev.target as Node)) {
        setFocused(false);
        setActiveIndex(-1);
      }
    };
    document.addEventListener("mousedown", onDocMouseDown);
    return () => document.removeEventListener("mousedown", onDocMouseDown);
  }, []);

  const shellClass =
    variant === "hero"
      ? "flex items-center bg-background rounded-full px-4 py-3 flex-1 w-full"
      : "flex items-center bg-muted rounded-full px-4 py-2 w-full";

  return (
    <div ref={rootRef} className={cn("relative", className)}>
      <div className={shellClass}>
        <Search className="w-4 h-4 text-muted-foreground mr-2 shrink-0" aria-hidden />
        <input
          type="search"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onFocus={handleFocus}
          onBlur={handleBlur}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          autoComplete="off"
          aria-label={ariaLabel ?? "Search events"}
          aria-expanded={showList}
          aria-controls={showList ? listId : undefined}
          aria-autocomplete="list"
          role="combobox"
          className="bg-transparent text-sm outline-none w-full text-foreground placeholder:text-muted-foreground"
        />
      </div>

      {showList && (
        <ul
          id={listId}
          role="listbox"
          className="absolute z-[100] left-0 right-0 top-full mt-1.5 max-h-72 overflow-y-auto rounded-xl border border-border bg-popover text-popover-foreground shadow-lg py-1"
        >
          {suggestions.map((event, index) => (
            <li key={event.id} role="presentation">
              <button
                type="button"
                role="option"
                aria-selected={index === activeIndex}
                id={`${listId}-opt-${event.id}`}
                className={cn(
                  "w-full text-left px-3 py-2.5 text-sm transition-colors",
                  index === activeIndex ? "bg-accent text-accent-foreground" : "hover:bg-accent/80",
                )}
                onMouseDown={(ev) => {
                  ev.preventDefault();
                  clearBlurTimer();
                }}
                onClick={() => goToEvent(event)}
                onMouseEnter={() => setActiveIndex(index)}
              >
                <span className="font-medium text-foreground line-clamp-1">{event.title}</span>
                <span className="block text-xs text-muted-foreground line-clamp-1">
                  {event.city} · {event.category}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
