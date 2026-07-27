interface SvgIconProps {
  name: string;
  className?: string;
  width?: number | string;
  height?: number | string;
}

export function SvgIcon({ name, className = "", width = 16, height = 16 }: SvgIconProps) {
  return (
    <svg className={className} width={width} height={height} aria-hidden="true">
      <use href={`/images/icons.svg#icon-${name}`} />
    </svg>
  );
}
