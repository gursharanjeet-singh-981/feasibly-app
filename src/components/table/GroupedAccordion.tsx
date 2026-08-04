"use client";

import { ReactNode } from "react";
import { ChevronDown, CirclePlus, Search } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { EditableGroupName } from "@/components/EditableGroupName";
import { cn } from "@/lib/utils";

const CHECKBOX_BASE = "w-4.5 h-4.5 rounded-[5px] border-dark-background";
const CTA_PILL =
  "flex items-center gap-2.5 px-5 py-3 rounded-full bg-cobalt text-white text-base font-medium hover:bg-cobalt/90 transition-colors whitespace-nowrap";

interface GroupedAccordionProps<T extends { id: number; isSelected: boolean }> {
  title: string;
  addLabel: string;
  searchPlaceholder: string;
  useAiEstimation: boolean;
  onToggleAi: () => void;
  onAddGroup: () => void;
  search: string;
  onSearchChange: (value: string) => void;
  loading: boolean;
  error: string | null;
  grouped: Map<string, T[]>;
  emptyLabel: string;
  openGroups: Set<string>;
  onToggleGroup: (group: string) => void;
  onToggleAllInGroup: (group: string) => void;
  onRenameGroup: (oldName: string, newName: string) => void;
  isCustomGroup: (items: T[]) => boolean;
  onAddRow: (group: string) => void;
  renderHeader: (args: { allSelected: boolean; onToggleAll: () => void; group: string }) => ReactNode;
  renderRow: (item: T) => ReactNode;
}

export function GroupedAccordion<T extends { id: number; isSelected: boolean }>(
  props: GroupedAccordionProps<T>,
) {
  const {
    title,
    addLabel,
    searchPlaceholder,
    useAiEstimation,
    onToggleAi,
    onAddGroup,
    search,
    onSearchChange,
    loading,
    error,
    grouped,
    emptyLabel,
    openGroups,
    onToggleGroup,
    onToggleAllInGroup,
    onRenameGroup,
    isCustomGroup,
    onAddRow,
    renderHeader,
    renderRow,
  } = props;

  return (
    <div className="bg-white rounded-2xl lg:rounded-[40px] p-4 md:p-6 lg:p-8">
      <div className="flex flex-col gap-4 mb-8 lg:mb-10">
        <div className="flex flex-wrap items-center gap-4">
          <h2 className="text-xl md:text-2xl lg:text-[30px] font-semibold text-black mr-auto">
            {title}
          </h2>
          <label className="flex items-center gap-2 text-sm lg:text-base text-black cursor-pointer whitespace-nowrap">
            <Checkbox
              className={CHECKBOX_BASE}
              checked={useAiEstimation}
              onCheckedChange={onToggleAi}
            />
            Activate AI-Powered Estimation
          </label>
          <button onClick={onAddGroup} className={CTA_PILL}>
            {addLabel}
            <CirclePlus className="w-5 h-5" />
          </button>
          <div className="relative w-full sm:w-auto">
            <Input
              value={search}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder={searchPlaceholder}
              className="h-12 lg:h-15 rounded-full pl-5 pr-12 text-sm lg:text-base border-strokes bg-white w-full sm:w-55"
            />
            <Search className="absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 text-placeholder-text" />
          </div>
        </div>
      </div>

      {loading && (
        <div className="p-8 text-center text-sm text-light-grey-text">
          Loading…
        </div>
      )}
      {error && (
        <div className="p-8 text-center text-sm text-red-600">{error}</div>
      )}
      {!loading && !error && grouped.size === 0 && (
        <div className="p-8 text-center text-sm text-light-grey-text">
          {emptyLabel}
        </div>
      )}

      <div className="flex flex-col gap-5">
        {Array.from(grouped.entries()).map(([group, items]) => {
          const isOpen = openGroups.has(group);
          const allSelected = items.every((i) => i.isSelected);
          const contentId = `accordion-${group.replace(/\s+/g, "-")}`;

          return (
            <div key={group}>
              <button
                type="button"
                onClick={() => onToggleGroup(group)}
                aria-expanded={isOpen}
                aria-controls={contentId}
                className={cn(
                  "flex items-center justify-between w-full px-5 py-4 lg:py-5 bg-surface-muted transition-all",
                  isOpen ? "rounded-t-2xl" : "rounded-full",
                )}
              >
                {isCustomGroup(items) ? (
                  <EditableGroupName
                    value={group}
                    onRename={(newName) => onRenameGroup(group, newName)}
                    existingNames={
                      new Set(Array.from(grouped.keys()).filter((g) => g !== group))
                    }
                  />
                ) : (
                  <span className="text-sm lg:text-base font-semibold text-black">
                    {group}
                  </span>
                )}
                <ChevronDown
                  aria-hidden
                  className={cn(
                    "w-5 h-5 text-black transition-transform",
                    isOpen && "rotate-180",
                  )}
                />
              </button>

              {isOpen && (
                <div
                  id={contentId}
                  className="accordion-scroll border border-t-0 border-strokes/50 rounded-b-2xl overflow-x-auto"
                >
                  <div className="min-w-max">
                    <div className="hidden lg:flex min-w-max bg-background-blue text-sm font-semibold text-black">
                      {renderHeader({
                        allSelected,
                        onToggleAll: () => onToggleAllInGroup(group),
                        group,
                      })}
                    </div>

                    {items.map(renderRow)}

                    <div className="flex justify-end px-4 py-3">
                      <button
                        onClick={() => onAddRow(group)}
                        className="flex items-center justify-center w-9 h-9 rounded-full bg-cobalt text-white hover:bg-cobalt/90 transition-colors"
                        aria-label="Add new row"
                      >
                        <CirclePlus className="w-5 h-5" />
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
