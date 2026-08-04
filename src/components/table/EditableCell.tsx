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
}

export function EditableTextCell({
  editable,
  value,
  placeholder,
  onChange,
  className,
  readClassName,
  ariaLabel,
}: EditableTextCellProps) {
  if (editable) {
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
      <input
        type="number"
        min={min}
        value={value}
        onChange={(e) =>
          onChange(Math.max(min, Number(e.target.value) || 0))
        }
        aria-label={ariaLabel}
        className={cn(BASE_TEXT_INPUT, className)}
      />
    );
  }
  return (
    <span className={className}>
      {value}
      {suffix}
    </span>
  );
}
