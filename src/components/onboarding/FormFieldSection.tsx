import type { ReactNode } from "react";

interface Props {
  iconSlot: ReactNode;
  title: string;
  description: ReactNode;
  children: ReactNode;
}

export function FormFieldSection({
  iconSlot,
  title,
  description,
  children,
}: Props) {
  return (
    <div className="flex flex-col gap-4 md:gap-5">
      <div className="flex items-start md:items-center gap-4 md:gap-5">
        <div className="flex items-center justify-center w-10 h-10 md:w-12.5 md:h-12.5 bg-sky-blue rounded-xl md:rounded-[15px] shrink-0">
          {iconSlot}
        </div>
        <div className="flex flex-col gap-1 md:gap-2.5">
          <p className="text-base md:text-[20px] font-semibold text-black">
            {title}
          </p>
          <p className="text-sm md:text-[16px] text-light-grey-text">
            {description}
          </p>
        </div>
      </div>
      {children}
    </div>
  );
}

interface OutlineIconProps {
  children: ReactNode;
}

export function OutlineIcon({ children }: OutlineIconProps) {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="white"
      strokeWidth="2"
      aria-hidden="true"
    >
      {children}
    </svg>
  );
}
