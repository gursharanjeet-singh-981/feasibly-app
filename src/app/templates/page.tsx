"use client";

import { useCallback, useEffect, useState } from "react";
import { Checkbox } from "@/components/ui/checkbox";
import { PageLayout } from "@/components/PageLayout";
import { GroupedAccordion } from "@/components/table/GroupedAccordion";
import { TemplateRow } from "@/components/table/TemplateRow";
import { ScanSummaryBanner } from "@/components/scan/ScanSummaryBanner";
import { useGroupedItems } from "@/hooks/useGroupedItems";
import { useAppStore } from "@/store";
import { loadTemplates } from "@/lib/data";
import {
  addItemAndScroll,
  renameGroupItems,
  toggleAllInGroup as toggleAllInGroupHelper,
  toggleGroup as toggleGroupHelper,
} from "@/lib/groupHelpers";
import { DEFAULT_TEMPLATE_GROUP } from "@/lib/constants";
import type { SelectedTemplate } from "@/types";

const CHECKBOX_BASE = "w-4.5 h-4.5 rounded-[5px] border-dark-background";

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
  const matchedTemplateIds = useAppStore((s) => s.scan.matchedTemplateIds);

  const [search, setSearch] = useState("");
  const [openGroups, setOpenGroups] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const loading = !error && templates.length === 0;

  useEffect(() => {
    if (templates.length > 0) return;
    let cancelled = false;
    loadTemplates()
      .then((data) => {
        if (cancelled) return;
        setTemplates(
          data.map<SelectedTemplate>((t) => ({
            ...t,
            isSelected: (matchedTemplateIds[t.id]?.confidence ?? 0) >= 0.5,
            additionalPages: 0,
            isCustom: false,
          })),
        );
      })
      .catch(() => {
        if (!cancelled) {
          setError("Failed to load templates. Please refresh the page.");
        }
      });
    return () => {
      cancelled = true;
    };
  }, [templates.length, setTemplates, matchedTemplateIds]);

  const getGroup = useCallback((t: SelectedTemplate) => t.name, []);
  const matchers = useCallback(
    (t: SelectedTemplate) => [t.name, t.description, t.category],
    [],
  );
  const grouped = useGroupedItems(templates, getGroup, search, matchers);

  const toggleGroup = useCallback(
    (group: string) => toggleGroupHelper(group, setOpenGroups),
    [],
  );
  const toggleAllInGroup = useCallback(
    (group: string) =>
      toggleAllInGroupHelper(group, grouped, setTemplatesSelection),
    [grouped, setTemplatesSelection],
  );

  const handleAddTemplateGroup = useCallback(() => {
    const existingGroups = new Set(templates.map((t) => t.name));
    let name = DEFAULT_TEMPLATE_GROUP;
    let counter = 2;
    while (existingGroups.has(name)) {
      name = `${DEFAULT_TEMPLATE_GROUP} ${counter}`;
      counter++;
    }
    addItemAndScroll(() => addTemplate(name), name, setOpenGroups);
  }, [templates, addTemplate]);

  const renameGroup = useCallback(
    (oldName: string, newName: string) =>
      renameGroupItems(
        oldName,
        newName,
        templates,
        "name",
        updateTemplate,
        setOpenGroups,
      ),
    [templates, updateTemplate],
  );

  const isCustomGroup = useCallback(
    (items: SelectedTemplate[]) => items.every((t) => t.isCustom === true),
    [],
  );

  const renderHeader = useCallback(
    ({
      allSelected,
      onToggleAll,
      group,
    }: {
      allSelected: boolean;
      onToggleAll: () => void;
      group: string;
    }) => (
      <>
        <div className="flex items-center gap-3 px-4 py-4 w-50 shrink-0">
          <Checkbox
            checked={allSelected}
            onCheckedChange={onToggleAll}
            className={CHECKBOX_BASE}
            aria-label={`Select all in ${group}`}
          />
          <span>Variant</span>
        </div>
        <div className="px-4 py-4 w-22.5 shrink-0">Category</div>
        <div className="px-4 py-4 w-50 shrink-0">Template Description</div>
        <div className="px-4 py-4 w-25 shrink-0">
          {useAiEstimation ? "AI Design Effort" : "Design Effort"}
        </div>
        <div className="px-4 py-4 w-30 shrink-0">Additional effort per page</div>
        <div className="px-4 py-4 w-25 shrink-0">
          {useAiEstimation ? "AI Dev Effort" : "Dev Effort"}
        </div>
        <div className="px-4 py-4 w-30 shrink-0">Additional effort per page</div>
        <div className="px-4 py-4 w-25 shrink-0">Additional Pages</div>
      </>
    ),
    [useAiEstimation],
  );

  const renderRow = useCallback(
    (template: SelectedTemplate) => (
      <TemplateRow
        key={template.id}
        template={template}
        useAiEstimation={useAiEstimation}
        match={matchedTemplateIds[template.id]}
        onToggle={() => toggleTemplate(template.id)}
        onSetPages={(pages) => setAdditionalPages(template.id, pages)}
        onUpdate={(updates) => updateTemplate(template.id, updates)}
      />
    ),
    [useAiEstimation, toggleTemplate, setAdditionalPages, updateTemplate, matchedTemplateIds],
  );

  return (
    <PageLayout>
      <ScanSummaryBanner kind="templates" />
      <GroupedAccordion
        title="Templates List"
        addLabel="Add template"
        searchPlaceholder="Search for template"
        useAiEstimation={useAiEstimation}
        onToggleAi={toggleAiEstimation}
        onAddGroup={handleAddTemplateGroup}
        search={search}
        onSearchChange={setSearch}
        loading={loading}
        error={error}
        grouped={grouped}
        emptyLabel="No templates found."
        openGroups={openGroups}
        onToggleGroup={toggleGroup}
        onToggleAllInGroup={toggleAllInGroup}
        onRenameGroup={renameGroup}
        isCustomGroup={isCustomGroup}
        onAddRow={addTemplate}
        renderHeader={renderHeader}
        renderRow={renderRow}
      />
    </PageLayout>
  );
}
