import { Feather, MaterialCommunityIcons } from "@expo/vector-icons";
import { Image } from "expo-image";
import * as ImagePicker from "expo-image-picker";
import * as Haptics from "expo-haptics";
import { router, useLocalSearchParams } from "expo-router";
import React, { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { StatusBadge } from "@/components/StatusBadge";
import { Colors } from "@/constants/colors";
import { useTheme } from "@/constants/theme";
import { useAuth } from "@/context/AuthContext";
import {
  fetchServiceOrder,
  getRouteName,
  getVoyageName,
  getAddressName,
  getClientName,
  uploadPhoto,
  type ServiceOrder,
} from "@/services/api";
import { useQuery, useQueryClient } from "@tanstack/react-query";

function InfoRow({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  const { theme } = useTheme();
  if (!value) return null;
  return (
    <View style={styles.infoRow}>
      <View style={styles.infoIcon}>{icon}</View>
      <View style={styles.infoContent}>
        <Text style={[styles.infoLabel, { color: theme.textMuted }]}>{label}</Text>
        <Text style={[styles.infoValue, { color: theme.text }]}>{value}</Text>
      </View>
    </View>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  const { theme } = useTheme();
  return (
    <View style={[styles.section, { backgroundColor: theme.surface, borderColor: theme.border }]}>
      <Text style={[styles.sectionTitle, { color: theme.textSecondary }]}>{title}</Text>
      {children}
    </View>
  );
}

export default function OrderDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>(); // id agora é o identifier
  const insets = useSafeAreaInsets();
  const { theme } = useTheme();
  const { credentials, baseUrl } = useAuth();
  const queryClient = useQueryClient();
  const [uploadingPhoto, setUploadingPhoto] = useState(false);

  // Tenta obter os dados do cache primeiro (da lista de OS)
  // A query key na lista é ["service_orders", filters, baseUrl], então buscamos todas
  const queryCache = queryClient.getQueryCache();
  const allQueries = queryCache.findAll(["service_orders"]) as any[];

  // Pega a primeira query encontrada e procura a OS pelo identifier
  let cachedOrder: ServiceOrder | undefined;
  for (const query of allQueries) {
    const orders = query.state.data as ServiceOrder[] | undefined;
    if (orders) {
      cachedOrder = orders.find(o => (o.identifier && o.identifier === id) || String(o.id) === id);
      if (cachedOrder) break;
    }
  }

  const { data: order, isLoading, isError, refetch, isRefetching } = useQuery({
    queryKey: ["service_order", id, baseUrl],
    queryFn: async () => {
      if (!credentials) throw new Error("Não autenticado");
      // Se já temos no cache, usa os dados do cache
      if (cachedOrder) {
        return cachedOrder;
      }
      return fetchServiceOrder({ baseUrl, credentials }, id!);
    },
    enabled: !!credentials && !!id,
    retry: false,
    initialData: cachedOrder, // Usa dados do cache como dados iniciais
  });

  const handleAddPhoto = async (source: "camera" | "gallery") => {
    const result =
      source === "camera"
        ? await ImagePicker.launchCameraAsync({
            mediaTypes: "images",
            quality: 0.8,
            allowsEditing: true,
          })
        : await ImagePicker.launchImageLibraryAsync({
            mediaTypes: "images",
            quality: 0.8,
            allowsEditing: true,
          });

    if (result.canceled || !result.assets?.[0]) return;
    if (!credentials || !order) return;

    setUploadingPhoto(true);
    try {
      await uploadPhoto({ baseUrl, credentials }, order.id, result.assets[0].uri);
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      queryClient.invalidateQueries({ queryKey: ["service_order", id] });
      Alert.alert("Foto enviada", "Foto adicionada com sucesso.");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Não foi possível enviar a foto.";
      Alert.alert("Erro", msg);
    } finally {
      setUploadingPhoto(false);
    }
  };

  const handlePhotoOptions = () => {
    Alert.alert("Adicionar foto", "Escolha uma opção:", [
      { text: "Câmera", onPress: () => handleAddPhoto("camera") },
      { text: "Galeria", onPress: () => handleAddPhoto("gallery") },
      { text: "Cancelar", style: "cancel" },
    ]);
  };

  const topPadding = Platform.OS === "web" ? 67 : insets.top;

  if (isLoading) {
    return (
      <View style={[styles.loadingContainer, { backgroundColor: theme.background }]}>
        <View style={[styles.loadingHeader, { paddingTop: topPadding + 12, backgroundColor: theme.surface, borderBottomColor: theme.border }]}>
          <Pressable style={styles.backBtn} onPress={() => router.back()}>
            <Feather name="arrow-left" size={22} color={theme.text} />
          </Pressable>
        </View>
        <View style={styles.loadingContent}>
          <ActivityIndicator size="large" color={Colors.primary} />
          <Text style={[styles.loadingText, { color: theme.textMuted }]}>Carregando OS...</Text>
        </View>
      </View>
    );
  }

  if (isError || !order) {
    return (
      <View style={[styles.loadingContainer, { backgroundColor: theme.background }]}>
        <View style={[styles.loadingHeader, { paddingTop: topPadding + 12, backgroundColor: theme.surface, borderBottomColor: theme.border }]}>
          <Pressable style={styles.backBtn} onPress={() => router.back()}>
            <Feather name="arrow-left" size={22} color={theme.text} />
          </Pressable>
        </View>
        <View style={styles.loadingContent}>
          <Feather name="alert-circle" size={48} color="#EF4444" />
          <Text style={[styles.loadingText, { color: theme.text }]}>Erro ao carregar OS</Text>
          <Pressable style={styles.retryBtn} onPress={() => refetch()}>
            <Text style={styles.retryText}>Tentar novamente</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  const clientName = getClientName(order);
  const address = getAddressName(order);
  const routeName = getRouteName(order);
  const voyageName = getVoyageName(order);

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <View
        style={[styles.header, { paddingTop: topPadding + 8, backgroundColor: theme.surface, borderBottomColor: theme.border }]}
      >
        <View style={styles.headerContent}>
          <Pressable style={styles.backBtn} onPress={() => router.back()}>
            <Feather name="arrow-left" size={22} color={theme.text} />
          </Pressable>
          <View style={styles.headerCenter}>
            <Text style={[styles.headerOS, { color: theme.textMuted }]}>
              OS {order.identifier || `#${String(order.id).padStart(4, "0")}`}
            </Text>
            <StatusBadge status={order.status} small />
          </View>
          <View style={styles.headerRight} />
        </View>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={!!isRefetching} onRefresh={() => refetch()} tintColor={Colors.primary} />
        }
        contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 100 }]}
      >
        <View style={[styles.clientCard, { backgroundColor: Colors.primary }]}>
          <View style={styles.clientIcon}>
            <Feather name="user" size={22} color="#fff" />
          </View>
          <View style={styles.clientInfo}>
            <Text style={styles.clientName}>{clientName}</Text>
            {order.scheduled_date ? (
              <Text style={styles.clientDate}>
                {new Date(order.scheduled_date).toLocaleDateString("pt-BR")}
              </Text>
            ) : null}
          </View>
        </View>

        <Section title="LOCALIZAÇÃO">
          <InfoRow icon={<Feather name="map-pin" size={15} color={theme.textMuted} />} label="Endereço" value={address} />
          {order.city ? (
            <InfoRow
              icon={<Feather name="navigation" size={15} color={theme.textMuted} />}
              label="Cidade"
              value={`${order.city}${order.state ? ` - ${order.state}` : ""}${order.zip ? ` - ${order.zip}` : ""}`}
            />
          ) : null}
        </Section>

        <Section title="LOGÍSTICA">
          <InfoRow icon={<MaterialCommunityIcons name="routes" size={15} color={theme.textMuted} />} label="Rota" value={routeName} />
          {voyageName ? (
            <InfoRow icon={<Feather name="truck" size={15} color={theme.textMuted} />} label="Viagem" value={voyageName} />
          ) : null}
          {order.collector ? (
            <InfoRow icon={<Feather name="user-check" size={15} color={theme.textMuted} />} label="Coletor" value={order.collector} />
          ) : null}
          {order.start_km ? (
            <InfoRow icon={<Feather name="navigation-2" size={15} color={theme.textMuted} />} label="KM Inicial" value={order.start_km} />
          ) : null}
          {order.end_km ? (
            <InfoRow icon={<Feather name="navigation-2" size={15} color={theme.textMuted} />} label="KM Final" value={order.end_km} />
          ) : null}
        </Section>

        {order.services && order.services.length > 0 ? (
          <Section title="SERVIÇOS">
            {order.services.map((s, i) => (
              <View key={String(s.id || i)} style={[styles.listItem, { borderBottomColor: theme.border }]}>
                <View style={[styles.listDot, { backgroundColor: Colors.accent }]} />
                <View style={styles.listContent}>
                  <Text style={[styles.listTitle, { color: theme.text }]}>{s.name}</Text>
                  {s.description ? <Text style={[styles.listSub, { color: theme.textMuted }]}>{s.description}</Text> : null}
                  {s.quantity ? <Text style={[styles.listSub, { color: theme.textMuted }]}>{s.quantity} {s.unit || "un."}</Text> : null}
                </View>
              </View>
            ))}
          </Section>
        ) : null}

        {order.equipments && order.equipments.length > 0 ? (
          <Section title="EQUIPAMENTOS">
            {order.equipments.map((e, i) => (
              <View key={String(e.id || i)} style={[styles.listItem, { borderBottomColor: theme.border }]}>
                <MaterialCommunityIcons name="package-variant" size={16} color={theme.textMuted} />
                <View style={styles.listContent}>
                  <Text style={[styles.listTitle, { color: theme.text }]}>{e.name}</Text>
                  {e.serial ? <Text style={[styles.listSub, { color: theme.textMuted }]}>S/N: {e.serial}</Text> : null}
                </View>
              </View>
            ))}
          </Section>
        ) : null}

        {(order.notes || order.driver_observations) ? (
          <Section title="OBSERVAÇÕES">
            <Text style={[styles.notes, { color: theme.textSecondary }]}>
              {order.notes || order.driver_observations}
            </Text>
          </Section>
        ) : null}

        <Section title="FOTOS">
          {order.photos && order.photos.length > 0 ? (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.photosScroll}>
              {order.photos.map((uri, i) => (
                <Image key={i} source={{ uri }} style={styles.photo} contentFit="cover" />
              ))}
              <Pressable style={[styles.addPhotoBtn, { borderColor: theme.border }]} onPress={handlePhotoOptions}>
                <Feather name="plus" size={24} color={theme.textMuted} />
              </Pressable>
            </ScrollView>
          ) : (
            <View style={styles.noPhotos}>
              <Pressable
                style={[styles.addPhotoLarge, { borderColor: theme.border, backgroundColor: theme.surfaceSecondary }]}
                onPress={handlePhotoOptions}
              >
                {uploadingPhoto ? (
                  <ActivityIndicator color={Colors.primary} />
                ) : (
                  <>
                    <Feather name="camera" size={28} color={theme.textMuted} />
                    <Text style={[styles.addPhotoText, { color: theme.textMuted }]}>Adicionar foto</Text>
                  </>
                )}
              </Pressable>
            </View>
          )}
        </Section>

        {order.mtr_id ? (
          <View style={[styles.mtrSuccess, { backgroundColor: "#DCFCE7", borderColor: "#86EFAC" }]}>
            <Feather name="check-circle" size={20} color="#16A34A" />
            <View>
              <Text style={styles.mtrSuccessTitle}>MTR Emitido</Text>
              <Text style={styles.mtrSuccessId}>ID: {order.mtr_id}</Text>
            </View>
          </View>
        ) : null}
      </ScrollView>

      <View style={[styles.actions, { paddingBottom: insets.bottom + 12, backgroundColor: theme.surface, borderTopColor: theme.border }]}>
        {/* Botão Iniciar Coleta */}
        <Pressable
          style={[styles.collectBtn]}
          onPress={() => router.push(`/order/update?id=${id}`)}
        >
          <Feather name="clipboard" size={18} color="#fff" />
          <Text style={styles.collectBtnText}>Iniciar Coleta</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  loadingContainer: { flex: 1 },
  loadingHeader: { paddingHorizontal: 16, paddingBottom: 14, borderBottomWidth: 1 },
  loadingContent: { flex: 1, alignItems: "center", justifyContent: "center", gap: 16 },
  loadingText: { fontSize: 15, fontFamily: "Inter_400Regular" },
  retryBtn: { backgroundColor: Colors.primary, paddingHorizontal: 24, paddingVertical: 12, borderRadius: 12 },
  retryText: { color: "#fff", fontWeight: "700", fontFamily: "Inter_700Bold" },
  header: { paddingHorizontal: 16, paddingBottom: 14, borderBottomWidth: 1 },
  headerContent: { flexDirection: "row", alignItems: "center" },
  backBtn: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center" },
  headerCenter: { flex: 1, alignItems: "center", gap: 4 },
  headerOS: { fontSize: 13, fontFamily: "Inter_400Regular" },
  headerRight: { width: 40 },
  scrollContent: { padding: 16, gap: 16 },
  clientCard: { borderRadius: 18, padding: 18, flexDirection: "row", alignItems: "center", gap: 14 },
  clientIcon: { width: 48, height: 48, borderRadius: 24, backgroundColor: "rgba(255,255,255,0.2)", alignItems: "center", justifyContent: "center" },
  clientInfo: { flex: 1 },
  clientName: { color: "#fff", fontSize: 18, fontWeight: "700", fontFamily: "Inter_700Bold" },
  clientDate: { color: "rgba(255,255,255,0.75)", fontSize: 13, fontFamily: "Inter_400Regular", marginTop: 3 },
  section: { borderRadius: 16, overflow: "hidden", borderWidth: 1, paddingBottom: 4 },
  sectionTitle: { fontSize: 11, fontWeight: "600", letterSpacing: 0.8, fontFamily: "Inter_600SemiBold", paddingHorizontal: 16, paddingTop: 14, paddingBottom: 8, textTransform: "uppercase" },
  infoRow: { flexDirection: "row", alignItems: "flex-start", paddingHorizontal: 16, paddingVertical: 8, gap: 12 },
  infoIcon: { width: 24, alignItems: "center", marginTop: 2 },
  infoContent: { flex: 1 },
  infoLabel: { fontSize: 11, fontFamily: "Inter_400Regular", marginBottom: 2 },
  infoValue: { fontSize: 14, fontFamily: "Inter_400Regular", lineHeight: 20 },
  listItem: { flexDirection: "row", alignItems: "flex-start", paddingHorizontal: 16, paddingVertical: 10, borderBottomWidth: 1, gap: 10 },
  listDot: { width: 8, height: 8, borderRadius: 4, marginTop: 5 },
  listContent: { flex: 1 },
  listTitle: { fontSize: 14, fontWeight: "500", fontFamily: "Inter_400Regular" },
  listSub: { fontSize: 12, fontFamily: "Inter_400Regular", marginTop: 2 },
  notes: { fontSize: 14, fontFamily: "Inter_400Regular", lineHeight: 20, padding: 16, paddingTop: 4 },
  photosScroll: { paddingHorizontal: 16, paddingBottom: 12 },
  photo: { width: 100, height: 100, borderRadius: 10, marginRight: 8 },
  addPhotoBtn: { width: 100, height: 100, borderRadius: 10, borderWidth: 1.5, borderStyle: "dashed", alignItems: "center", justifyContent: "center" },
  noPhotos: { padding: 16, paddingTop: 4 },
  addPhotoLarge: { height: 100, borderRadius: 12, borderWidth: 1.5, borderStyle: "dashed", alignItems: "center", justifyContent: "center", gap: 8 },
  addPhotoText: { fontSize: 13, fontFamily: "Inter_400Regular" },
  mtrSuccess: { flexDirection: "row", alignItems: "center", gap: 12, padding: 16, borderRadius: 14, borderWidth: 1 },
  mtrSuccessTitle: { color: "#15803D", fontSize: 14, fontWeight: "600", fontFamily: "Inter_600SemiBold" },
  mtrSuccessId: { color: "#16A34A", fontSize: 12, fontFamily: "Inter_400Regular", marginTop: 2 },
  actions: { position: "absolute", bottom: 0, left: 0, right: 0, padding: 16, paddingTop: 12, borderTopWidth: 1 },
  collectBtn: { backgroundColor: "#059669", flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, paddingVertical: 15, borderRadius: 16, shadowColor: "#059669", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 5 },
  collectBtnText: { color: "#fff", fontSize: 15, fontWeight: "700", fontFamily: "Inter_700Bold" },
});
