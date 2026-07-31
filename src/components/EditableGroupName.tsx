"use client";

import { useState } from "react";

export function EditableGroupName({ value, onRename }: { value: string; onRename: (newName: string) => void }) {
  const [localValue, setLocalValue] = useState(value);

  const commit = () => {
    if (localValue.trim() && localValue.trim() !== value) {
      onRename(localValue);
    } else {
      setLocalValue(value);
    }
  };

  return (
    <input
      value={localValue}
      onClick={(e) => e.stopPropagation()}
      onChange={(e) => setLocalValue(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => { if (e.key === "Enter") { e.currentTarget.blur(); } }}
      className="text-sm lg:text-base font-semibold text-black bg-transparent outline-none border-b border-dashed border-cobalt/40 focus:border-cobalt"
      placeholder="Group name"
    />
  );
}
