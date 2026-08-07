"use client";

import { memo } from "react";
import { Checkbox } from "@/components/ui/checkbox";
import { CategoryLabel } from "@/components/CategoryLabel";
import { ConfidenceBadge } from "@/components/scan/ConfidenceBadge";
import {
  EditableTextCell,
  EditableNumberCell,
} from "@/components/table/EditableCell";
import type { MatchMetadata } from "@/lib/scanner/types";
import type { SelectedComponent } from "@/types";

const CHECKBOX_ROW = "w-4.5 h-4.5 rounded-[5px] border-dark-background mt-0.5";
const CELL_BORDER = "border-r border-strokes/50";
const CELL_TEXT = "leading-snug";

interface Props {
  component: SelectedComponent;
  useAiEstimation: boolean;
  match?: MatchMetadata;
  onToggle: () => void;
  onUpdate: (updates: Partial<SelectedComponent>) => void;
}

function ComponentRowBase({ component, useAiEstimation, match, onToggle, onUpdate }: Props) {
  const designEffort = useAiEstimation
    ? component.aiDesignEffort
    : component.designEffort;
  const devEffort = useAiEstimation
    ? component.aiDevEffort
    : component.devEffort;
  const isEditable = component.isCustom === true;

  const designField: keyof SelectedComponent = useAiEstimation
    ? "aiDesignEffort"
    : "designEffort";
  const devField: keyof SelectedComponent = useAiEstimation
    ? "aiDevEffort"
    : "devEffort";

  return (
    <div className="border-b border-strokes/50 last:border-b-0">
      <div className="hidden lg:flex min-w-max items-stretch text-xs text-black">
        <div className={`flex items-start gap-3 px-4 py-3 w-55 shrink-0 ${CELL_BORDER}`}>
          <Checkbox
            checked={component.isSelected}
            onCheckedChange={onToggle}
            className={CHECKBOX_ROW}
            aria-label={`Select ${component.name || "component"}`}
          />
          <EditableTextCell
            editable={isEditable}
            value={component.name}
            onChange={(v) => onUpdate({ name: v })}
            placeholder="Variant name"
            className={CELL_TEXT}
          />
          {match && (
            <ConfidenceBadge
              confidence={match.confidence}
              pages={match.pages}
              className="mt-0.5"
            />
          )}
        </div>
        <div className={`flex items-start px-4 py-3 w-25 shrink-0 ${CELL_BORDER}`}>
          {isEditable ? (
            <EditableTextCell
              editable
              value={component.category}
              onChange={(v) => onUpdate({ category: v })}
              placeholder="Category"
              className={CELL_TEXT}
            />
          ) : (
            <CategoryLabel category={component.category} />
          )}
        </div>
        <div className={`flex items-start px-4 py-3 w-50 shrink-0 ${CELL_BORDER} ${CELL_TEXT}`}>
          <EditableTextCell
            editable={isEditable}
            value={component.designDescription}
            onChange={(v) => onUpdate({ designDescription: v })}
            placeholder="Design description"
          />
        </div>
        <div className={`flex items-start px-4 py-3 w-50 shrink-0 ${CELL_BORDER} ${CELL_TEXT}`}>
          <EditableTextCell
            editable={isEditable}
            value={component.developmentDescription}
            onChange={(v) => onUpdate({ developmentDescription: v })}
            placeholder="Development description"
          />
        </div>
        <div className={`flex items-start px-4 py-3 w-25 shrink-0 ${CELL_BORDER}`}>
          <EditableNumberCell
            editable={isEditable}
            value={designEffort}
            onChange={(v) => onUpdate({ [designField]: v } as Partial<SelectedComponent>)}
            suffix="h"
            ariaLabel="Design effort in hours"
          />
        </div>
        <div className="flex items-start px-4 py-3 w-25 shrink-0">
          <EditableNumberCell
            editable={isEditable}
            value={devEffort}
            onChange={(v) => onUpdate({ [devField]: v } as Partial<SelectedComponent>)}
            suffix="h"
            ariaLabel="Development effort in hours"
          />
        </div>
      </div>

      <div className="lg:hidden p-4 flex gap-3">
        <Checkbox
          checked={component.isSelected}
          onCheckedChange={onToggle}
          className="w-4.5 h-4.5 rounded-[5px] border-dark-background mt-1 shrink-0"
          aria-label={`Select ${component.name || "component"}`}
        />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            {isEditable ? (
              <EditableTextCell
                editable
                value={component.name}
                onChange={(v) => onUpdate({ name: v })}
                placeholder="Variant name"
                className="text-sm font-medium text-black"
              />
            ) : (
              <p className="text-sm font-medium text-black truncate">{component.name}</p>
            )}
            <CategoryLabel category={component.category} />
            {match && (
              <ConfidenceBadge confidence={match.confidence} pages={match.pages} />
            )}
          </div>
          {isEditable ? (
            <EditableTextCell
              editable
              value={component.designDescription}
              onChange={(v) => onUpdate({ designDescription: v })}
              placeholder="Design description"
              className="text-xs text-light-grey-text mb-2"
            />
          ) : (
            <p className="text-xs text-light-grey-text line-clamp-2 mb-2">
              {component.designDescription}
            </p>
          )}
          <div className="flex gap-4 text-xs text-black">
            {isEditable ? (
              <>
                <label className="flex items-center gap-1">
                  Design:
                  <EditableNumberCell
                    editable
                    value={designEffort}
                    onChange={(v) => onUpdate({ [designField]: v } as Partial<SelectedComponent>)}
                    className="w-12"
                    ariaLabel="Design effort in hours"
                  />
                  h
                </label>
                <label className="flex items-center gap-1">
                  Dev:
                  <EditableNumberCell
                    editable
                    value={devEffort}
                    onChange={(v) => onUpdate({ [devField]: v } as Partial<SelectedComponent>)}
                    className="w-12"
                    ariaLabel="Development effort in hours"
                  />
                  h
                </label>
              </>
            ) : (
              <>
                <span>Design: {designEffort}h</span>
                <span>Dev: {devEffort}h</span>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export const ComponentRow = memo(ComponentRowBase);