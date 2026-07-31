"use client";

import { useEffect, useState, useMemo, useCallback } from "react";
import { useAppStore } from "@/store";
import { loadTemplates } from "@/lib/data";
import { PageLayout } from "@/components/PageLayout";
import { CategoryLabel } from "@/components/CategoryLabel";
import { EditableGroupName } from "@/components/EditableGroupName";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { ChevronDown, Search, CirclePlus } from "lucide-react";
import {
  toggleGroup as toggleGroupHelper,
  toggleAllInGroup as toggleAllInGroupHelper,
  renameGroupItems,
  addItemAndScroll,
} from "@/lib/groupHelpers";
import type { SelectedTemplate } from "@/types";

export default function TemplatesPage() {
  const templates = useAppStore((s) => s.templates);
  const setTemplates = useAppStore((s) => s.setTemplates);
  const toggleTemplate = useAppStore((s) => s.toggleTemplate);
  const setTemplatesSelection = useAppStore((s) => s.setTemplatesSelection);
  const setAdditionalPages = useAppStore((s) => s.setAdditionalPages);
  const addTemplate = useAppStore((s) => s.addTemplate);
  const updateTemplate = useAppStore((s) => s.updateTemplate);
  const useAiEstimation = useAppStore((s) => s.useAiEstimation);
  const toggleAiEstimation = useAppStore((s) => s.toggleAiEstimation);

  const [search, setSearch] = useState("");
  const [openGroups, setOpenGroups] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(templates.length === 0);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (templates.length === 0) {
      loadTemplates()
        .then((data) => {
          const selected: SelectedTemplate[] = data.map((t) => ({
            ...t,
            isSelected: false,
            additionalPages: 0,
          }));
          setTemplates(selected);
        })
        .catch(() => setError("Failed to load templates. Please refresh the page."))
        .finally(() => setLoading(false));
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

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

  const toggleGroup = useCallback((group: string) => toggleGroupHelper(group, setOpenGroups), []);
  const toggleAllInGroup = useCallback((group: string) => toggleAllInGroupHelper(group, grouped, setTemplatesSelection), [grouped, setTemplatesSelection]);

  const handleAddTemplateGroup = useCallback(() => {
    const existingGroups = new Set(templates.map((t) => t.name));
    let name = "New Template";
    let counter = 2;
    while (existingGroups.has(name)) {
      name = `New Template ${counter}`;
      counter++;
    }
    addItemAndScroll(() => addTemplate(name), name, setOpenGroups);
  }, [templates, addTemplate]);

  const renameGroup = useCallback(
    (oldName: string, newName: string) =>
      renameGroupItems(oldName, newName, templates, "name", updateTemplate, setOpenGroups),
    [templates, updateTemplate]
  );

  const isCustomGroup = (items: SelectedTemplate[]) =>
    items.every((t) => t.isCustom);

  return (
    <PageLayout>
        <div className="bg-white rounded-2xl lg:rounded-[40px] p-4 md:p-6 lg:p-8">
            {/* Toolbar */}
            <div className="flex flex-col gap-4 mb-8 lg:mb-10">
              <div className="flex flex-wrap items-center gap-4">
                <h2 className="text-xl md:text-2xl lg:text-[30px] font-semibold text-black mr-auto">
                  Templates List
                </h2>
                <label className="flex items-center gap-2 text-sm lg:text-base text-black cursor-pointer whitespace-nowrap">
                  <Checkbox
                    className="w-4.5 h-4.5 rounded-[5px] border-dark-background"
                    checked={useAiEstimation}
                    onCheckedChange={toggleAiEstimation}
                  />
                  Activate AI-Powered Estimation
                </label>
                <button
                  onClick={handleAddTemplateGroup}
                  className="flex items-center gap-2.5 px-5 py-3 rounded-full bg-cobalt text-white text-base font-medium hover:bg-cobalt/90 transition-colors whitespace-nowrap"
                >
                  Add template
                  <CirclePlus className="w-5 h-5" />
                </button>
                <div className="relative w-full sm:w-auto">
                  <Input
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Search for template"
                    className="h-12 lg:h-15 rounded-full pl-5 pr-12 text-sm lg:text-base border-strokes bg-white w-full sm:w-55"
                  />
                  <Search className="absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 text-placeholder-text" />
                </div>
              </div>
            </div>

            {/* Loading / Error / Empty States */}
            {loading && (
              <div className="p-8 text-center text-sm text-light-grey-text">Loading templates…</div>
            )}
            {error && (
              <div className="p-8 text-center text-sm text-red-600">{error}</div>
            )}

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
                      {isCustomGroup(items) ? (
                        <EditableGroupName value={group} onRename={(newName) => renameGroup(group, newName)} />
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
                          <div className="flex items-center gap-3 px-4 py-4 w-50 shrink-0">
                            <Checkbox
                              checked={allSelected}
                              onCheckedChange={() => toggleAllInGroup(group)}
                              className="w-4.5 h-4.5 rounded-[5px] border-dark-background"
                            />
                            <span>Variant</span>
                          </div>
                          <div className="px-4 py-4 w-22.5 shrink-0">Category</div>
                          <div className="px-4 py-4 w-50 shrink-0">Template Description</div>
                          <div className="px-4 py-4 w-25 shrink-0">Design Effort</div>
                          <div className="px-4 py-4 w-30 shrink-0">Additional effort per page</div>
                          <div className="px-4 py-4 w-25 shrink-0">Dev Effort</div>
                          <div className="px-4 py-4 w-30 shrink-0">Additional effort per page</div>
                          <div className="px-4 py-4 w-25 shrink-0">Additional Pages</div>
                        </div>

                        {/* Rows */}
                        {items.map((template) => (
                          <TemplateRow
                            key={template.id}
                            template={template}
                            onToggle={() => toggleTemplate(template.id)}
                            onSetPages={(pages) => setAdditionalPages(template.id, pages)}
                            onUpdate={(updates) => updateTemplate(template.id, updates)}
                          />
                        ))}

                        {/* Add Row CTA */}
                        <div className="flex justify-end px-4 py-3">
                          <button
                            onClick={() => addTemplate(group)}
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

              {grouped.size === 0 && (
                <div className="p-8 text-center text-sm text-light-grey-text">
                  No templates found.
                </div>
              )}
            </div>
          </div>
    </PageLayout>
  );
}

function TemplateRow({
  template,
  onToggle,
  onSetPages,
  onUpdate,
}: {
  template: SelectedTemplate;
  onToggle: () => void;
  onSetPages: (pages: number) => void;
  onUpdate: (updates: Partial<SelectedTemplate>) => void;
}) {
  const isEditable = !!template.isCustom;

  return (
    <div className="border-b border-strokes/50 last:border-b-0">
      {/* Desktop row */}
      <div className="hidden lg:flex min-w-max items-stretch text-xs text-black">
        <div className="flex items-start gap-3 px-4 py-3 w-50 shrink-0 border-r border-strokes/50">
          <Checkbox
            checked={template.isSelected}
            onCheckedChange={onToggle}
            className="w-4.5 h-4.5 rounded-[5px] border-dark-background mt-0.5"
          />
          {isEditable ? (
            <input
              value={template.description}
              onChange={(e) => onUpdate({ description: e.target.value })}
              placeholder="Variant name"
              className="leading-snug font-medium bg-transparent outline-none w-full placeholder:text-gray-400"
            />
          ) : (
            <span className="leading-snug font-medium">{template.description}</span>
          )}
        </div>
        <div className="flex items-start px-4 py-3 w-22.5 shrink-0 border-r border-strokes/50">
          {isEditable ? (
            <input
              value={template.category}
              onChange={(e) => onUpdate({ category: e.target.value })}
              placeholder="Category"
              className="leading-snug bg-transparent outline-none w-full placeholder:text-gray-400"
            />
          ) : (
            <CategoryLabel category={template.category} />
          )}
        </div>
        <div className="flex items-start px-4 py-3 w-50 shrink-0 border-r border-strokes/50 leading-snug">
          {isEditable ? (
            <input
              value={template.description}
              onChange={(e) => onUpdate({ description: e.target.value })}
              placeholder="Template description"
              className="bg-transparent outline-none w-full placeholder:text-gray-400"
            />
          ) : (
            template.description
          )}
        </div>
        <div className="flex items-start px-4 py-3 w-25 shrink-0 border-r border-strokes/50">
          {isEditable ? (
            <input
              type="number"
              min={0}
              value={template.designEffortBase}
              onChange={(e) => onUpdate({ designEffortBase: Number(e.target.value) || 0 })}
              className="bg-transparent outline-none w-full placeholder:text-gray-400"
            />
          ) : (
            <>{template.designEffortBase}h</>
          )}
        </div>
        <div className="flex items-start px-4 py-3 w-30 shrink-0 border-r border-strokes/50">
          {isEditable ? (
            <input
              type="number"
              min={0}
              value={template.designEffortPerPage}
              onChange={(e) => onUpdate({ designEffortPerPage: Number(e.target.value) || 0 })}
              className="bg-transparent outline-none w-full placeholder:text-gray-400"
            />
          ) : (
            <>{template.designEffortPerPage}h</>
          )}
        </div>
        <div className="flex items-start px-4 py-3 w-25 shrink-0 border-r border-strokes/50">
          {isEditable ? (
            <input
              type="number"
              min={0}
              value={template.devEffortBase}
              onChange={(e) => onUpdate({ devEffortBase: Number(e.target.value) || 0 })}
              className="bg-transparent outline-none w-full placeholder:text-gray-400"
            />
          ) : (
            <>{template.devEffortBase}h</>
          )}
        </div>
        <div className="flex items-start px-4 py-3 w-30 shrink-0 border-r border-strokes/50">
          {isEditable ? (
            <input
              type="number"
              min={0}
              value={template.devEffortPerPage}
              onChange={(e) => onUpdate({ devEffortPerPage: Number(e.target.value) || 0 })}
              className="bg-transparent outline-none w-full placeholder:text-gray-400"
            />
          ) : (
            <>{template.devEffortPerPage}h</>
          )}
        </div>
        <div className="flex items-center px-4 py-3 w-25 shrink-0">
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
          className="w-4.5 h-4.5 rounded-[5px] border-dark-background mt-1 shrink-0"
        />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            {isEditable ? (
              <input
                value={template.description}
                onChange={(e) => onUpdate({ description: e.target.value })}
                placeholder="Template name"
                className="text-sm font-medium text-black bg-transparent outline-none w-full placeholder:text-gray-400"
              />
            ) : (
              <p className="text-sm font-medium text-black truncate">{template.description}</p>
            )}
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
