"use client";

import { useEffect, useState, useMemo } from "react";
import { useAppStore } from "@/store";
import { loadComponents } from "@/lib/data";
import { AppHeader } from "@/components/AppHeader";
import { EstimationPanel } from "@/components/EstimationPanel";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { ChevronDown, Search, CirclePlus } from "lucide-react";
import { SvgIcon } from "@/components/SvgIcon";
import type { SelectedComponent } from "@/types";

export default function ComponentsPage() {
  const components = useAppStore((s) => s.components);
  const setComponents = useAppStore((s) => s.setComponents);
  const toggleComponent = useAppStore((s) => s.toggleComponent);
  const addComponent = useAppStore((s) => s.addComponent);
  const updateComponent = useAppStore((s) => s.updateComponent);

  const [search, setSearch] = useState("");
  const [openGroups, setOpenGroups] = useState<Set<string>>(new Set());

  // Load data on mount
  useEffect(() => {
    if (components.length === 0) {
      loadComponents().then((data) => {
        const selected: SelectedComponent[] = data.map((c) => ({
          ...c,
          isSelected: false,
        }));
        setComponents(selected);
      });
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Group by group field
  const grouped = useMemo(() => {
    const map = new Map<string, SelectedComponent[]>();
    const filtered = components.filter(
      (c) =>
        c.name.toLowerCase().includes(search.toLowerCase()) ||
        c.group.toLowerCase().includes(search.toLowerCase()) ||
        c.designDescription.toLowerCase().includes(search.toLowerCase()) ||
        c.developmentDescription.toLowerCase().includes(search.toLowerCase())
    );
    for (const c of filtered) {
      const group = c.group || "Other";
      if (!map.has(group)) map.set(group, []);
      map.get(group)!.push(c);
    }
    return map;
  }, [components, search]);

  const toggleGroup = (group: string) => {
    setOpenGroups((prev) => {
      const next = new Set(prev);
      if (next.has(group)) next.delete(group);
      else next.add(group);
      return next;
    });
  };

  const toggleAllInGroup = (group: string) => {
    const items = grouped.get(group);
    if (!items) return;
    const allSelected = items.every((c) => c.isSelected);
    for (const item of items) {
      if (allSelected && item.isSelected) toggleComponent(item.id);
      if (!allSelected && !item.isSelected) toggleComponent(item.id);
    }
  };

  const toggleAllOnPage = () => {
    const allSelected = components.every((c) => c.isSelected);
    for (const item of components) {
      if (allSelected && item.isSelected) toggleComponent(item.id);
      if (!allSelected && !item.isSelected) toggleComponent(item.id);
    }
  };

  const handleAddComponentGroup = () => {
    const existingGroups = new Set(components.map((c) => c.group));
    let name = "New Component";
    let counter = 2;
    while (existingGroups.has(name)) {
      name = `New Component ${counter}`;
      counter++;
    }
    addComponent(name);
    setOpenGroups((prev) => new Set(prev).add(name));
    setTimeout(() => window.scrollTo({ top: document.body.scrollHeight, behavior: "smooth" }), 100);
  };

  const renameGroup = (oldName: string, newName: string) => {
    const trimmed = newName.trim();
    if (!trimmed || trimmed === oldName) return;
    const existingGroups = new Set(components.map((c) => c.group));
    if (existingGroups.has(trimmed)) return;
    for (const c of components) {
      if (c.group === oldName) {
        updateComponent(c.id, { group: trimmed });
      }
    }
    setOpenGroups((prev) => {
      const next = new Set(prev);
      if (next.has(oldName)) {
        next.delete(oldName);
        next.add(trimmed);
      }
      return next;
    });
  };

  const isCustomGroup = (items: SelectedComponent[]) =>
    items.every((c) => c.assumptions === "__custom__");

  return (
    <div className="min-h-screen bg-background-blue flex flex-col">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-0 flex-1">
      {/* Left: Content - 8 columns */}
      <div className="lg:col-span-8 min-w-0">
        <AppHeader />
        <div className="px-4 md:px-8 lg:px-15 py-6 lg:py-10">
          <div className="bg-white rounded-2xl lg:rounded-[40px] p-4 md:p-6 lg:p-8">
            {/* Toolbar */}
            <div className="flex flex-col gap-4 mb-8 lg:mb-10">
              <div className="flex flex-wrap items-center gap-4">
                <h2 className="text-xl md:text-2xl lg:text-[30px] font-semibold text-black mr-auto">
                  Components List
                </h2>
                <label className="flex items-center gap-2 text-sm lg:text-base text-black cursor-pointer">
                  <Checkbox
                    className="w-4.5 h-4.5 rounded-[5px] border-dark-background"
                    checked={components.length > 0 && components.every((c) => c.isSelected)}
                    onCheckedChange={toggleAllOnPage}
                  />
                </label>
                <span className="text-sm lg:text-base text-black whitespace-nowrap">Activate AI-Powered Estimation</span>
                <button
                  onClick={handleAddComponentGroup}
                  className="flex items-center gap-2.5 px-5 py-3 rounded-full bg-cobalt text-white text-base font-medium hover:bg-cobalt/90 transition-colors whitespace-nowrap"
                >
                  Add component
                  <CirclePlus className="w-5 h-5" />
                </button>
                <div className="relative w-full sm:w-auto">
                  <Input
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Search for component"
                    className="h-12 lg:h-15 rounded-full pl-5 pr-12 text-sm lg:text-base border-strokes bg-white w-full sm:w-55"
                  />
                  <Search className="absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 text-placeholder-text" />
                </div>
              </div>
            </div>

            {/* Accordion Groups */}
            <div className="flex flex-col gap-5">
              {Array.from(grouped.entries()).map(([group, items]) => {
                const isOpen = openGroups.has(group);
                const allSelected = items.every((c) => c.isSelected);

                return (
                  <div key={group}>
                    {/* Accordion Header */}
                    <button
                      onClick={() => toggleGroup(group)}
                      className={`flex items-center justify-between w-full px-5 py-4 lg:py-5 bg-[#e3e7ef] transition-all ${
                        isOpen
                          ? "rounded-t-2xl"
                          : "rounded-full"
                      }`}
                    >
                      {isCustomGroup(items) ? (
                        <input
                          value={group}
                          onClick={(e) => e.stopPropagation()}
                          onChange={(e) => renameGroup(group, e.target.value)}
                          className="text-sm lg:text-base font-semibold text-black bg-transparent outline-none border-b border-dashed border-cobalt/40 focus:border-cobalt"
                          placeholder="Group name"
                        />
                      ) : (
                        <span className="text-sm lg:text-base font-semibold text-black">
                          {group}
                        </span>
                      )}
                      <ChevronDown
                        className={`w-5 h-5 text-black transition-transform ${
                          isOpen ? "rotate-180" : ""
                        }`}
                      />
                    </button>

                    {/* Accordion Content */}
                    {isOpen && (
                      <div className="accordion-scroll border border-t-0 border-strokes/50 rounded-b-2xl overflow-x-auto">
                        <div className="min-w-max">
                        {/* Table Header */}
                        <div className="hidden lg:flex min-w-max bg-background-blue text-sm font-semibold text-black">
                          <div className="flex items-center gap-3 px-4 py-4 w-55 shrink-0">
                            <Checkbox
                              checked={allSelected}
                              onCheckedChange={() => toggleAllInGroup(group)}
                              className="w-4.5 h-4.5 rounded-[5px] border-dark-background"
                            />
                            <span>Variant</span>
                          </div>
                          <div className="px-4 py-4 w-25 shrink-0">Category</div>
                          <div className="px-4 py-4 w-50 shrink-0">Design</div>
                          <div className="px-4 py-4 w-50 shrink-0">Development</div>
                          <div className="px-4 py-4 w-25 shrink-0">Design Effort</div>
                          <div className="px-4 py-4 w-25 shrink-0">Dev Effort</div>
                        </div>

                        {/* Rows */}
                        {items.map((component) => (
                          <ComponentRow
                            key={component.id}
                            component={component}
                            onToggle={() => toggleComponent(component.id)}
                            onUpdate={(updates) => updateComponent(component.id, updates)}
                          />
                        ))}

                        {/* Add Row CTA */}
                        <div className="flex justify-end px-4 py-3">
                          <button
                            onClick={() => addComponent(group)}
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
        </div>

      </div>

      {/* Right: Estimation Panel - 4 columns */}
      <div className="px-4 pb-4 md:px-6 md:pb-6 lg:col-span-4 lg:p-5 lg:pl-0 lg:sticky lg:top-0 lg:h-screen lg:self-start">
        <EstimationPanel />
      </div>
      </div>
    </div>
  );
}

function ComponentRow({
  component,
  onToggle,
  onUpdate,
}: {
  component: SelectedComponent;
  onToggle: () => void;
  onUpdate: (updates: Partial<SelectedComponent>) => void;
}) {
  const isCustom = !component.name && !component.designDescription && !component.developmentDescription && component.designEffort === 0 && component.devEffort === 0;
  const isEditable = isCustom || component.assumptions === "__custom__";

  return (
    <div className="border-b border-strokes/50 last:border-b-0">
      {/* Desktop row */}
      <div className="hidden lg:flex min-w-max items-stretch text-xs text-black">
        <div className="flex items-start gap-3 px-4 py-3 w-55 shrink-0 border-r border-strokes/50">
          <Checkbox
            checked={component.isSelected}
            onCheckedChange={onToggle}
            className="w-4.5 h-4.5 rounded-[5px] border-dark-background mt-0.5"
          />
          {isEditable ? (
            <input
              value={component.name}
              onChange={(e) => onUpdate({ name: e.target.value })}
              placeholder="Variant name"
              className="leading-snug bg-transparent outline-none w-full placeholder:text-gray-400"
            />
          ) : (
            <span className="leading-snug">{component.name}</span>
          )}
        </div>
        <div className="flex items-start px-4 py-3 w-25 shrink-0 border-r border-strokes/50">
          {isEditable ? (
            <input
              value={component.category}
              onChange={(e) => onUpdate({ category: e.target.value })}
              placeholder="Category"
              className="leading-snug bg-transparent outline-none w-full placeholder:text-gray-400"
            />
          ) : (
            <CategoryLabel category={component.category} />
          )}
        </div>
        <div className="flex items-start px-4 py-3 w-50 shrink-0 border-r border-strokes/50 leading-snug">
          {isEditable ? (
            <input
              value={component.designDescription}
              onChange={(e) => onUpdate({ designDescription: e.target.value })}
              placeholder="Design description"
              className="bg-transparent outline-none w-full placeholder:text-gray-400"
            />
          ) : (
            component.designDescription
          )}
        </div>
        <div className="flex items-start px-4 py-3 w-50 shrink-0 border-r border-strokes/50 leading-snug">
          {isEditable ? (
            <input
              value={component.developmentDescription}
              onChange={(e) => onUpdate({ developmentDescription: e.target.value })}
              placeholder="Development description"
              className="bg-transparent outline-none w-full placeholder:text-gray-400"
            />
          ) : (
            component.developmentDescription
          )}
        </div>
        <div className="flex items-start px-4 py-3 w-25 shrink-0 border-r border-strokes/50">
          {isEditable ? (
            <input
              type="number"
              min={0}
              value={component.designEffort}
              onChange={(e) => onUpdate({ designEffort: Number(e.target.value) || 0 })}
              className="bg-transparent outline-none w-full placeholder:text-gray-400"
            />
          ) : (
            <>{component.designEffort}h</>
          )}
        </div>
        <div className="flex items-start px-4 py-3 w-25 shrink-0">
          {isEditable ? (
            <input
              type="number"
              min={0}
              value={component.devEffort}
              onChange={(e) => onUpdate({ devEffort: Number(e.target.value) || 0 })}
              className="bg-transparent outline-none w-full placeholder:text-gray-400"
            />
          ) : (
            <>{component.devEffort}h</>
          )}
        </div>
      </div>

      {/* Mobile card */}
      <div className="lg:hidden p-4 flex gap-3">
        <Checkbox
          checked={component.isSelected}
          onCheckedChange={onToggle}
          className="w-4.5 h-4.5 rounded-[5px] border-dark-background mt-1 shrink-0"
        />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            {isEditable ? (
              <input
                value={component.name}
                onChange={(e) => onUpdate({ name: e.target.value })}
                placeholder="Variant name"
                className="text-sm font-medium text-black bg-transparent outline-none w-full placeholder:text-gray-400"
              />
            ) : (
              <p className="text-sm font-medium text-black truncate">{component.name}</p>
            )}
            <CategoryLabel category={component.category} />
          </div>
          {isEditable ? (
            <input
              value={component.designDescription}
              onChange={(e) => onUpdate({ designDescription: e.target.value })}
              placeholder="Design description"
              className="text-xs text-light-grey-text mb-2 bg-transparent outline-none w-full placeholder:text-gray-400"
            />
          ) : (
            <p className="text-xs text-light-grey-text line-clamp-2 mb-2">
              {component.designDescription}
            </p>
          )}
          <div className="flex gap-4 text-xs text-black">
            {isEditable ? (
              <>
                <label className="flex items-center gap-1">Design: <input type="number" min={0} value={component.designEffort} onChange={(e) => onUpdate({ designEffort: Number(e.target.value) || 0 })} className="w-12 bg-transparent outline-none" />h</label>
                <label className="flex items-center gap-1">Dev: <input type="number" min={0} value={component.devEffort} onChange={(e) => onUpdate({ devEffort: Number(e.target.value) || 0 })} className="w-12 bg-transparent outline-none" />h</label>
              </>
            ) : (
              <>
                <span>Design: {component.designEffort}h</span>
                <span>Dev: {component.devEffort}h</span>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function CategoryLabel({ category }: { category: string }) {
  if (!category) return null;

  const isCore = category.toLowerCase() === "core";
  return (
    <span
      className={`inline-flex items-center gap-1.5 p-2 rounded-full text-xs whitespace-nowrap ${
        isCore
          ? "bg-[#f4e4e7] text-black"
          : "bg-[#e4ecf4] text-black"
      }`}
    >
      {isCore && (
        <SvgIcon name="heart" width={12} height={12} className="text-red-500" />
      )}
      {category}
    </span>
  );
}
