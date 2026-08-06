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
  const isEditable = template.isCustom === true;

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
            value={template.description}
            onChange={(v) => onUpdate({ description: v })}
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
          {isEditable ? (
            <EditableTextCell
              editable
              value={template.category}
              onChange={(v) => onUpdate({ category: v })}
              placeholder="Category"
              className="leading-snug"
            />
          ) : (
            <CategoryLabel category={template.category} />
          )}
        </div>
        <div className={`flex items-start px-4 py-3 w-50 shrink-0 ${CELL_BORDER} leading-snug`}>
          <EditableTextCell
            editable={isEditable}
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
        <div className="flex items-center px-4 py-3 w-25 shrink-0">
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
            {isEditable ? (
              <EditableTextCell
                editable
                value={template.description}
                onChange={(v) => onUpdate({ description: v })}
                placeholder="Template name"
                className="text-sm font-medium text-black"
              />
            ) : (
              <p className="text-sm font-medium text-black truncate">{template.description}</p>
            )}
            <CategoryLabel category={template.category} />
            {match && (
              <ConfidenceBadge confidence={match.confidence} pages={match.pages} />
            )}
          </div>
          <p className="text-xs text-light-grey-text line-clamp-2 mb-2">
            {template.description}
          </p>
          <div className="flex flex-wrap gap-3 text-xs text-black mb-2">
            <span>Design: {designBase}h</span>
            <span>+{template.designEffortPerPage}h/pg</span>
            <span>Dev: {devBase}h</span>
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
              aria-label="Additional pages"
            />
          </div>
        </div>
      </div>
    </div>
  );
}

export const TemplateRow = memo(TemplateRowBase);
