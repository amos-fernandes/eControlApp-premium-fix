// Verde bem clarinho (como no outro app)
const primary = "#66BB6A";
const primaryLight = "#81C784";
const primaryDark = "#388E3C";
const accent = "#81C784";
const accentLight = "#A5D6A7";

export const Colors = {
  primary,
  primaryLight,
  primaryDark,
  accent,
  accentLight,

  light: {
    tint: primary,
    tabIconDefault: "#94A3B8",
    tabIconSelected: primary,
    background: "#F0F4F1",
    surface: "#FFFFFF",
    surfaceSecondary: "#F8FAF9",
    text: "#0F1F17",
    textSecondary: "#4A6357",
    textMuted: "#94A3B8",
    border: "#DCE8E0",
    borderStrong: "#B8D4C0",
    card: "#FFFFFF",
    cardShadow: "rgba(27, 94, 53, 0.08)",
    success: "#4CAF50",
    warning: "#F59E0B",
    error: "#EF4444",
    info: "#3B82F6",

    statusColors: {
      "Em conferência": "#F59E0B",
      "Iniciada": "#3B82F6",
      "Concluída": "#4CAF50",
      "Cancelada": "#EF4444",
      "Pendente": "#94A3B8",
    },
  },

  dark: {
    tint: accentLight,
    tabIconDefault: "#64748B",
    tabIconSelected: accentLight,
    background: "#0A1A10",
    surface: "#0F2318",
    surfaceSecondary: "#142B1E",
    text: "#E8F5EC",
    textSecondary: "#9DC5AC",
    textMuted: "#4A6357",
    border: "#1E3D2A",
    borderStrong: "#2E5C3C",
    card: "#0F2318",
    cardShadow: "rgba(0, 0, 0, 0.3)",
    success: "#4CAF50",
    warning: "#F59E0B",
    error: "#EF4444",
    info: "#3B82F6",

    statusColors: {
      "Em conferência": "#F59E0B",
      "Iniciada": "#3B82F6",
      "Concluída": "#4CAF50",
      "Cancelada": "#EF4444",
      "Pendente": "#64748B",
    },
  },
};

export default Colors;
