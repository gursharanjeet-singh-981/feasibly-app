import { SvgIcon } from "@/components/SvgIcon";

export function CategoryLabel({
  category,
  onChange,
}: {
  category: string;
  onChange?: (value: string) => void;
}) {
  if (!category && !onChange) return null;

  const isCore = category.toLowerCase() === "core";
  return (
    <span
      className={`inline-flex items-center gap-1.5 p-2 rounded-full text-xs whitespace-nowrap ${
        isCore ? "bg-category-core-bg text-black" : "bg-category-default-bg text-black"
      }`}
    >
      {isCore && (
        <SvgIcon name="heart" width={12} height={12} className="text-red-500" />
      )}
      {onChange ? (
        <input
          value={category}
          onChange={(event) => onChange(event.target.value)}
          placeholder="Category"
          aria-label="Category"
          size={category ? category.length : 8}
          className="min-w-0 bg-transparent outline-none focus-visible:ring-1 focus-visible:ring-cobalt/30 rounded"
        />
      ) : (
        category
      )}
    </span>
  );
}
