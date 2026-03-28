import { Feather, MaterialCommunityIcons } from "@expo/vector-icons";
import { router } from "expo-router";
import React, { useMemo, useState } from "react";
import {
  FlatList,
  Platform,
  Pressable,
  RefreshControl,
  SectionList,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { EmptyState } from "@/components/EmptyState";
import { LoadingShimmer } from "@/components/LoadingShimmer";
import { ServiceOrderCard } from "@/components/ServiceOrderCard";
import { StatusBadge } from "@/components/StatusBadge";
import { Colors } from "@/constants/colors";
import { useTheme } from "@/constants/theme";
import { useAuth } from "@/context/AuthContext";
import {
  getServicesOrders,
  getRouteName,
  getVoyageName,
  hasVoyage,
} from "@/services/servicesOrders";
import type { ServiceOrder } from "@/services/api";
import { useQuery } from "@tanstack/react-query";

type Tab = "com" | "sem";

export default function VoyagesScreen() {
  const insets = useSafeAreaInsets();
  const { theme } = useTheme();
  const { credentials, baseUrl } = useAuth();
  const [activeTab, setActiveTab] = useState<Tab>("com");
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());

  const { data, isLoading, isError, refetch, isRefetching } = useQuery({
    queryKey: ["service_orders_voyages", baseUrl],
    queryFn: async () => {
      if (!credentials) throw new Error("Não autenticado");

      // Filtro padrão de 7 dias antes e 7 dias depois (igual à tela principal)
      const now = new Date();
      const sevenDaysAgo = new Date(now);
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
      const sevenDaysAfter = new Date(now);
      sevenDaysAfter.setDate(sevenDaysAfter.getDate() + 7);

      const startDate = sevenDaysAgo.toISOString().split('T')[0];
      const endDate = sevenDaysAfter.toISOString().split('T')[0];

      // Busca OS com filtro de 7 dias antes + 7 dias depois com cache SQLite
      return getServicesOrders({
        filters: {
          status: "",
          so_type: "",
          start_date: startDate,
          end_date: endDate,
          voyage: "",
        },
      });
    },
    enabled: !!credentials,
    retry: (failureCount, error) => {
      if (error.message === "SESSION_EXPIRED") return false;
      return failureCount < 2;
    },
  });

  const withVoyage = useMemo(
    () => (data || []).filter((o: ServiceOrder | null | undefined) => o && hasVoyage(o)),
    [data]
  );
  const withoutVoyage = useMemo(
    () => (data || []).filter((o: ServiceOrder | null | undefined) => o && !hasVoyage(o)),
    [data]
  );

  const voyageSections = useMemo(() => {
    const groups: Record<string, ServiceOrder[]> = {};
    withVoyage.forEach((o) => {
      const name = getVoyageName(o) || "Viagem sem nome";
      if (!groups[name]) groups[name] = [];
      groups[name].push(o);
    });
    return Object.entries(groups).map(([title, data]) => ({ title, data }));
  }, [withVoyage]);

  const routeSections = useMemo(() => {
    const groups: Record<string, ServiceOrder[]> = {};
    withoutVoyage.forEach((o) => {
      const name = getRouteName(o);
      if (!groups[name]) groups[name] = [];
      groups[name].push(o);
    });
    return Object.entries(groups).map(([title, data]) => ({ title, data }));
  }, [withoutVoyage]);

  const sections = activeTab === "com" ? voyageSections : routeSections;
  const topPadding = Platform.OS === "web" ? 67 : insets.top;

  const toggleGroup = (key: string) => {
    setExpandedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <View
        style={[
          styles.header,
          {
            paddingTop: topPadding + 12,
            backgroundColor: theme.surface,
            borderBottomColor: theme.border,
          },
        ]}
      >
        <Text style={[styles.headerTitle, { color: theme.text }]}>Viagens</Text>
        <View style={[styles.tabs, { backgroundColor: theme.border }]}>
          {(["com", "sem"] as Tab[]).map((t) => (
            <Pressable
              key={t}
              style={[
                styles.tab,
                activeTab === t && { backgroundColor: Colors.primary },
              ]}
              onPress={() => setActiveTab(t)}
            >
              <Text
                style={[
                  styles.tabText,
                  { color: activeTab === t ? "#fff" : theme.textSecondary },
                ]}
              >
                {t === "com" ? "Com Viagem" : "Sem Viagem"}
              </Text>
              <View
                style={[
                  styles.tabBadge,
                  {
                    backgroundColor:
                      activeTab === t
                        ? "rgba(255,255,255,0.25)"
                        : theme.borderStrong,
                  },
                ]}
              >
                <Text
                  style={[
                    styles.tabBadgeText,
                    { color: activeTab === t ? "#fff" : theme.textMuted },
                  ]}
                >
                  {t === "com" ? withVoyage.length : withoutVoyage.length}
                </Text>
              </View>
            </Pressable>
          ))}
        </View>
      </View>

      {isLoading ? (
        <LoadingShimmer count={5} />
      ) : isError ? (
        <EmptyState icon="wifi-off" title="Erro ao carregar" subtitle="Tente novamente." />
      ) : sections.length === 0 ? (
        <EmptyState
          icon="truck"
          title={activeTab === "com" ? "Sem viagens" : "Sem ordens sem viagem"}
          subtitle="Nenhuma ordem encontrada nesta categoria."
        />
      ) : (
        <SectionList
          sections={sections}
          keyExtractor={(item) => String(item.id)}
          renderSectionHeader={({ section }) => {
            const isExpanded = expandedGroups.has(section.title);
            return (
              <Pressable
                style={[
                  styles.sectionHeader,
                  { backgroundColor: theme.surfaceSecondary, borderColor: theme.border },
                ]}
                onPress={() => toggleGroup(section.title)}
              >
                <View style={styles.sectionLeft}>
                  {activeTab === "com" ? (
                    <MaterialCommunityIcons name="truck-fast" size={16} color={Colors.primary} />
                  ) : (
                    <MaterialCommunityIcons name="map-marker-radius" size={16} color="#64748B" />
                  )}
                  <Text style={[styles.sectionTitle, { color: theme.text }]}>
                    {section.title}
                  </Text>
                </View>
                <View style={styles.sectionRight}>
                  <View style={[styles.countBadge, { backgroundColor: theme.border }]}>
                    <Text style={[styles.countText, { color: theme.textSecondary }]}>
                      {section.data.length}
                    </Text>
                  </View>
                  <Feather
                    name={isExpanded ? "chevron-up" : "chevron-down"}
                    size={16}
                    color={theme.textMuted}
                  />
                </View>
              </Pressable>
            );
          }}
          renderItem={({ item, section }) => {
            if (!expandedGroups.has(section.title)) return null;
            return (
              <ServiceOrderCard
                order={item}
                onPress={() =>
                  router.push({ pathname: "/order/[id]", params: { id: item.identifier || String(item.id) } })
                }
              />
            );
          }}
          refreshControl={
            <RefreshControl
              refreshing={!!isRefetching}
              onRefresh={() => refetch()}
              tintColor={Colors.primary}
            />
          }
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
          contentInsetAdjustmentBehavior="automatic"
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    paddingHorizontal: 16,
    paddingBottom: 16,
    borderBottomWidth: 1,
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: "700",
    fontFamily: "Inter_700Bold",
    marginBottom: 12,
  },
  tabs: {
    flexDirection: "row",
    borderRadius: 12,
    padding: 3,
    gap: 2,
  },
  tab: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 8,
    borderRadius: 10,
    gap: 6,
  },
  tabText: {
    fontSize: 13,
    fontWeight: "600",
    fontFamily: "Inter_600SemiBold",
  },
  tabBadge: {
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 5,
  },
  tabBadgeText: {
    fontSize: 11,
    fontWeight: "700",
    fontFamily: "Inter_700Bold",
  },
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginHorizontal: 16,
    marginTop: 12,
    marginBottom: 0,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 14,
    borderWidth: 1,
  },
  sectionLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    flex: 1,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: "600",
    fontFamily: "Inter_600SemiBold",
    flex: 1,
  },
  sectionRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  countBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  countText: {
    fontSize: 12,
    fontWeight: "600",
    fontFamily: "Inter_600SemiBold",
  },
  list: { paddingVertical: 8, paddingBottom: 32 },
});
