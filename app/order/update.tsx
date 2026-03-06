import { Feather, MaterialCommunityIcons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { Linking } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import React, { useState, useRef } from "react";
import {
  ActivityIndicator,
  Alert,
  Animated,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Colors } from "@/constants/colors";
import { useTheme } from "@/constants/theme";
import { useAuth } from "@/context/AuthContext";
import { emitMTR, finishServiceOrder, type MtrResult, type ServiceOrder, type ServiceExecution } from "@/services/api";
import { useQueryClient } from "@tanstack/react-query";

interface ServiceWeight {
  serviceId: string | number;
  serviceName: string;
  weight: string;
  unit?: string;
}

interface EquipmentItem {
  id: number | string;
  name: string;
  serial?: string;
  selected: boolean;
}

export default function UpdateOrderScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const { theme } = useTheme();
  const { credentials, baseUrl } = useAuth();
  const queryClient = useQueryClient();

  // Estados de coleta
  const [serviceWeights, setServiceWeights] = useState<ServiceWeight[]>([]);
  const [collectedEquipment, setCollectedEquipment] = useState<EquipmentItem[]>([]);
  const [lendedEquipment, setLendedEquipment] = useState<EquipmentItem[]>([]);
  const [arrivalTime, setArrivalTime] = useState("");
  const [departureTime, setDepartureTime] = useState("");
  const [startKm, setStartKm] = useState("");
  const [endKm, setEndKm] = useState("");
  const [certificateMemo, setCertificateMemo] = useState("");
  const [driverObservations, setDriverObservations] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // Estados para MTR
  const [isMtrLoading, setIsMtrLoading] = useState(false);
  const [mtrResult, setMtrResult] = useState<MtrResult | null>(null);
  const mtrScale = useRef(new Animated.Value(1)).current;

  // Busca dados da OS do cache - mesma abordagem da tela de detalhes
  const queryCache = queryClient.getQueryCache();
  const allQueries = queryCache.findAll(["service_orders"]);
  
  let cachedOrder: ServiceOrder | undefined;
  for (const query of allQueries) {
    const orders = query.state.data as ServiceOrder[] | undefined;
    if (orders) {
      cachedOrder = orders.find(o => String(o.id) === id);
      if (cachedOrder) break;
    }
  }
  
  const order = cachedOrder;

  // Handler para abrir Google Maps
  const handleOpenMap = () => {
    if (!order?.address) return;
    
    const address = typeof order.address === "string" ? order.address : order.address;
    const lat = typeof address !== "string" ? address.latitude : null;
    const lng = typeof address !== "string" ? address.longitude : null;
    
    let url = "";
    if (lat && lng) {
      // Usa coordenadas se disponíveis
      url = `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`;
    } else {
      // Usa endereço formatado
      const addressString = typeof address === "string" ? address : address.to_s || "";
      url = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(addressString)}`;
    }
    
    Linking.openURL(url).catch(() => {
      Alert.alert("Erro", "Não foi possível abrir o mapa.");
    });
  };

  // Handler para Emitir MTR
  const animateMtrPress = (pressed: boolean) => {
    Animated.spring(mtrScale, {
      toValue: pressed ? 0.95 : 1,
      useNativeDriver: true,
      speed: 30,
      bounciness: 0,
    }).start();
  };

  const handleEmitMTR = async () => {
    if (!order) return;
    
    Alert.alert(
      "Emitir MTR",
      "Deseja emitir o Manifesto de Transporte de Resíduos para esta OS?",
      [
        { text: "Cancelar", style: "cancel" },
        {
          text: "Emitir",
          onPress: async () => {
            setIsMtrLoading(true);
            animateMtrPress(true);
            try {
              const result = await emitMTR(order.id, `OS-${order.id}`);
              setMtrResult(result);
              await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
              Alert.alert(
                "MTR Emitido",
                result.numero_mtr
                  ? `Número MTR: ${result.numero_mtr}`
                  : "MTR emitido com sucesso!"
              );
            } catch (err: unknown) {
              const msg = err instanceof Error ? err.message : "Erro ao emitir MTR";
              await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
              Alert.alert("Erro", msg);
            } finally {
              setIsMtrLoading(false);
              animateMtrPress(false);
            }
          },
        },
      ]
    );
  };

  // Inicializa pesos dos serviços quando os dados carregam
  React.useEffect(() => {
    if (order?.service_executions) {
      const weights = order.service_executions.map((exec: ServiceExecution) => ({
        serviceId: exec.service?.id || "",
        serviceName: exec.service?.name || "Serviço sem nome",
        weight: "",
        unit: exec.unit?.abbreviation || exec.unit?.name || "kg",
      }));
      setServiceWeights(weights);
    }

    // Inicializa equipamentos coletados
    if (order?.collected_equipment) {
      setCollectedEquipment(
        order.collected_equipment.map((eq: any) => ({
          ...eq,
          selected: false,
        }))
      );
    }

    // Inicializa equipamentos emprestados
    if (order?.lended_equipment) {
      setLendedEquipment(
        order.lended_equipment.map((eq: any) => ({
          ...eq,
          selected: false,
        }))
      );
    }

    // Preenche dados existentes
    if (order) {
      if (order.arrival_date) {
        const date = new Date(order.arrival_date);
        setArrivalTime(date.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }));
      }
      if (order.departure_date) {
        const date = new Date(order.departure_date);
        setDepartureTime(date.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }));
      }
      setStartKm(order.start_km || "");
      setEndKm(order.end_km || "");
      setCertificateMemo(order.certificate_memo || "");
      setDriverObservations(order.driver_observations || "");
    }
  }, [order]);

  const handleServiceWeightChange = (serviceId: string | number, weight: string) => {
    setServiceWeights(prev =>
      prev.map(sw => (sw.serviceId === serviceId ? { ...sw, weight } : sw))
    );
  };

  const toggleCollectedEquipment = (id: number | string) => {
    setCollectedEquipment(prev =>
      prev.map(eq => (eq.id === id ? { ...eq, selected: !eq.selected } : eq))
    );
  };

  const toggleLendedEquipment = (id: number | string) => {
    setLendedEquipment(prev =>
      prev.map(eq => (eq.id === id ? { ...eq, selected: !eq.selected } : eq))
    );
  };

  const handleSubmit = async () => {
    if (!order) return;

    setIsSubmitting(true);
    try {
      // Prepara dados para envio
      const serviceExecutions = serviceWeights
        .filter(sw => sw.weight && sw.weight.trim() !== "")
        .map(sw => {
          const exec = order.service_executions?.find(
            (e: ServiceExecution) => String(e.service?.id) === String(sw.serviceId)
          );
          return {
            id: exec?.id,
            service_id: sw.serviceId,
            amount: parseFloat(sw.weight.replace(",", ".")),
            service_item_weights: exec?.service_item_weights,
          };
        });

      const collectedEq = collectedEquipment.filter(eq => eq.selected);
      const lendedEq = lendedEquipment.filter(eq => eq.selected);

      // Converte horários para ISO string
      const arrivalDate = arrivalTime ? new Date().toISOString() : null;
      const departureDate = departureTime ? new Date().toISOString() : null;

      // Atualiza OS com dados de coleta
      const updates: Partial<ServiceOrder> = {
        arrival_date: arrivalDate || undefined,
        departure_date: departureDate || undefined,
        start_km: startKm || undefined,
        end_km: endKm || undefined,
        certificate_memo: certificateMemo || undefined,
        driver_observations: driverObservations || undefined,
        collected_equipment: collectedEq,
        lended_equipment: lendedEq,
        service_executions: serviceExecutions.length > 0 ? serviceExecutions : undefined,
      };

      console.log("[UpdateOrder] Enviando para conferência:", JSON.stringify(updates, null, 2));

      // Envia para conferência
      await finishServiceOrder(
        { baseUrl, credentials },
        order.id,
        updates as Record<string, unknown>
      );

      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

      Alert.alert(
        "Sucesso!",
        "Ordem de serviço enviada para conferência.",
        [
          {
            text: "OK",
            onPress: () => {
              // Invalida cache e volta para tela anterior
              queryClient.invalidateQueries({ queryKey: ["service_orders"] });
              queryClient.invalidateQueries({ queryKey: ["service_order", id] });
              router.back();
            },
          },
        ]
      );
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Erro ao enviar para conferência";
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert("Erro", msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  const topPadding = Platform.OS === "web" ? 67 : insets.top;

  if (!order) {
    return (
      <View style={[styles.container, { backgroundColor: theme.background }]}>
        <View style={[styles.header, { paddingTop: topPadding, backgroundColor: theme.surface }]}>
          <Pressable style={styles.backBtn} onPress={() => router.back()}>
            <Feather name="arrow-left" size={22} color={theme.text} />
          </Pressable>
          <Text style={[styles.headerTitle, { color: theme.text }]}>Coleta de Dados</Text>
        </View>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={Colors.primary} />
          <Text style={[styles.loadingText, { color: theme.textMuted }]}>Carregando...</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <View style={[styles.header, { paddingTop: topPadding, backgroundColor: theme.surface, borderBottomColor: theme.border }]}>
        <Pressable style={styles.backBtn} onPress={() => router.back()}>
          <Feather name="arrow-left" size={22} color={theme.text} />
        </Pressable>
        <Text style={[styles.headerTitle, { color: theme.text }]}>Coleta de Dados</Text>
        <View style={styles.headerRight} />
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: 120 }]}
      >
        {/* Informações da OS */}
        <View style={[styles.infoCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          <Text style={[styles.infoCardTitle, { color: theme.textSecondary }]}>
            OS #{String(order.id).padStart(4, "0")}
          </Text>
          <Text style={[styles.infoCardClient, { color: theme.text }]} numberOfLines={1}>
            {order.customer?.name || order.client_name || "Cliente"}
          </Text>
        </View>

        {/* Endereço com botão para mapa */}
        <Pressable onPress={handleOpenMap} style={[styles.addressCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          <View style={styles.addressContent}>
            <Feather name="map-pin" size={18} color={Colors.primary} />
            <View style={styles.addressTextContainer}>
              <Text style={[styles.addressLabel, { color: theme.textSecondary }]}>Endereço</Text>
              <Text style={[styles.addressValue, { color: theme.text }]} numberOfLines={2}>
                {typeof order.address === "string" ? order.address : order.address?.to_s || "Endereço não informado"}
              </Text>
            </View>
          </View>
          <View style={styles.mapBtn}>
            <Feather name="external-link" size={16} color={Colors.primary} />
            <Text style={[styles.mapBtnText, { color: Colors.primary }]}>Abrir Mapa</Text>
          </View>
        </Pressable>

        {/* Serviços e Pesos */}
        {serviceWeights.length > 0 && (
          <View style={[styles.section, { backgroundColor: theme.surface, borderColor: theme.border }]}>
            <View style={styles.sectionHeader}>
              <MaterialCommunityIcons name="scale-balance" size={18} color={theme.textSecondary} />
              <Text style={[styles.sectionTitle, { color: theme.textSecondary }]}>PESAGEM DOS SERVIÇOS</Text>
            </View>
            {serviceWeights.map((sw, index) => (
              <View key={String(sw.serviceId) + index} style={[styles.serviceRow, { borderBottomColor: theme.border }]}>
                <View style={styles.serviceInfo}>
                  <Text style={[styles.serviceName, { color: theme.text }]} numberOfLines={2}>
                    {sw.serviceName}
                  </Text>
                  {sw.unit && (
                    <Text style={[styles.serviceUnit, { color: theme.textMuted }]}>
                      Unidade: {sw.unit}
                    </Text>
                  )}
                </View>
                <View style={styles.weightInput}>
                  <TextInput
                    style={[styles.input, { color: theme.text, borderColor: theme.border, backgroundColor: theme.surfaceSecondary }]}
                    placeholder="0.00"
                    placeholderTextColor={theme.textMuted}
                    value={sw.weight}
                    onChangeText={(text) => handleServiceWeightChange(sw.serviceId, text)}
                    keyboardType="decimal-pad"
                    selectTextOnFocus
                  />
                </View>
              </View>
            ))}
          </View>
        )}

        {/* Equipamentos Coletados */}
        {collectedEquipment.length > 0 && (
          <View style={[styles.section, { backgroundColor: theme.surface, borderColor: theme.border }]}>
            <View style={styles.sectionHeader}>
              <Feather name="download" size={18} color={theme.textSecondary} />
              <Text style={[styles.sectionTitle, { color: theme.textSecondary }]}>EQUIPAMENTOS COLETADOS</Text>
            </View>
            {collectedEquipment.map((eq) => (
              <Pressable
                key={String(eq.id)}
                style={[
                  styles.equipmentRow,
                  { borderBottomColor: theme.border },
                  eq.selected && { backgroundColor: Colors.primary + "20" },
                ]}
                onPress={() => toggleCollectedEquipment(eq.id)}
              >
                <View style={[styles.checkbox, { borderColor: eq.selected ? Colors.primary : theme.border, backgroundColor: eq.selected ? Colors.primary : "transparent" }]}>
                  {eq.selected && <Feather name="check" size={14} color="#fff" />}
                </View>
                <View style={styles.equipmentInfo}>
                  <Text style={[styles.equipmentName, { color: theme.text }]}>{eq.name}</Text>
                  {eq.serial && (
                    <Text style={[styles.equipmentSerial, { color: theme.textMuted }]}>
                      S/N: {eq.serial}
                    </Text>
                  )}
                </View>
              </Pressable>
            ))}
          </View>
        )}

        {/* Equipamentos Emprestados */}
        {lendedEquipment.length > 0 && (
          <View style={[styles.section, { backgroundColor: theme.surface, borderColor: theme.border }]}>
            <View style={styles.sectionHeader}>
              <Feather name="upload" size={18} color={theme.textSecondary} />
              <Text style={[styles.sectionTitle, { color: theme.textSecondary }]}>EQUIPAMENTOS EMPRESTADOS</Text>
            </View>
            {lendedEquipment.map((eq) => (
              <Pressable
                key={String(eq.id)}
                style={[
                  styles.equipmentRow,
                  { borderBottomColor: theme.border },
                  eq.selected && { backgroundColor: Colors.primary + "20" },
                ]}
                onPress={() => toggleLendedEquipment(eq.id)}
              >
                <View style={[styles.checkbox, { borderColor: eq.selected ? Colors.primary : theme.border, backgroundColor: eq.selected ? Colors.primary : "transparent" }]}>
                  {eq.selected && <Feather name="check" size={14} color="#fff" />}
                </View>
                <View style={styles.equipmentInfo}>
                  <Text style={[styles.equipmentName, { color: theme.text }]}>{eq.name}</Text>
                  {eq.serial && (
                    <Text style={[styles.equipmentSerial, { color: theme.textMuted }]}>
                      S/N: {eq.serial}
                    </Text>
                  )}
                </View>
              </Pressable>
            ))}
          </View>
        )}

        {/* Horários */}
        <View style={[styles.section, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          <View style={styles.sectionHeader}>
            <Feather name="clock" size={18} color={theme.textSecondary} />
            <Text style={[styles.sectionTitle, { color: theme.textSecondary }]}>HORÁRIOS</Text>
          </View>
          <View style={styles.row}>
            <View style={styles.halfRow}>
              <Text style={[styles.label, { color: theme.textMuted }]}>Chegada</Text>
              <TextInput
                style={[styles.input, { color: theme.text, borderColor: theme.border, backgroundColor: theme.surfaceSecondary }]}
                placeholder="HH:MM"
                placeholderTextColor={theme.textMuted}
                value={arrivalTime}
                onChangeText={setArrivalTime}
                keyboardType="numeric"
                maxLength={5}
              />
            </View>
            <View style={styles.halfRow}>
              <Text style={[styles.label, { color: theme.textMuted }]}>Saída</Text>
              <TextInput
                style={[styles.input, { color: theme.text, borderColor: theme.border, backgroundColor: theme.surfaceSecondary }]}
                placeholder="HH:MM"
                placeholderTextColor={theme.textMuted}
                value={departureTime}
                onChangeText={setDepartureTime}
                keyboardType="numeric"
                maxLength={5}
              />
            </View>
          </View>
        </View>

        {/* KM */}
        <View style={[styles.section, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          <View style={styles.sectionHeader}>
            <Feather name="navigation" size={18} color={theme.textSecondary} />
            <Text style={[styles.sectionTitle, { color: theme.textSecondary }]}>QUILOMETRAGEM</Text>
          </View>
          <View style={styles.row}>
            <View style={styles.halfRow}>
              <Text style={[styles.label, { color: theme.textMuted }]}>KM Inicial</Text>
              <TextInput
                style={[styles.input, { color: theme.text, borderColor: theme.border, backgroundColor: theme.surfaceSecondary }]}
                placeholder="0"
                placeholderTextColor={theme.textMuted}
                value={startKm}
                onChangeText={setStartKm}
                keyboardType="numeric"
              />
            </View>
            <View style={styles.halfRow}>
              <Text style={[styles.label, { color: theme.textMuted }]}>KM Final</Text>
              <TextInput
                style={[styles.input, { color: theme.text, borderColor: theme.border, backgroundColor: theme.surfaceSecondary }]}
                placeholder="0"
                placeholderTextColor={theme.textMuted}
                value={endKm}
                onChangeText={setEndKm}
                keyboardType="numeric"
              />
            </View>
          </View>
        </View>

        {/* Certificado */}
        <View style={[styles.section, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          <View style={styles.sectionHeader}>
            <Feather name="file-text" size={18} color={theme.textSecondary} />
            <Text style={[styles.sectionTitle, { color: theme.textSecondary }]}>CERTIFICADO / MEMO</Text>
          </View>
          <TextInput
            style={[styles.input, styles.textArea, { color: theme.text, borderColor: theme.border, backgroundColor: theme.surfaceSecondary }]}
            placeholder="Número do certificado ou memo"
            placeholderTextColor={theme.textMuted}
            value={certificateMemo}
            onChangeText={setCertificateMemo}
            multiline
            numberOfLines={2}
          />
        </View>

        {/* Observações */}
        <View style={[styles.section, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          <View style={styles.sectionHeader}>
            <Feather name="message-circle" size={18} color={theme.textSecondary} />
            <Text style={[styles.sectionTitle, { color: theme.textSecondary }]}>OBSERVAÇÕES DO MOTORISTA</Text>
          </View>
          <TextInput
            style={[styles.input, styles.textArea, { color: theme.text, borderColor: theme.border, backgroundColor: theme.surfaceSecondary }]}
            placeholder="Digite suas observações..."
            placeholderTextColor={theme.textMuted}
            value={driverObservations}
            onChangeText={setDriverObservations}
            multiline
            numberOfLines={4}
          />
        </View>
      </ScrollView>

      {/* Botões de Ação */}
      <View style={[styles.footer, { backgroundColor: theme.surface, borderTopColor: theme.border, paddingBottom: insets.bottom + 12 }]}>
        {/* Botão Emitir MTR */}
        {!order.mtr_id && !mtrResult ? (
          <Animated.View style={{ transform: [{ scale: mtrScale }] }}>
            <Pressable
              style={[styles.mtrBtn, isMtrLoading && styles.btnDisabled]}
              onPress={handleEmitMTR}
              onPressIn={() => animateMtrPress(true)}
              onPressOut={() => animateMtrPress(false)}
              disabled={isMtrLoading}
            >
              {isMtrLoading ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <>
                  <Feather name="file-text" size={18} color="#fff" />
                  <Text style={styles.mtrBtnText}>Emitir MTR</Text>
                </>
              )}
            </Pressable>
          </Animated.View>
        ) : (
          <View style={[styles.mtrDoneBtn]}>
            <Feather name="check-circle" size={18} color="#16A34A" />
            <Text style={styles.mtrDoneText}>MTR Emitido</Text>
          </View>
        )}

        {/* Botão Enviar para Conferência */}
        <Pressable
          style={[styles.submitBtn, isSubmitting && styles.submitBtnDisabled]}
          onPress={handleSubmit}
          disabled={isSubmitting}
        >
          {isSubmitting ? (
            <ActivityIndicator color="#fff" size="small" />
          ) : (
            <>
              <Feather name="check-circle" size={18} color="#fff" />
              <Text style={styles.submitBtnText}>Enviar para Conferência</Text>
            </>
          )}
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, flexDirection: "row", alignItems: "center" },
  backBtn: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center" },
  headerTitle: { flex: 1, fontSize: 18, fontWeight: "700", fontFamily: "Inter_700Bold", textAlign: "center" },
  headerRight: { width: 40 },
  loadingContainer: { flex: 1, alignItems: "center", justifyContent: "center", gap: 12 },
  loadingText: { fontSize: 15, fontFamily: "Inter_400Regular" },
  scrollContent: { padding: 16, gap: 16 },
  infoCard: { borderRadius: 16, padding: 16, borderWidth: 1, alignItems: "center" },
  infoCardTitle: { fontSize: 11, fontWeight: "600", fontFamily: "Inter_600SemiBold", textTransform: "uppercase", letterSpacing: 0.5 },
  infoCardClient: { fontSize: 16, fontWeight: "700", fontFamily: "Inter_700Bold", marginTop: 4 },
  addressCard: { borderRadius: 16, padding: 16, borderWidth: 1, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  addressContent: { flexDirection: "row", alignItems: "center", gap: 10, flex: 1 },
  addressTextContainer: { flex: 1 },
  addressLabel: { fontSize: 11, fontWeight: "600", fontFamily: "Inter_600SemiBold", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 4 },
  addressValue: { fontSize: 14, fontWeight: "500", fontFamily: "Inter_500Medium", lineHeight: 20 },
  mapBtn: { flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: Colors.primary + "15", paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8 },
  mapBtnText: { fontSize: 13, fontWeight: "600", fontFamily: "Inter_600SemiBold" },
  section: { borderRadius: 16, overflow: "hidden", borderWidth: 1 },
  sectionHeader: { flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 16, paddingTop: 14, paddingBottom: 8 },
  sectionTitle: { fontSize: 11, fontWeight: "600", fontFamily: "Inter_600SemiBold", letterSpacing: 0.5, textTransform: "uppercase" },
  serviceRow: { flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, gap: 12 },
  serviceInfo: { flex: 1 },
  serviceName: { fontSize: 14, fontWeight: "500", fontFamily: "Inter_500Medium", lineHeight: 20 },
  serviceUnit: { fontSize: 12, fontFamily: "Inter_400Regular", marginTop: 2 },
  weightInput: { width: 100 },
  input: { fontSize: 14, fontFamily: "Inter_400Regular", borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, minHeight: 44 },
  textArea: { minHeight: 80, textAlignVertical: "top", paddingTop: 10 },
  row: { flexDirection: "row", gap: 12, paddingHorizontal: 16, paddingVertical: 12 },
  halfRow: { flex: 1 },
  label: { fontSize: 12, fontFamily: "Inter_400Regular", marginBottom: 6 },
  equipmentRow: { flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, gap: 12 },
  checkbox: { width: 22, height: 22, borderRadius: 6, borderWidth: 2, alignItems: "center", justifyContent: "center" },
  equipmentInfo: { flex: 1 },
  equipmentName: { fontSize: 14, fontWeight: "500", fontFamily: "Inter_500Medium" },
  equipmentSerial: { fontSize: 12, fontFamily: "Inter_400Regular", marginTop: 2 },
  footer: { position: "absolute", bottom: 0, left: 0, right: 0, paddingHorizontal: 16, paddingTop: 12, borderTopWidth: 1, gap: 10 },
  mtrBtn: { backgroundColor: "#059669", flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, paddingVertical: 14, borderRadius: 14, shadowColor: "#059669", shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.3, shadowRadius: 6, elevation: 4 },
  mtrBtnText: { color: "#fff", fontSize: 15, fontWeight: "700", fontFamily: "Inter_700Bold" },
  mtrDoneBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, paddingVertical: 14, borderRadius: 14, backgroundColor: "#DCFCE7", borderWidth: 1, borderColor: "#86EFAC" },
  mtrDoneText: { color: "#16A34A", fontSize: 15, fontWeight: "700", fontFamily: "Inter_700Bold" },
  submitBtn: { backgroundColor: Colors.primary, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10, paddingVertical: 16, borderRadius: 16, shadowColor: Colors.primary, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 5 },
  submitBtnDisabled: { opacity: 0.6 },
  submitBtnText: { color: "#fff", fontSize: 16, fontWeight: "700", fontFamily: "Inter_700Bold" },
  btnDisabled: { opacity: 0.6 },
});
