"use client";

import { useEffect, useState, useMemo } from "react";
import { useAppStore } from "@/store";
import { loadTemplates } from "@/lib/data";
import { AppHeader } from "@/components/AppHeader";
import { EstimationPanel } from "@/components/EstimationPanel";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { ChevronDown, Search, CirclePlus } from "lucide-react";
import { SvgIcon } from "@/components/SvgIcon";
import type { SelectedTemplate } from "@/types";

export default function TemplatesPage() {
  const templates = useAppStore((s) => s.templates);
  const setTemplates = useAppStore((s) => s.setTemplates);
  const toggleTemplate = useAppStore((s) => s.toggleTemplate);
  const setAdditionalPages = useAppStore((s) => s.setAdditionalPages);

  const [search, setSearch] = useState("");
  const [openGroups, setOpenGroups] = useState<Set<string>>(new Set());

  // Load data on mount
  useEffect(() => {
    if (templates.length === 0) {
      loadTemplates().then((data) => {
        const selected: SelectedTemplate[] = data.map((t) => ({
          ...t,
          isSelected: false,
          additionalPages: 0,
        }));
        setTemplates(selected);
      });
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Group by template name
  const grouped = useMemo(() => {
    const map = new Map<string, SelectedTemplate[]>();
    const filtered = templates.filter(
      (t) =>
        t.name.toLowerCase().includes(search.toLowerCase()) ||
        t.description.toLowerCase().includes(search.toLowerCase()) ||
        t.category.toLowerCase().includes(search.toLowerCase())
    );
    for (const t of filtered) {
      const group = t.name;
      if (!map.has(group)) map.set(group, []);
      map.get(group)!.push(t);
    }
    return map;
  }, [templates, search]);

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
    const allSelected = items.every((t) => t.isSelected);
    for (const item of items) {
      if (allSelected && item.isSelected) toggleTemplate(item.id);
      if (!allSelected && !item.isSelected) toggleTemplate(item.id);
    }
  };

  const toggleAllOnPage = () => {
    const allSelected = templates.every((t) => t.isSelected);
    for (const item of templates) {
      if (allSelected && item.isSelected) toggleTemplate(item.id);
      if (!allSelected && !item.isSelected) toggleTemplate(item.id);
    }
  };

  return (
    <div className="min-h-screen bg-background-blue">
      <AppHeader />

      <div className="flex flex-col lg:flex-row gap-6 lg:gap-8 px-4 md:px-8 lg:px-[60px] py-6 lg:py-10">
        {/* Left: Template List */}
        <div className="flex-1 min-w-0">
          <div className="bg-white rounded-2xl lg:rounded-[40px] p-4 md:p-6 lg:p-8">
            {/* Toolbar */}
            <div className="flex flex-col gap-4 mb-8 lg:mb-10">
              <div className="flex flex-wrap items-center gap-4">
                <h2 className="text-xl md:text-2xl lg:text-[30px] font-semibold text-black mr-auto">
                  Templates List
                </h2>
                <label className="flex items-center gap-2 text-sm lg:text-base text-black cursor-pointer">
                  <Checkbox
                    className="w-[18px] h-[18px] rounded-[5px] border-dark-background"
                    checked={templates.length > 0 && templates.every((t) => t.isSelected)}
                    onCheckedChange={toggleAllOnPage}
                  />
                </label>
                <span className="text-sm lg:text-base text-black whitespace-nowrap">Activate AI-Powered Estimation</span>
                <button className="flex items-center gap-2.5 px-5 py-3 rounded-full bg-cobalt text-white text-base font-medium hover:bg-cobalt/90 transition-colors whitespace-nowrap">
                  Add template
                  <CirclePlus className="w-5 h-5" />
                </button>
                <div className="relative w-full sm:w-auto">
                  <Input
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Search for template"
                    className="h-12 lg:h-[60px] rounded-full pl-5 pr-12 text-sm lg:text-base border-strokes bg-white w-full sm:w-[220px]"
                  />
                  <Search className="absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 text-placeholder-text" />
                </div>
              </div>
            </div>

            {/* Accordion Groups */}
            <div className="flex flex-col gap-5">
              {Array.from(grouped.entries()).map(([group, items]) => {
                const isOpen = openGroups.has(group);
                const allSelected = items.every((t) => t.isSelected);

                return (
                  <div key={group}>
                    {/* Accordion Header */}
                    <button
                      onClick={() => toggleGroup(group)}
                      className={`flex items-center justify-between w-full px-5 py-4 lg:py-5 bg-[#e3e7ef] transition-all ${
                        isOpen ? "rounded-t-2xl" : "rounded-full"
                      }`}
                    >
                      <span className="text-sm lg:text-base font-semibold text-black">
                        {group}
                      </span>
                      <ChevronDown
                        className={`w-5 h-5 text-black transition-transform ${
                          isOpen ? "rotate-180" : ""
                        }`}
                      />
                    </button>

                    {/* Accordion Content */}
                    {isOpen && (
                      <div className="border border-t-0 border-strokes/50 rounded-b-2xl overflow-hidden">
                        {/* Table Header */}
                        <div className="hidden lg:flex bg-background-blue text-sm font-semibold text-black">
                          <div className="flex items-center gap-3 px-4 py-4 w-[200px] shrink-0">
                            <Checkbox
                              checked={allSelected}
                              onCheckedChange={() => toggleAllInGroup(group)}
                              className="w-[18px] h-[18px] rounded-[5px] border-dark-background"
                            />
                            <span>Variant</span>
                          </div>
                          <div className="px-4 py-4 w-[90px] shrink-0">Category</div>
                          <div className="px-4 py-4 flex-1 min-w-[140px]">Template Description</div>
                          <div className="px-4 py-4 w-[100px] shrink-0">Design Effort</div>
                          <div className="px-4 py-4 w-[120px] shrink-0">Additional effort per page</div>
                          <div className="px-4 py-4 w-[100px] shrink-0">Dev Effort</div>
                          <div className="px-4 py-4 w-[120px] shrink-0">Additional effort per page</div>
                          <div className="px-4 py-4 w-[100px] shrink-0">Additional Pages</div>
                        </div>

                        {/* Rows */}
                        {items.map((template) => (
                          <TemplateRow
                            key={template.id}
                            template={template}
                            onToggle={() => toggleTemplate(template.id)}
                            onSetPages={(pages) => setAdditionalPages(template.id, pages)}
                          />
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}

              {grouped.size === 0 && (
                <div className="p-8 text-center text-sm text-light-grey-text">
                  No templates found.
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Right: Estimation Panel */}
        <EstimationPanel />
      </div>
    </div>
  );
}

function TemplateRow({
  template,
  onToggle,
  onSetPages,
}: {
  template: SelectedTemplate;
  onToggle: () => void;
  onSetPages: (pages: number) => void;
}) {
  return (
    <div className="border-b border-strokes/50 last:border-b-0">
      {/* Desktop row */}
      <div className="hidden lg:flex items-stretch text-xs text-black">
        <div className="flex items-start gap-3 px-4 py-3 w-[200px] shrink-0 border-r border-strokes/50">
          <Checkbox
            checked={template.isSelected}
            onCheckedChange={onToggle}
            className="w-[18px] h-[18px] rounded-[5px] border-dark-background mt-0.5"
          />
          <span className="leading-snug font-medium">{template.description}</span>
        </div>
        <div className="flex items-start px-4 py-3 w-[90px] shrink-0 border-r border-strokes/50">
          <CategoryLabel category={template.category} />
        </div>
        <div className="flex items-start px-4 py-3 flex-1 min-w-[140px] border-r border-strokes/50 leading-snug">
          {template.description}
        </div>
        <div className="flex items-start px-4 py-3 w-[100px] shrink-0 border-r border-strokes/50">
          {template.designEffortBase}h
        </div>
        <div className="flex items-start px-4 py-3 w-[120px] shrink-0 border-r border-strokes/50">
          {template.designEffortPerPage}h
        </div>
        <div className="flex items-start px-4 py-3 w-[100px] shrink-0 border-r border-strokes/50">
          {template.devEffortBase}h
        </div>
        <div className="flex items-start px-4 py-3 w-[120px] shrink-0 border-r border-strokes/50">
          {template.devEffortPerPage}h
        </div>
        <div className="flex items-center px-4 py-3 w-[100px] shrink-0">
          <Input
            type="number"
            min={0}
            value={template.additionalPages}
            onChange={(e) => onSetPages(Math.max(0, parseInt(e.target.value) || 0))}
            className="h-8 w-16 rounded-lg text-center text-xs border-strokes"
          />
        </div>
      </div>

      {/* Mobile card */}
      <div className="lg:hidden p-4 flex gap-3">
        <Checkbox
          checked={template.isSelected}
          onCheckedChange={onToggle}
          className="w-[18px] h-[18px] rounded-[5px] border-dark-background mt-1 shrink-0"
        />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <p className="text-sm font-medium text-black truncate">{template.description}</p>
            <CategoryLabel category={template.category} />
          </div>
          <p className="text-xs text-light-grey-text line-clamp-2 mb-2">
            {template.description}
          </p>
          <div className="flex flex-wrap gap-3 text-xs text-black mb-2">
            <span>Design: {template.designEffortBase}h</span>
            <span>+{template.designEffortPerPage}h/pg</span>
            <span>Dev: {template.devEffortBase}h</span>
            <span>+{template.devEffortPerPage}h/pg</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-light-grey-text">Additional pages:</span>
            <Input
              type="number"
              min={0}
              value={template.additionalPages}
              onChange={(e) => onSetPages(Math.max(0, parseInt(e.target.value) || 0))}
              className="h-8 w-16 rounded-lg text-center text-xs border-strokes"
            />
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
      className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-[11px] whitespace-nowrap ${
        isCore ? "bg-[#f4e4e7] text-black" : "bg-[#e4ecf4] text-black"
      }`}
    >
      {isCore && (
        <SvgIcon name="heart" width={10} height={10} className="text-current" />
      )}
      {category}
    </span>
  );
}
