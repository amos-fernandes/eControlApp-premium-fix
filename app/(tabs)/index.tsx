import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { router } from "expo-router";
import React, { useCallback, useState, useEffect } from "react";
import {
  FlatList,
  Platform,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { EmptyState } from "@/components/EmptyState";
import { FilterModal } from "@/components/FilterModal";
import { LoadingShimmer } from "@/components/LoadingShimmer";
import { ServiceOrderCard } from "@/components/ServiceOrderCard";
import { Colors } from "@/constants/colors";
import { useTheme } from "@/constants/theme";
import { useAuth } from "@/context/AuthContext";
import { useFilters } from "@/context/FilterContext";
import { getServicesOrders, getClientName } from "@/services/servicesOrders";
import type { ServiceOrder } from "@/services/api";
import { useQuery } from "@tanstack/react-query";

export default function OrdersScreen() {
  const insets = useSafeAreaInsets();
  const { theme, isDark } = useTheme();
  const { credentials, baseUrl, logout } = useAuth();
  const { filters, setFilter, resetFilters, hasActiveFilters } = useFilters();
  const [showFilters, setShowFilters] = useState(false);
  const [localSearch, setLocalSearch] = useState("");
  const [debugInfo, setDebugInfo] = useState<string | null>(null);

  const { data, isLoading, isError, error, refetch, isRefetching } = useQuery({
    queryKey: ["service_orders", filters, baseUrl],
    queryFn: async () => {
      if (!credentials) throw new Error("Nao autenticado");
      try {
        // Prepara filtros no formato esperado pelo serviço
        const filterParams = {
          filters: {
            status: filters.status || "",
            so_type: filters.type || "",
            start_date: filters.startDate || "",
            end_date: filters.endDate || "",
            voyage: filters.hasVoyage || "",
          },
        };

        const orders = await getServicesOrders(filterParams);
        setDebugInfo(null);
        return orders;
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        const tokenPreview = credentials.accessToken
          ? credentials.accessToken.slice(0, 20) + "..."
          : "VAZIO";
        const detail = `URL: ${baseUrl}\nToken: ${tokenPreview}\nErro: ${msg}`;
        setDebugInfo(detail);
        throw err;
      }
    },
    enabled: !!credentials,
    retry: (failureCount, error) => {
      // Não retry em caso de sessão expirada
      if (error.message === "SESSION_EXPIRED") return false;
      return failureCount < 2;
    },
  });

  const handleError = useCallback(async () => {
    if (error instanceof Error && error.message === "SESSION_EXPIRED") {
      await logout();
      router.replace("/(auth)/login");
    }
  }, [error, logout]);

  // Usar useEffect para chamar handleError depois do render
  useEffect(() => {
    if (isError) {
      handleError();
    }
  }, [isError, handleError]);

  const filtered = (data || []).filter((o: ServiceOrder | null | undefined) => {
    if (!o) return false; // Filtra valores null/undefined
    if (filters.hasVoyage === "true" && !o.voyage && !o.voyage_name && !o.voyage_id) return false;
    if (filters.hasVoyage === "false" && (o.voyage || o.voyage_name || o.voyage_id)) return false;
    if (localSearch) {
      const q = localSearch.toLowerCase();
      const name = getClientName(o).toLowerCase();
      const id = String(o.id || "");
      const route = (o.route_name || o.collection_route || "").toLowerCase();
      if (!name.includes(q) && !id.includes(q) && !route.includes(q)) return false;
    }
    return true;
  });

  const topPadding = Platform.OS === "web" ? 67 : insets.top;

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <View style={[styles.header, { paddingTop: topPadding + 12, backgroundColor: theme.surface, borderBottomColor: theme.border }]}>
        <View style={styles.headerTop}>
          <Text style={[styles.headerTitle, { color: theme.text }]}>Ordens de Servico</Text>
          <Pressable
            style={[styles.filterBtn, hasActiveFilters && { backgroundColor: Colors.primary }]}
            onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setShowFilters(true); }}
          >
            <Feather name="sliders" size={16} color={hasActiveFilters ? "#fff" : theme.textSecondary} />
          </Pressable>
        </View>

        <View style={[styles.searchBar, { backgroundColor: isDark ? theme.surfaceSecondary : "#F8FAF9", borderColor: theme.border }]}>
          <Feather name="search" size={15} color={theme.textMuted} />
          <TextInput
            style={[styles.searchInput, { color: theme.text }]}
            placeholder="Buscar por cliente, OS ou rota..."
            placeholderTextColor={theme.textMuted}
            value={localSearch}
            onChangeText={setLocalSearch}
          />
          {localSearch ? (
            <Pressable onPress={() => setLocalSearch("")}>
              <Feather name="x-circle" size={15} color={theme.textMuted} />
            </Pressable>
          ) : null}
        </View>

        {hasActiveFilters ? (
          <View style={styles.filterPills}>
            {filters.status ? (
              <View style={[styles.pill, { backgroundColor: Colors.primary + "20" }]}>
                <Text style={[styles.pillText, { color: Colors.primary }]}>{filters.status}</Text>
                <Pressable onPress={() => setFilter("status", "")}><Feather name="x" size={11} color={Colors.primary} /></Pressable>
              </View>
            ) : null}
            {filters.type ? (
              <View style={[styles.pill, { backgroundColor: Colors.primary + "20" }]}>
                <Text style={[styles.pillText, { color: Colors.primary }]}>{filters.type}</Text>
                <Pressable onPress={() => setFilter("type", "")}><Feather name="x" size={11} color={Colors.primary} /></Pressable>
              </View>
            ) : null}
            {filters.hasVoyage ? (
              <View style={[styles.pill, { backgroundColor: Colors.primary + "20" }]}>
                <Text style={[styles.pillText, { color: Colors.primary }]}>{filters.hasVoyage === "true" ? "Com Viagem" : "Sem Viagem"}</Text>
                <Pressable onPress={() => setFilter("hasVoyage", "")}><Feather name="x" size={11} color={Colors.primary} /></Pressable>
              </View>
            ) : null}
            <Pressable onPress={resetFilters}>
              <Text style={[styles.clearAll, { color: theme.textMuted }]}>Limpar tudo</Text>
            </Pressable>
          </View>
        ) : null}
      </View>

      {isLoading ? (
        <LoadingShimmer count={6} />
      ) : isError ? (
        <View style={styles.errorContainer}>
          <Feather name="wifi-off" size={40} color="#EF4444" />
          <Text style={[styles.errorTitle, { color: theme.text }]}>Erro ao carregar ordens</Text>

          {debugInfo ? (
            <View style={[styles.debugBox, { backgroundColor: isDark ? "#1a0a0a" : "#FEF2F2", borderColor: "#EF4444" }]}>
              <Text style={[styles.debugTitle, { color: "#EF4444" }]}>Detalhes do erro:</Text>
              <Text style={[styles.debugText, { color: theme.text }]} selectable>{debugInfo}</Text>
            </View>
          ) : null}

          <Pressable style={styles.retryBtn} onPress={() => { setDebugInfo(null); refetch(); }}>
            <Text style={styles.retryText}>Tentar novamente</Text>
          </Pressable>
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(o, index) => {
            // Garante chave única usando identifier ou id como fallback
            const identifier = o?.identifier || o?.id;
            return identifier ? String(identifier) : `item-${index}`;
          }}
          renderItem={({ item }) => (
            <ServiceOrderCard
              order={item}
              onPress={() => router.push({ pathname: "/order/[id]", params: { id: item.identifier || String(item.id) } })}
            />
          )}
          contentContainerStyle={[styles.list, filtered.length === 0 && styles.listEmpty]}
          refreshControl={<RefreshControl refreshing={!!isRefetching} onRefresh={() => refetch()} tintColor={Colors.primary} />}
          ListEmptyComponent={
            <EmptyState
              icon="clipboard"
              title="Nenhuma OS encontrada"
              subtitle={hasActiveFilters || localSearch ? "Tente remover os filtros aplicados." : "Nenhuma ordem de servico disponivel."}
            />
          }
          showsVerticalScrollIndicator={false}
          contentInsetAdjustmentBehavior="automatic"
        />
      )}

      <FilterModal
        visible={showFilters}
        filters={filters}
        onApply={(f) => { Object.entries(f).forEach(([k, v]) => setFilter(k as keyof typeof filters, v)); }}
        onClose={() => setShowFilters(false)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { paddingHorizontal: 16, paddingBottom: 12, borderBottomWidth: 1, shadowColor: "#000", shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 4, elevation: 2 },
  headerTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 12 },
  headerTitle: { fontSize: 22, fontWeight: "700", fontFamily: "Inter_700Bold" },
  filterBtn: { width: 38, height: 38, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  searchBar: { flexDirection: "row", alignItems: "center", borderRadius: 12, borderWidth: 1, paddingHorizontal: 12, height: 42, gap: 8 },
  searchInput: { flex: 1, fontSize: 14, fontFamily: "Inter_400Regular" },
  filterPills: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 10, alignItems: "center" },
  pill: { flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 },
  pillText: { fontSize: 12, fontWeight: "600", fontFamily: "Inter_600SemiBold" },
  clearAll: { fontSize: 12, fontFamily: "Inter_400Regular", textDecorationLine: "underline" },
  list: { paddingVertical: 8 },
  listEmpty: { flex: 1 },
  errorContainer: { flex: 1, alignItems: "center", justifyContent: "center", padding: 24, gap: 12 },
  errorTitle: { fontSize: 16, fontWeight: "700", fontFamily: "Inter_700Bold", textAlign: "center" },
  debugBox: { width: "100%", borderWidth: 1, borderRadius: 12, padding: 14, gap: 6 },
  debugTitle: { fontSize: 13, fontWeight: "700", fontFamily: "Inter_700Bold", marginBottom: 4 },
  debugText: { fontSize: 11, fontFamily: "Inter_400Regular", lineHeight: 18 },
  retryBtn: { backgroundColor: Colors.primary, paddingHorizontal: 24, paddingVertical: 12, borderRadius: 14, marginTop: 4 },
  retryText: { color: "#fff", fontWeight: "700", fontFamily: "Inter_700Bold" },
});
