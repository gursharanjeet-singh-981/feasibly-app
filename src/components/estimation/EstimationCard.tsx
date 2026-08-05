"use client";

import { SvgIcon } from "@/components/SvgIcon";
import { BUFFER_LABEL } from "@/lib/constants";

interface Props {
  icon: string;
  iconWidth?: number;
  iconHeight?: number;
  title: string;
  days: number;
  weeks: number;
  note: string;
  onInfo: () => void;
}

export function EstimationCard({
  icon,
  iconWidth = 14,
  iconHeight = 14,
  title,
  days,
  weeks,
  note,
  onInfo,
}: Props) {
  return (
    <div className="bg-white border-b border-r border-strokes rounded-2xl lg:rounded-[40px] p-5">
      <div className="flex flex-col gap-2.75">
        <div className="flex items-center justify-between">
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
            onClick={onInfo}
            className="cursor-pointer"
            aria-label={`Show details about ${title}`}
          >
            <SvgIcon
              name="info"
              width={20}
              height={20}
              className="text-black opacity-54"
            />
          </button>
        </div>
        <p className="text-3xl lg:text-[40px] text-black">
          {days.toFixed(1)} days
        </p>
        <div className="flex items-center justify-between">
          <p className="text-lg text-black">{weeks} weeks</p>
          <p className="text-xs text-light-grey-text">{BUFFER_LABEL}</p>
        </div>
        <p className="text-[10px] text-light-grey-text font-medium">{note}</p>
      </div>
    </div>
  );
}
