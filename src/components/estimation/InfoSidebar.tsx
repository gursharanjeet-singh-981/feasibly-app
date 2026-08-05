"use client";

import { X } from "lucide-react";
import { SvgIcon } from "@/components/SvgIcon";
import {
  DESIGN_INCLUDED,
  DEV_INCLUDED,
  type IncludedSection,
} from "@/lib/estimationContent";

export type InfoKind = "dev" | "design";

interface Props {
  kind: InfoKind;
  onClose: () => void;
}

const CONFIG: Record<
  InfoKind,
  { title: string; icon: string; iconWidth: number; iconHeight: number; sections: IncludedSection[] }
> = {
  dev: {
    title: "Development",
    icon: "developer-mode",
    iconWidth: 14,
    iconHeight: 8,
    sections: DEV_INCLUDED,
  },
  design: {
    title: "Design",
    icon: "pencil",
    iconWidth: 14,
    iconHeight: 14,
    sections: DESIGN_INCLUDED,
  },
};

export function InfoSidebar({ kind, onClose }: Props) {
  const { title, icon, iconWidth, iconHeight, sections } = CONFIG[kind];

  return (
    <div
      className="fixed inset-0 z-50 flex justify-end"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={`${title} details`}
    >
      <div className="absolute inset-0 bg-black/30" />
      <div
        className="relative w-full max-w-md bg-white h-full overflow-y-auto p-8 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center w-7.5 h-7.5 bg-cobalt rounded-lg">
              <SvgIcon
                name={icon}
                width={iconWidth}
                height={iconHeight}
                className="text-white"
              />
            </div>
            <p className="text-base font-bold text-black">{title}</p>
          </div>
          <button
            onClick={onClose}
            className="cursor-pointer p-1"
            aria-label="Close"
          >
            <X className="w-5 h-5 text-black" />
          </button>
        </div>

        <h3 className="text-2xl font-semibold text-black mb-6">
          What&apos;s included
        </h3>

        <div className="flex flex-col gap-6">
          {sections.map((section, i) => (
            <div key={section.title}>
              <p className="text-sm font-bold text-cobalt mb-2">
                <span className="mr-2">{String(i + 1).padStart(2, "0")}</span>
                {section.title}
              </p>
              <ul className="list-disc list-inside text-xs text-black space-y-1 pl-1">
                {section.items.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
