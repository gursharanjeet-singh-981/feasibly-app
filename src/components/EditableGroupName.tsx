"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";

interface Props {
  value: string;
  onRename: (newName: string) => void;
  existingNames?: Set<string>;
}

export function EditableGroupName({ value, onRename, existingNames }: Props) {
  const [localValue, setLocalValue] = useState(value);
  const [error, setError] = useState<string | null>(null);

  const commit = () => {
    const trimmed = localValue.trim();
    if (!trimmed) {
      setLocalValue(value);
      setError(null);
      return;
    }
    if (trimmed === value) {
      setError(null);
      return;
    }
    if (existingNames?.has(trimmed)) {
      setError("Name already in use");
      return;
    }
    setError(null);
    onRename(trimmed);
  };

  const cancel = () => {
    setLocalValue(value);
    setError(null);
  };

  return (
    <div className="flex flex-col">
      <input
        value={localValue}
        onClick={(e) => e.stopPropagation()}
        onChange={(e) => setLocalValue(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.currentTarget.blur();
          } else if (e.key === "Escape") {
            cancel();
            e.currentTarget.blur();
          }
        }}
        aria-invalid={error !== null}
        aria-label="Group name"
        className={cn(
          "text-sm lg:text-base font-semibold text-black bg-transparent outline-none border-b border-dashed",
          error ? "border-destructive" : "border-cobalt/40 focus:border-cobalt",
        )}
        placeholder="Group name"
      />
      {error && (
        <span className="text-[10px] text-destructive mt-0.5">{error}</span>
      )}
    </div>
  );
}
