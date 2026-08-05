"use client";

import { SvgIcon } from "@/components/SvgIcon";

interface Props {
  icon: string;
  iconClassName?: string;
  label: string;
  helper: string;
  value: number;
}

export function StatTile({ icon, iconClassName, label, helper, value }: Props) {
  return (
    <div className="flex flex-col gap-2.5">
      <div className="flex items-center gap-1.5">
        <SvgIcon
          name={icon}
          width={16}
          height={16}
          className={iconClassName ?? "text-black"}
        />
        <p className="text-sm lg:text-base font-bold text-black">{label}</p>
      </div>
      <p className="text-[10px] text-light-grey-text font-medium">{helper}</p>
      <p className="text-3xl lg:text-[40px] text-black">{value}</p>
    </div>
  );
}
