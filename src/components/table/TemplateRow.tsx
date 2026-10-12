"use client";

import { memo } from "react";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { CategoryLabel } from "@/components/CategoryLabel";
import { ConfidenceBadge } from "@/components/scan/ConfidenceBadge";
import {
  EditableTextCell,
  EditableNumberCell,
} from "@/components/table/EditableCell";
import type { MatchMetadata } from "@/lib/scanner/types";
import type { SelectedTemplate } from "@/types";

const CHECKBOX_ROW = "w-4.5 h-4.5 rounded-[5px] border-dark-background mt-0.5";
const CELL_BORDER = "border-r border-strokes/50";

interface Props {
  template: SelectedTemplate;
  useAiEstimation: boolean;
  match?: MatchMetadata;
  onToggle: () => void;
  onSetPages: (pages: number) => void;
  onUpdate: (updates: Partial<SelectedTemplate>) => void;
}

function TemplateRowBase({
  template,
  useAiEstimation,
  match,
  onToggle,
  onSetPages,
  onUpdate,
}: Props) {
  const designBase = useAiEstimation
    ? template.aiDesignEffortBase
    : template.designEffortBase;
  const devBase = useAiEstimation
    ? template.aiDevEffortBase
    : template.devEffortBase;
  const isEditable = true;

  const designBaseField: keyof SelectedTemplate = useAiEstimation
    ? "aiDesignEffortBase"
    : "designEffortBase";
  const devBaseField: keyof SelectedTemplate = useAiEstimation
    ? "aiDevEffortBase"
    : "devEffortBase";

  return (
    <div className="border-b border-strokes/50 last:border-b-0">
      <div className="hidden lg:flex min-w-max items-stretch text-xs text-black">
        <div className={`flex items-start gap-3 px-4 py-3 w-50 shrink-0 ${CELL_BORDER}`}>
          <Checkbox
            checked={template.isSelected}
            onCheckedChange={onToggle}
            className={CHECKBOX_ROW}
            aria-label={`Select ${template.description || template.name}`}
          />
          <EditableTextCell
            editable={isEditable}
            value={template.name}
            onChange={(v) => onUpdate({ name: v })}
            placeholder="Variant name"
            className="leading-snug font-medium"
          />
          {match && (
            <ConfidenceBadge
              confidence={match.confidence}
              pages={match.pages}
              className="mt-0.5"
            />
          )}
        </div>
        <div className={`flex items-start px-4 py-3 w-22.5 shrink-0 ${CELL_BORDER}`}>
          <CategoryLabel
            category={template.category}
            onChange={(value) => onUpdate({ category: value })}
          />
        </div>
        <div className={`flex items-start px-4 py-3 w-50 shrink-0 ${CELL_BORDER} leading-snug`}>
          <EditableTextCell
            editable={isEditable}
            multiline
            value={template.description}
            onChange={(v) => onUpdate({ description: v })}
            placeholder="Template description"
          />
        </div>
        <div className={`flex items-start px-4 py-3 w-25 shrink-0 ${CELL_BORDER}`}>
          <EditableNumberCell
            editable={isEditable}
            value={designBase}
            onChange={(v) => onUpdate({ [designBaseField]: v } as Partial<SelectedTemplate>)}
            suffix="h"
            ariaLabel="Design effort base"
          />
        </div>
        <div className={`flex items-start px-4 py-3 w-30 shrink-0 ${CELL_BORDER}`}>
          <EditableNumberCell
            editable={isEditable}
            value={template.designEffortPerPage}
            onChange={(v) => onUpdate({ designEffortPerPage: v })}
            suffix="h"
            ariaLabel="Design effort per additional page"
          />
        </div>
        <div className={`flex items-start px-4 py-3 w-25 shrink-0 ${CELL_BORDER}`}>
          <EditableNumberCell
            editable={isEditable}
            value={devBase}
            onChange={(v) => onUpdate({ [devBaseField]: v } as Partial<SelectedTemplate>)}
            suffix="h"
            ariaLabel="Development effort base"
          />
        </div>
        <div className={`flex items-start px-4 py-3 w-30 shrink-0 ${CELL_BORDER}`}>
          <EditableNumberCell
            editable={isEditable}
            value={template.devEffortPerPage}
            onChange={(v) => onUpdate({ devEffortPerPage: v })}
            suffix="h"
            ariaLabel="Development effort per additional page"
          />
        </div>
        <div className="flex items-start px-4 py-3 w-25 shrink-0">
          <Input
            type="number"
            min={0}
            value={template.additionalPages}
            onChange={(e) => onSetPages(Math.max(0, parseInt(e.target.value) || 0))}
            className="h-8 w-16 rounded-lg text-center text-xs border-strokes"
            aria-label="Additional pages"
          />
        </div>
      </div>

      <div className="lg:hidden p-4 flex gap-3">
        <Checkbox
          checked={template.isSelected}
          onCheckedChange={onToggle}
          className="w-4.5 h-4.5 rounded-[5px] border-dark-background mt-1 shrink-0"
          aria-label={`Select ${template.description || template.name}`}
        />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <EditableTextCell
              editable
              value={template.name}
              onChange={(value) => onUpdate({ name: value })}
              placeholder="Variant name"
              className="text-sm font-medium text-black"
            />
            <CategoryLabel
              category={template.category}
              onChange={(value) => onUpdate({ category: value })}
            />
            {match && (
              <ConfidenceBadge confidence={match.confidence} pages={match.pages} />
            )}
          </div>
          <EditableTextCell
            editable
            multiline
            value={template.description}
            onChange={(value) => onUpdate({ description: value })}
            placeholder="Template description"
            className="text-xs text-light-grey-text mb-2"
          />
          <div className="flex flex-wrap gap-3 text-xs text-black mb-2">
            <label className="flex items-center gap-1">
              Design:
              <EditableNumberCell
                editable
                value={designBase}
                onChange={(value) => onUpdate({ [designBaseField]: value } as Partial<SelectedTemplate>)}
                className="w-12"
                ariaLabel="Design effort base"
              />
              h
            </label>
            <label className="flex items-center gap-1">
              Design/page:
              <EditableNumberCell
                editable
                value={template.designEffortPerPage}
                onChange={(value) => onUpdate({ designEffortPerPage: value })}
                className="w-12"
                ariaLabel="Design effort per additional page"
              />
              h
            </label>
            <label className="flex items-center gap-1">
              Dev:
              <EditableNumberCell
                editable
                value={devBase}
                onChange={(value) => onUpdate({ [devBaseField]: value } as Partial<SelectedTemplate>)}
                className="w-12"
                ariaLabel="Development effort base"
              />
              h
            </label>
            <label className="flex items-center gap-1">
              Dev/page:
              <EditableNumberCell
                editable
                value={template.devEffortPerPage}
                onChange={(value) => onUpdate({ devEffortPerPage: value })}
                className="w-12"
                ariaLabel="Development effort per additional page"
              />
              h
            </label>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-light-grey-text">Additional pages:</span>
            <Input
              type="number"
              min={0}
              value={template.additionalPages}
              onChange={(e) => onSetPages(Math.max(0, parseInt(e.target.value) || 0))}
              className="h-8 w-16 rounded-lg text-center text-xs border-strokes"
              aria-label="Additional pages"
            />
          </div>
        </div>
      </div>
    </div>
  );
}

export const TemplateRow = memo(TemplateRowBase);