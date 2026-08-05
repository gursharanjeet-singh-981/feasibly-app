import { SvgIcon } from "@/components/SvgIcon";

export function CategoryLabel({ category }: { category: string }) {
  if (!category) return null;

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
      {category}
    </span>
  );
}
