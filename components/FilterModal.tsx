import { Feather } from "@expo/vector-icons";
import DateTimePicker from "@react-native-community/datetimepicker";
import React, { useEffect, useState } from "react";
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTheme } from "@/constants/theme";
import { Colors } from "@/constants/colors";
import type { ServiceOrderFilters } from "@/context/FilterContext";

interface FilterModalProps {
  visible: boolean;
  filters: ServiceOrderFilters;
  onApply: (filters: ServiceOrderFilters) => void;
  onClose: () => void;
}

const STATUS_OPTIONS = [
  { label: "Todos", value: "" },
  { label: "Em Conferência", value: "Em conferência" },
  { label: "Iniciada", value: "Iniciada" },
  { label: "Concluída", value: "Concluída" },
  { label: "Cancelada", value: "Cancelada" },
];

const TYPE_OPTIONS = [
  { label: "Todos", value: "" },
  { label: "Coleta", value: "Coleta" },
  { label: "Entrega", value: "Entrega" },
];

const VOYAGE_OPTIONS = [
  { label: "Todos", value: "" },
  { label: "Com Viagem", value: "true" },
  { label: "Sem Viagem", value: "false" },
];

function ChipGroup({
  label,
  options,
  selected,
  onSelect,
}: {
  label: string;
  options: { label: string; value: string }[];
  selected: string;
  onSelect: (v: string) => void;
}) {
  const { theme } = useTheme();
  return (
    <View style={styles.filterGroup}>
      <Text style={[styles.filterLabel, { color: theme.textSecondary }]}>
        {label}
      </Text>
      <View style={styles.chips}>
        {options.map((o) => (
          <Pressable
            key={o.value}
            onPress={() => onSelect(o.value)}
            style={[
              styles.chip,
              {
                backgroundColor:
                  selected === o.value ? Colors.primary : theme.border,
              },
            ]}
          >
            <Text
              style={[
                styles.chipText,
                { color: selected === o.value ? "#fff" : theme.textSecondary },
              ]}
            >
              {o.label}
            </Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

export function FilterModal({ visible, filters, onApply, onClose }: FilterModalProps) {
  const { theme, isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const [local, setLocal] = useState<ServiceOrderFilters>(filters);
  const [showStartPicker, setShowStartPicker] = useState(false);
  const [showEndPicker, setShowEndPicker] = useState(false);

  // BUG FIX: sync local state when filters prop changes (e.g., external reset)
  useEffect(() => {
    if (visible) {
      setLocal(filters);
    }
  }, [visible, filters]);

  const setField = (k: keyof ServiceOrderFilters, v: string) =>
    setLocal((prev) => ({ ...prev, [k]: v }));

  const handleStartDateChange = (event: any, date?: Date) => {
    setShowStartPicker(false);
    if (date) {
      setField("startDate", date.toISOString().split("T")[0]);
    }
  };

  const handleEndDateChange = (event: any, date?: Date) => {
    setShowEndPicker(false);
    if (date) {
      setField("endDate", date.toISOString().split("T")[0]);
    }
  };

  const handleApply = () => {
    onApply(local);
    onClose();
  };

  const handleReset = () => {
    const empty: ServiceOrderFilters = {
      status: "",
      type: "",
      hasVoyage: "",
      startDate: "",
      endDate: "",
      routeName: "",
      search: "",
    };
    setLocal(empty);
    onApply(empty);
    onClose();
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <View
          style={[
            styles.sheet,
            {
              backgroundColor: theme.surface,
              paddingBottom: insets.bottom + 16,
            },
          ]}
        >
          <View style={styles.grabber} />

          <View style={[styles.sheetHeader, { borderBottomColor: theme.border }]}>
            <Text style={[styles.sheetTitle, { color: theme.text }]}>Filtros</Text>
            <Pressable onPress={onClose}>
              <Feather name="x" size={22} color={theme.textMuted} />
            </Pressable>
          </View>

          <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
            <ChipGroup
              label="Status"
              options={STATUS_OPTIONS}
              selected={local.status}
              onSelect={(v) => setField("status", v)}
            />
            <ChipGroup
              label="Tipo"
              options={TYPE_OPTIONS}
              selected={local.type}
              onSelect={(v) => setField("type", v)}
            />
            <ChipGroup
              label="Viagem"
              options={VOYAGE_OPTIONS}
              selected={local.hasVoyage}
              onSelect={(v) => setField("hasVoyage", v)}
            />

            <View style={styles.filterGroup}>
              <Text style={[styles.filterLabel, { color: theme.textSecondary }]}>
                Rota
              </Text>
              <TextInput
                style={[
                  styles.input,
                  {
                    backgroundColor: isDark ? theme.surfaceSecondary : "#F8FAF9",
                    color: theme.text,
                    borderColor: theme.border,
                  },
                ]}
                placeholder="Nome da rota..."
                placeholderTextColor={theme.textMuted}
                value={local.routeName}
                onChangeText={(v) => setField("routeName", v)}
              />
            </View>

            <View style={styles.filterGroup}>
              <Text style={[styles.filterLabel, { color: theme.textSecondary }]}>
                Período
              </Text>
              <View style={styles.dateRow}>
                <Pressable
                  style={[
                    styles.dateButton,
                    {
                      backgroundColor: isDark ? theme.surfaceSecondary : "#F8FAF9",
                      borderColor: theme.border,
                    },
                  ]}
                  onPress={() => setShowStartPicker(true)}
                >
                  <Feather name="calendar" size={16} color={theme.textMuted} />
                  <Text style={[styles.dateButtonText, { color: local.startDate ? theme.text : theme.textMuted }]}>
                    {local.startDate || "Início"}
                  </Text>
                </Pressable>
                <Pressable
                  style={[
                    styles.dateButton,
                    {
                      backgroundColor: isDark ? theme.surfaceSecondary : "#F8FAF9",
                      borderColor: theme.border,
                    },
                  ]}
                  onPress={() => setShowEndPicker(true)}
                >
                  <Feather name="calendar" size={16} color={theme.textMuted} />
                  <Text style={[styles.dateButtonText, { color: local.endDate ? theme.text : theme.textMuted }]}>
                    {local.endDate || "Fim"}
                  </Text>
                </Pressable>
              </View>
              {(local.startDate || local.endDate) && (
                <Pressable onPress={() => { setField("startDate", ""); setField("endDate", ""); }} style={styles.clearDates}>
                  <Text style={[styles.clearDatesText, { color: theme.textMuted }]}>Limpar datas</Text>
                </Pressable>
              )}
            </View>

            {showStartPicker && (
              <DateTimePicker
                value={local.startDate ? new Date(local.startDate) : new Date()}
                mode="date"
                display="default"
                onChange={handleStartDateChange}
              />
            )}
            {showEndPicker && (
              <DateTimePicker
                value={local.endDate ? new Date(local.endDate) : new Date()}
                mode="date"
                display="default"
                onChange={handleEndDateChange}
              />
            )}
          </ScrollView>

          <View style={[styles.actions, { borderTopColor: theme.border }]}>
            <Pressable
              style={[styles.resetBtn, { borderColor: theme.border }]}
              onPress={handleReset}
            >
              <Text style={[styles.resetText, { color: theme.textSecondary }]}>
                Limpar
              </Text>
            </Pressable>
            <Pressable
              style={[styles.applyBtn, { backgroundColor: Colors.primary }]}
              onPress={handleApply}
            >
              <Text style={styles.applyText}>Aplicar</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "flex-end",
  },
  sheet: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: "85%",
  },
  grabber: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: "#CBD5E1",
    alignSelf: "center",
    marginTop: 12,
    marginBottom: 8,
  },
  sheetHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: 1,
  },
  sheetTitle: {
    fontSize: 18,
    fontWeight: "700",
    fontFamily: "Inter_700Bold",
  },
  content: {
    paddingHorizontal: 20,
    paddingTop: 16,
  },
  filterGroup: {
    marginBottom: 20,
  },
  filterLabel: {
    fontSize: 13,
    fontWeight: "600",
    marginBottom: 10,
    textTransform: "uppercase",
    letterSpacing: 0.5,
    fontFamily: "Inter_600SemiBold",
  },
  chips: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
  },
  chipText: {
    fontSize: 13,
    fontWeight: "500",
    fontFamily: "Inter_400Regular",
  },
  input: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    fontSize: 15,
    fontFamily: "Inter_400Regular",
  },
  dateRow: {
    flexDirection: "row",
    gap: 10,
    marginBottom: 8,
  },
  dateButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
  },
  dateButtonText: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
  },
  clearDates: {
    marginTop: 6,
    alignSelf: "flex-start",
  },
  clearDatesText: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    textDecorationLine: "underline",
  },
  actions: {
    flexDirection: "row",
    gap: 12,
    padding: 16,
    borderTopWidth: 1,
  },
  resetBtn: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 14,
    padding: 15,
    alignItems: "center",
  },
  resetText: {
    fontSize: 15,
    fontWeight: "600",
    fontFamily: "Inter_600SemiBold",
  },
  applyBtn: {
    flex: 2,
    borderRadius: 14,
    padding: 15,
    alignItems: "center",
  },
  applyText: {
    color: "#fff",
    fontSize: 15,
    fontWeight: "700",
    fontFamily: "Inter_700Bold",
  },
});
