import { useCallback, useEffect, useLayoutEffect, useRef } from "react";
import { cn } from "@/lib/utils";

const BASE_TEXT_INPUT =
  "bg-transparent outline-none w-full placeholder:text-gray-400 focus:outline-none focus:ring-1 focus:ring-cobalt/30 rounded";

const useIsomorphicLayoutEffect = typeof window !== "undefined" ? useLayoutEffect : useEffect;

/**
 * Textarea that grows with its text. It re-measures when its value changes and when it first gets
 * a size. A textarea mounted while hidden (collapsed group, display:none) measures 0px, so without
 * the ResizeObserver it stays at 0px and its text never shows.
 */
function AutoGrowTextarea({
  value,
  onChange,
  placeholder,
  ariaLabel,
  className,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  ariaLabel?: string;
  className?: string;
}) {
  const ref = useRef<HTMLTextAreaElement>(null);

  const grow = useCallback(() => {
    const element = ref.current;
    if (!element) return;
    element.style.height = "auto";
    // A hidden element reports 0; keep the one-line height rather than collapsing to 0px.
    if (element.scrollHeight > 0) element.style.height = `${element.scrollHeight}px`;
  }, []);

  useIsomorphicLayoutEffect(grow, [value, grow]);

  useEffect(() => {
    const element = ref.current;
    if (!element || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(() => grow());
    observer.observe(element);
    return () => observer.disconnect();
  }, [grow]);

  return (
    <textarea
      ref={ref}
      rows={1}
      value={value}
      onChange={(event) => onChange(event.currentTarget.value)}
      placeholder={placeholder}
      aria-label={ariaLabel}
      className={cn(BASE_TEXT_INPUT, "resize-none overflow-hidden", className)}
    />
  );
}

interface EditableTextCellProps {
  editable: boolean;
  value: string;
  placeholder?: string;
  onChange: (value: string) => void;
  className?: string;
  readClassName?: string;
  ariaLabel?: string;
  multiline?: boolean;
}

export function EditableTextCell({
  editable,
  value,
  placeholder,
  onChange,
  className,
  readClassName,
  ariaLabel,
  multiline = false,
}: EditableTextCellProps) {
  if (editable) {
    if (multiline) {
      return (
        <AutoGrowTextarea
          value={value}
          onChange={onChange}
          placeholder={placeholder}
          ariaLabel={ariaLabel ?? placeholder}
          className={className}
        />
      );
    }

    return (
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        aria-label={ariaLabel ?? placeholder}
        className={cn(BASE_TEXT_INPUT, className)}
      />
    );
  }
  return <span className={cn(readClassName ?? className)}>{value}</span>;
}

interface EditableNumberCellProps {
  editable: boolean;
  value: number;
  onChange: (value: number) => void;
  suffix?: string;
  min?: number;
  className?: string;
  ariaLabel?: string;
}

export function EditableNumberCell({
  editable,
  value,
  onChange,
  suffix,
  min = 0,
  className,
  ariaLabel,
}: EditableNumberCellProps) {
  if (editable) {
    return (
      <span className="inline-flex items-baseline">
        <input
          type="text"
          inputMode="decimal"
          value={value}
          onChange={(event) =>
            onChange(Math.max(min, Number(event.target.value) || 0))
          }
          aria-label={ariaLabel}
          className={cn(BASE_TEXT_INPUT, suffix ? "w-auto" : undefined, className)}
          style={
            suffix
              ? { width: `${Math.max(String(value).length, 1)}ch` }
              : undefined
          }
        />
        {suffix}
      </span>
    );
  }
  return (
    <span className={className}>
      {value}
      {suffix}
    </span>
  );
}
