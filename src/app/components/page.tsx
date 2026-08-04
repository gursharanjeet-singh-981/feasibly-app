"use client";

import { useCallback, useEffect, useState } from "react";
import { Checkbox } from "@/components/ui/checkbox";
import { PageLayout } from "@/components/PageLayout";
import { GroupedAccordion } from "@/components/table/GroupedAccordion";
import { ComponentRow } from "@/components/table/ComponentRow";
import { useGroupedItems } from "@/hooks/useGroupedItems";
import { useAppStore } from "@/store";
import { loadComponents } from "@/lib/data";
import {
  addItemAndScroll,
  renameGroupItems,
  toggleAllInGroup as toggleAllInGroupHelper,
  toggleGroup as toggleGroupHelper,
} from "@/lib/groupHelpers";
import { DEFAULT_COMPONENT_GROUP } from "@/lib/constants";
import type { SelectedComponent } from "@/types";

const CHECKBOX_BASE = "w-4.5 h-4.5 rounded-[5px] border-dark-background";

export default function ComponentsPage() {
  const components = useAppStore((s) => s.components);
  const setComponents = useAppStore((s) => s.setComponents);
  const toggleComponent = useAppStore((s) => s.toggleComponent);
  const setComponentsSelection = useAppStore((s) => s.setComponentsSelection);
  const addComponent = useAppStore((s) => s.addComponent);
  const updateComponent = useAppStore((s) => s.updateComponent);
  const useAiEstimation = useAppStore((s) => s.useAiEstimation);
  const toggleAiEstimation = useAppStore((s) => s.toggleAiEstimation);
  const matchedComponentIds = useAppStore((s) => s.scan.matchedComponentIds);

  const [search, setSearch] = useState("");
  const [openGroups, setOpenGroups] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const loading = !error && components.length === 0;

  useEffect(() => {
    if (components.length > 0) return;
    let cancelled = false;
    loadComponents()
      .then((data) => {
        if (cancelled) return;
        setComponents(
          data.map<SelectedComponent>((c) => ({
            ...c,
            isSelected: !!matchedComponentIds[c.id],
            isCustom: false,
          })),
        );
      })
      .catch(() => {
        if (!cancelled) {
          setError("Failed to load components. Please refresh the page.");
        }
      });
    return () => {
      cancelled = true;
    };
  }, [components.length, setComponents, matchedComponentIds]);

  const getGroup = useCallback((c: SelectedComponent) => c.group, []);
  const matchers = useCallback(
    (c: SelectedComponent) => [
      c.name,
      c.group,
      c.designDescription,
      c.developmentDescription,
    ],
    [],
  );
  const grouped = useGroupedItems(components, getGroup, search, matchers);

  const toggleGroup = useCallback(
    (group: string) => toggleGroupHelper(group, setOpenGroups),
    [],
  );
  const toggleAllInGroup = useCallback(
    (group: string) =>
      toggleAllInGroupHelper(group, grouped, setComponentsSelection),
    [grouped, setComponentsSelection],
  );

  const handleAddComponentGroup = useCallback(() => {
    const existingGroups = new Set(components.map((c) => c.group));
    let name = DEFAULT_COMPONENT_GROUP;
    let counter = 2;
    while (existingGroups.has(name)) {
      name = `${DEFAULT_COMPONENT_GROUP} ${counter}`;
      counter++;
    }
    addItemAndScroll(() => addComponent(name), name, setOpenGroups);
  }, [components, addComponent]);

  const renameGroup = useCallback(
    (oldName: string, newName: string) =>
      renameGroupItems(
        oldName,
        newName,
        components,
        "group",
        updateComponent,
        setOpenGroups,
      ),
    [components, updateComponent],
  );

  const isCustomGroup = useCallback(
    (items: SelectedComponent[]) => items.every((c) => c.isCustom === true),
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
        <div className="flex items-center gap-3 px-4 py-4 w-55 shrink-0">
          <Checkbox
            checked={allSelected}
            onCheckedChange={onToggleAll}
            className={CHECKBOX_BASE}
            aria-label={`Select all in ${group}`}
          />
          <span>Variant</span>
        </div>
        <div className="px-4 py-4 w-25 shrink-0">Category</div>
        <div className="px-4 py-4 w-50 shrink-0">Design</div>
        <div className="px-4 py-4 w-50 shrink-0">Development</div>
        <div className="px-4 py-4 w-25 shrink-0">
          {useAiEstimation ? "AI Design Effort" : "Design Effort"}
        </div>
        <div className="px-4 py-4 w-25 shrink-0">
          {useAiEstimation ? "AI Dev Effort" : "Dev Effort"}
        </div>
      </>
    ),
    [useAiEstimation],
  );

  const renderRow = useCallback(
    (component: SelectedComponent) => (
      <ComponentRow
        key={component.id}
        component={component}
        useAiEstimation={useAiEstimation}
        onToggle={() => toggleComponent(component.id)}
        onUpdate={(updates) => updateComponent(component.id, updates)}
      />
    ),
    [useAiEstimation, toggleComponent, updateComponent],
  );

  return (
    <PageLayout>
      <GroupedAccordion
        title="Components List"
        addLabel="Add component"
        searchPlaceholder="Search for component"
        useAiEstimation={useAiEstimation}
        onToggleAi={toggleAiEstimation}
        onAddGroup={handleAddComponentGroup}
        search={search}
        onSearchChange={setSearch}
        loading={loading}
        error={error}
        grouped={grouped}
        emptyLabel="No components found."
        openGroups={openGroups}
        onToggleGroup={toggleGroup}
        onToggleAllInGroup={toggleAllInGroup}
        onRenameGroup={renameGroup}
        isCustomGroup={isCustomGroup}
        onAddRow={addComponent}
        renderHeader={renderHeader}
        renderRow={renderRow}
      />
    </PageLayout>
  );
}
