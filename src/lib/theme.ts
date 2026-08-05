type RGB = readonly [number, number, number];

interface BrandColor {
  hex: `#${string}`;
  rgb: RGB;
  argb: string;
}

function make(hex: `#${string}`): BrandColor {
  const clean = hex.slice(1);
  const rgb: RGB = [
    parseInt(clean.slice(0, 2), 16),
    parseInt(clean.slice(2, 4), 16),
    parseInt(clean.slice(4, 6), 16),
  ] as const;
  return { hex, rgb, argb: `FF${clean.toUpperCase()}` };
}

export const BRAND = {
  cobalt: make("#0029DA"),
  skyBlue: make("#0094FA"),
  bgBlue: make("#F1F5F9"),
  lightGrey: make("#484A4B"),
  lightWhite: make("#B2BFF4"),
  placeholder: make("#A6A6A6"),
  strokes: make("#D9D9D9"),
  darkBackground: make("#CCD3E1"),
  white: make("#FFFFFF"),
  black: make("#000000"),
  brandRed: make("#F1012F"),
  brandNavy: make("#020E4E"),
  surfaceMuted: make("#E3E7EF"),
  categoryCoreBg: make("#F4E4E7"),
  categoryDefaultBg: make("#E4ECF4"),
} as const;

export type BrandName = keyof typeof BRAND;
