import { Feather, MaterialCommunityIcons } from "@expo/vector-icons";
import { router } from "expo-router";
import React, { useMemo, useState, useEffect, useCallback } from "react";
import {
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
import { Colors } from "@/constants/colors";
import { useTheme } from "@/constants/theme";
import { useAuth } from "@/context/AuthContext";
import {
  getServicesOrders,
  getRouteName,
  getVoyageName,
} from "@/services/servicesOrders";
import { refreshAuthToken } from "@/lib/token-sync";
import type { ServiceOrder } from "@/services/api";
import { useQuery, useQueryClient } from "@tanstack/react-query";

export default function RoutesScreen() {
  const insets = useSafeAreaInsets();
  const { theme } = useTheme();
  const { credentials, baseUrl, logout } = useAuth();
  const queryClient = useQueryClient();
  const [expandedRoutes, setExpandedRoutes] = useState<Set<string>>(new Set());
  const [expandedVoyages, setExpandedVoyages] = useState<Set<string>>(new Set());
  const [refreshAttempts, setRefreshAttempts] = useState(0);
  const MAX_REFRESH_ATTEMPTS = 3;

  const { data, isLoading, isError, refetch, isRefetching, error } = useQuery({
    queryKey: ["service_orders_routes", baseUrl],
    queryFn: async () => {
      if (!credentials) throw new Error("Não autenticado");

      // Filtro padrão de 30 dias antes e 7 dias depois (igual à tela principal)
      const now = new Date();
      const thirtyDaysAgo = new Date(now);
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 7);
      const sevenDaysAfter = new Date(now);
      sevenDaysAfter.setDate(sevenDaysAfter.getDate() + 7);

      const startDate = thirtyDaysAgo.toISOString().split('T')[0];
      const endDate = sevenDaysAfter.toISOString().split('T')[0];

      // Busca OS com filtro de 30 dias antes + 7 dias depois com cache SQLite
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
    // 💾 Mantém dados por 30 minutos antes de considerar "stale"
    staleTime: 30 * 60 * 1000, // 30 minutos
    // 🗑️ Garbage collection após 2 horas
    gcTime: 2 * 60 * 60 * 1000, // 2 horas
    retry: (failureCount, error) => {
      if (error.message === "SESSION_EXPIRED") return false;
      return failureCount < 2;
    },
  });

  // Handle SESSION_EXPIRED com refresh automático
  useEffect(() => {
    if (isError && error?.message === "SESSION_EXPIRED" && refreshAttempts < MAX_REFRESH_ATTEMPTS) {
      console.log(`[RoutesScreen] SESSION_EXPIRED - Refresh attempt ${refreshAttempts + 1}/${MAX_REFRESH_ATTEMPTS}`);
      
      const attemptRefreshAndRetry = async () => {
        const baseUrlForRefresh = baseUrl || "https://testeaplicativo.econtrole.com/api";
        const refreshed = await refreshAuthToken(baseUrlForRefresh);
        
        if (refreshed) {
          console.log("[RoutesScreen] ✅ Token refreshed - retrying once");
          setRefreshAttempts(prev => prev + 1);
          // Aguarda um momento para o cache propagar
          setTimeout(() => {
            queryClient.invalidateQueries({ queryKey: ["service_orders_routes"] });
          }, 500);
        } else {
          console.error("[RoutesScreen] ❌ Refresh failed - stopping retries");
          setRefreshAttempts(MAX_REFRESH_ATTEMPTS); // Para de tentar
          // Não faz logout automático - mantém dados em cache visíveis
        }
      };
      
      attemptRefreshAndRetry();
    }
  }, [isError, error, refreshAttempts, baseUrl, logout, queryClient]);

  interface VoyageGroup {
    voyageName: string;
    orders: ServiceOrder[];
  }

  interface RouteGroup {
    routeName: string;
    voyages: VoyageGroup[];
    totalOrders: number;
  }

  const routeGroups = useMemo(() => {
    const routes: Record<string, Record<string, ServiceOrder[]>> = {};
    (data || []).forEach((o) => {
      if (!o) return;
      const route = getRouteName(o);
      const voyage = getVoyageName(o) || "Sem Viagem";
      if (!routes[route]) routes[route] = {};
      if (!routes[route][voyage]) routes[route][voyage] = [];
      routes[route][voyage].push(o);
    });
    return Object.entries(routes).map(([routeName, voyages]) => ({
      routeName,
      voyages: Object.entries(voyages).map(([voyageName, orders]) => ({
        voyageName,
        orders: orders.filter((o): o is ServiceOrder => !!o),
      })),
      totalOrders: Object.values(voyages).reduce((sum, os) => sum + os.length, 0),
    }));
  }, [data]);

  const sections = routeGroups.map((rg) => ({
    title: rg.routeName,
    totalOrders: rg.totalOrders,
    voyages: rg.voyages,
    data: [rg],
  }));

  const topPadding = Platform.OS === "web" ? 67 : insets.top;

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
        <Text style={[styles.headerTitle, { color: theme.text }]}>Rotas</Text>
        <View style={styles.statsRow}>
          <View style={[styles.stat, { backgroundColor: theme.surfaceSecondary, borderColor: theme.border }]}>
            <MaterialCommunityIcons name="routes" size={14} color={Colors.primary} />
            <Text style={[styles.statText, { color: theme.textSecondary }]}>
              {routeGroups.length} rotas
            </Text>
          </View>
          <View style={[styles.stat, { backgroundColor: theme.surfaceSecondary, borderColor: theme.border }]}>
            <Feather name="clipboard" size={14} color={Colors.primary} />
            <Text style={[styles.statText, { color: theme.textSecondary }]}>
              {(data || []).length} ordens
            </Text>
          </View>
        </View>
      </View>

      {isLoading ? (
        <LoadingShimmer count={5} />
      ) : isError ? (
        <EmptyState icon="wifi-off" title="Erro ao carregar" subtitle="Tente novamente." />
      ) : routeGroups.length === 0 ? (
        <EmptyState icon="map" title="Sem rotas" subtitle="Nenhuma rota encontrada." />
      ) : (
        <SectionList
          sections={sections}
          keyExtractor={(item, index) => `route-${item.routeName}-${index}`}
          renderSectionHeader={({ section }) => {
            const isExpanded = expandedRoutes.has(section.title);
            return (
              <Pressable
                style={[
                  styles.routeHeader,
                  {
                    backgroundColor: theme.surface,
                    borderColor: theme.border,
                    borderLeftColor: Colors.primary,
                  },
                ]}
                onPress={() => {
                  setExpandedRoutes((prev) => {
                    const next = new Set(prev);
                    if (next.has(section.title)) next.delete(section.title);
                    else next.add(section.title);
                    return next;
                  });
                }}
              >
                <View style={styles.routeLeft}>
                  <MaterialCommunityIcons
                    name="road-variant"
                    size={18}
                    color={Colors.primary}
                  />
                  <View>
                    <Text style={[styles.routeName, { color: theme.text }]}>
                      {section.title}
                    </Text>
                    <Text style={[styles.routeMeta, { color: theme.textMuted }]}>
                      {section.voyages.length} viagens · {section.totalOrders} OS
                    </Text>
                  </View>
                </View>
                <Feather
                  name={isExpanded ? "chevron-up" : "chevron-right"}
                  size={18}
                  color={theme.textMuted}
                />
              </Pressable>
            );
          }}
          renderItem={({ item }) => {
            if (!expandedRoutes.has(item.routeName)) return null;
            return (
              <View>
                {item.voyages.map((voyage) => {
                  const vKey = `${item.routeName}::${voyage.voyageName}`;
                  const isVExpanded = expandedVoyages.has(vKey);
                  return (
                    <View key={vKey}>
                      <Pressable
                        style={[
                          styles.voyageHeader,
                          {
                            backgroundColor: theme.surfaceSecondary,
                            borderColor: theme.border,
                          },
                        ]}
                        onPress={() => {
                          setExpandedVoyages((prev) => {
                            const next = new Set(prev);
                            if (next.has(vKey)) next.delete(vKey);
                            else next.add(vKey);
                            return next;
                          });
                        }}
                      >
                        <View style={styles.voyageLeft}>
                          <Feather name="truck" size={13} color="#64748B" />
                          <Text style={[styles.voyageName, { color: theme.textSecondary }]}>
                            {voyage.voyageName}
                          </Text>
                        </View>
                        <View style={styles.voyageRight}>
                          <Text style={[styles.voyageCount, { color: theme.textMuted }]}>
                            {voyage.orders.length} OS
                          </Text>
                          <Feather
                            name={isVExpanded ? "chevron-up" : "chevron-down"}
                            size={14}
                            color={theme.textMuted}
                          />
                        </View>
                      </Pressable>
                      {isVExpanded &&
                        voyage.orders.map((o) => (
                          <ServiceOrderCard
                            key={String(o.id)}
                            order={o}
                            onPress={() =>
                              router.push({
                                pathname: "/order/[id]",
                                params: { id: o.identifier || String(o.id) },
                              })
                            }
                          />
                        ))}
                    </View>
                  );
                })}
              </View>
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
    marginBottom: 10,
  },
  statsRow: {
    flexDirection: "row",
    gap: 10,
  },
  stat: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 10,
    borderWidth: 1,
  },
  statText: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    fontWeight: "500",
  },
  routeHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginHorizontal: 16,
    marginTop: 12,
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    borderLeftWidth: 4,
  },
  routeLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    flex: 1,
  },
  routeName: {
    fontSize: 15,
    fontWeight: "600",
    fontFamily: "Inter_600SemiBold",
  },
  routeMeta: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    marginTop: 2,
  },
  voyageHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginHorizontal: 28,
    marginTop: 6,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
  },
  voyageLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  voyageName: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
  },
  voyageRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  voyageCount: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
  },
  list: { paddingVertical: 8, paddingBottom: 32 },
});
