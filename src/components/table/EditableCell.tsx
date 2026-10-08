import { cn } from "@/lib/utils";

const BASE_TEXT_INPUT =
  "bg-transparent outline-none w-full placeholder:text-gray-400 focus:outline-none focus:ring-1 focus:ring-cobalt/30 rounded";

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
      const resize = (element: HTMLTextAreaElement | null) => {
        if (!element) return;
        element.style.height = "auto";
        element.style.height = `${element.scrollHeight}px`;
      };

      return (
        <textarea
          ref={resize}
          rows={1}
          value={value}
          onChange={(event) => {
            const target = event.currentTarget;
            resize(target);
            onChange(target.value);
          }}
          placeholder={placeholder}
          aria-label={ariaLabel ?? placeholder}
          className={cn(BASE_TEXT_INPUT, "resize-none overflow-hidden", className)}
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
