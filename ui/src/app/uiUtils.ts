export function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const normalized = hex.replace("#", "").trim();
  if (!/^[0-9a-fA-F]{6}$/.test(normalized)) return null;

  return {
    r: Number.parseInt(normalized.slice(0, 2), 16),
    g: Number.parseInt(normalized.slice(2, 4), 16),
    b: Number.parseInt(normalized.slice(4, 6), 16),
  };
}

export function getReadableTextColor(backgroundHex: string): string {
  const rgb = hexToRgb(backgroundHex);
  if (!rgb) return "#111111";

  const brightness = (rgb.r * 299 + rgb.g * 587 + rgb.b * 114) / 1000;
  return brightness >= 150 ? "#111111" : "#ffffff";
}

export function mixChannel(a: number, b: number, amount: number): number {
  return Math.round(a + (b - a) * amount);
}

export function mixHexColors(baseHex: string, targetHex: string, amount: number): string {
  const base = hexToRgb(baseHex);
  const target = hexToRgb(targetHex);
  if (!base || !target) return baseHex;

  const r = mixChannel(base.r, target.r, amount);
  const g = mixChannel(base.g, target.g, amount);
  const b = mixChannel(base.b, target.b, amount);

  return `#${[r, g, b].map((value) => value.toString(16).padStart(2, "0")).join("")}`;
}

export function getDieShellStyle(color: string, disabled = false) {
  const textColor = getReadableTextColor(color);

  return {
    width: "42px",
    height: "42px",
    borderRadius: "10px",
    border: `2px solid ${mixHexColors(color, "#000000", 0.22)}`,
    background: disabled ? mixHexColors(color, "#ffffff", 0.45) : color,
    color: disabled ? mixHexColors(textColor, "#ffffff", 0.35) : textColor,
    boxShadow: disabled ? "none" : "inset 0 -2px 0 rgba(0,0,0,0.18)",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    boxSizing: "border-box" as const,
    fontWeight: 700,
    fontSize: "18px",
    lineHeight: 1,
  };
}
