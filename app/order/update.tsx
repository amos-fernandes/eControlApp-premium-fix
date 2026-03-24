import { Feather, MaterialCommunityIcons, Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import * as ImagePicker from "expo-image-picker";
import { Linking, Image } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import React, { useState, useRef, useEffect } from "react";
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
import * as CollectionService from "@/services/collectionService";
import type { ServiceOrder, ServiceExecution } from "@/services/api";
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
  const { credentials, logout, refreshCredentials } = useAuth();
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
  const [photos, setPhotos] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // Estados para MTR
  const [isMtrLoading, setIsMtrLoading] = useState(false);
  const [mtrResult, setMtrResult] = useState<any | null>(null);

  // Busca dados da OS do cache
  const queryCache = queryClient.getQueryCache();
  const allQueries = queryCache.findAll() as any[];

  let cachedOrder: ServiceOrder | undefined;
  for (const query of allQueries) {
    const orders = query.state.data as ServiceOrder[] | undefined;
    if (orders && Array.isArray(orders)) {
      cachedOrder = orders.find(o => String(o.id) === id || String(o.identifier) === id);
      if (cachedOrder) break;
    }
  }

  const order = cachedOrder;
  
  // Carrega rascunho ao iniciar
  useEffect(() => {
    if (id) {
      CollectionService.getDraft(id).then(draft => {
        if (draft) {
          console.log("[UpdateOrder] Rascunho carregado:", draft);
          if (draft.arrival_date) setArrivalTime(new Date(draft.arrival_date).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }));
          if (draft.departure_date) setDepartureTime(new Date(draft.departure_date).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }));
          if (draft.start_km) setStartKm(String(draft.start_km));
          if (draft.end_km) setEndKm(String(draft.end_km));
          if (draft.certificate_memo) setCertificateMemo(draft.certificate_memo);
          if (draft.driver_observations) setDriverObservations(draft.driver_observations);
          if (draft.photos) setPhotos(draft.photos);
        }
      });
    }
  }, [id]);

  // Salva rascunho automaticamente
  useEffect(() => {
    if (id && order) {
      const dataToSave = {
        arrival_date: arrivalTime ? new Date().toISOString() : undefined,
        departure_date: departureTime ? new Date().toISOString() : undefined,
        start_km: startKm,
        end_km: endKm,
        certificate_memo: certificateMemo,
        driver_observations: driverObservations,
        service_executions: serviceWeights.map(sw => ({
          service_id: sw.serviceId,
          amount: parseFloat(sw.weight.replace(",", ".")) || 0,
        })),
        collected_equipment: collectedEquipment.filter(eq => eq.selected),
        lended_equipment: lendedEquipment.filter(eq => eq.selected),
        photos: photos
      };
      CollectionService.saveDraft(id, dataToSave as any);
    }
  }, [id, order, arrivalTime, departureTime, startKm, endKm, certificateMemo, driverObservations, serviceWeights, collectedEquipment, lendedEquipment, photos]);

  // Inicializa dados da OS
  useEffect(() => {
    if (order) {
      CollectionService.getDraft(id as string).then(draft => {
        if (order.service_executions) {
          const weights = order.service_executions.map((exec: ServiceExecution) => {
            // Busca peso no rascunho ou na OS
            const draftWeight = draft?.service_executions?.find((sw: any) => String(sw.service_id) === String(exec.service?.id));
            return {
              serviceId: exec.service?.id || "",
              serviceName: exec.service?.name || "Serviço sem nome",
              weight: draftWeight ? String(draftWeight.amount) : (exec.amount ? String(exec.amount) : ""),
              unit: exec.unit?.abbreviation || exec.unit?.name || "kg",
            };
          });
          setServiceWeights(weights);
        }

        if (order.collected_equipment) {
          setCollectedEquipment(
            order.collected_equipment.map((eq: any) => {
              const draftEq = draft?.collected_equipment?.find((deq: any) => String(deq.id) === String(eq.id));
              return { ...eq, selected: draftEq ? true : false };
            })
          );
        }

        if (order.lended_equipment) {
          setLendedEquipment(
            order.lended_equipment.map((eq: any) => {
              const draftEq = draft?.lended_equipment?.find((deq: any) => String(deq.id) === String(eq.id));
              return { ...eq, selected: draftEq ? true : false };
            })
          );
        }

        if (!draft) {
          if (order.arrival_date) setArrivalTime(new Date(order.arrival_date).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }));
          if (order.departure_date) setDepartureTime(new Date(order.departure_date).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }));
          setStartKm(order.start_km || "");
          setEndKm(order.end_km || "");
          setCertificateMemo(order.certificate_memo || "");
          setDriverObservations(order.driver_observations || "");
        }
      });
    }
  }, [order, id]);

  const handleTakePhoto = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== "granted") {
      Alert.alert("Permissão negada", "Precisamos de acesso à câmera.");
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ['images'],
      allowsEditing: false,
      quality: 0.7,
    });

    if (!result.canceled) {
      setPhotos(prev => [...prev, result.assets[0].uri]);
    }
  };

  const handlePickImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsMultipleSelection: true,
      quality: 0.7,
    });

    if (!result.canceled) {
      const uris = result.assets.map(a => a.uri);
      setPhotos(prev => [...prev, ...uris]);
    }
  };

  const removePhoto = (index: number) => {
    setPhotos(prev => prev.filter((_, i) => i !== index));
  };

  const handleOpenMap = () => {
    if (!order?.address) return;
    const address = order.address;
    const lat = typeof address !== "string" ? address.latitude : null;
    const lng = typeof address !== "string" ? address.longitude : null;
    let url = (lat && lng) 
      ? `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`
      : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(typeof address === "string" ? address : address.to_s || "")}`;
    Linking.openURL(url).catch(() => Alert.alert("Erro", "Não foi possível abrir o mapa."));
  };

  const handleEmitMTR = async () => {
    if (!order) return;
    Alert.alert("Emitir MTR", "Deseja emitir o MTR para esta OS?", [
      { text: "Cancelar", style: "cancel" },
      {
        text: "Emitir",
        onPress: async () => {
          setIsMtrLoading(true);
          try {
            const result = await CollectionService.emitMTR(order.id, `OS-${order.id}`);
            setMtrResult(result);
            await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            Alert.alert("MTR Emitido", result.numero_mtr ? `Número: ${result.numero_mtr}` : "Sucesso!");
          } catch (err: any) {
            Alert.alert("Erro", err.message || "Erro ao emitir MTR");
          } finally { setIsMtrLoading(false); }
        },
      },
    ]);
  };

  const handleSubmit = async () => {
    if (!order) return;

    // VALIDAÇÕES OBRIGATÓRIAS
    const filledWeights = serviceWeights.filter(sw => sw.weight && sw.weight.trim() !== "");
    if (filledWeights.length === 0) {
      Alert.alert("Atenção", "Informe o peso de ao menos um serviço.");
      return;
    }

    if (!startKm || !endKm) {
      Alert.alert("Atenção", "Informe o KM Inicial e Final.");
      return;
    }

    // Validação de fotos é opcional se endpoint não existir
    // if (photos.length === 0) {
    //   Alert.alert("Atenção", "É obrigatório anexar ao menos uma foto da coleta.");
    //   return;
    // }

    setIsSubmitting(true);
    
    // Tenta fazer upload das fotos, mas continua se falhar
    let uploadSuccess = true;
    if (photos.length > 0) {
      console.log(`[UpdateOrder] Iniciando upload de ${photos.length} fotos...`);
      for (const uri of photos) {
        try {
          await CollectionService.uploadImageToS3(uri, order.id);
        } catch (uploadError: any) {
          console.warn("[UpdateOrder] Upload falhou, mas continuando...", uploadError.message);
          uploadSuccess = false;
          break; // Para de tentar as outras fotos
        }
      }
    }

    // Se upload falhou, pergunta se quer continuar sem fotos
    if (!uploadSuccess) {
      Alert.alert(
        "Upload de fotos falhou",
        "O endpoint de upload não está disponível neste servidor. Deseja continuar e enviar para conferência sem as fotos?",
        [
          { text: "Cancelar", style: "cancel", onPress: () => { setIsSubmitting(false); } },
          { 
            text: "Continuar", 
            onPress: async () => {
              await submitOrderData();
            }
          }
        ]
      );
    } else {
      await submitOrderData();
    }
  };

  const submitOrderData = async () => {
    if (!order) return;

    try {
      // Verifica credenciais antes de enviar
      if (!credentials || !credentials.accessToken) {
        console.warn("[UpdateOrder] ⚠️  Credenciais ausentes, tentando refresh...");
        const refreshed = await refreshCredentials();
        if (!refreshed) {
          throw new Error("SESSION_EXPIRED");
        }
        console.log("[UpdateOrder] ✅ Credenciais renovadas com sucesso");
      }

      // Prepara os service_executions com status 'checking'
      // O endpoint /finish é responsável por mudar o status da OS para "Em Conferência"
      const serviceExecutions = serviceWeights.map(sw => {
        const exec = order.service_executions?.find((e: ServiceExecution) => String(e.service?.id) === String(sw.serviceId));
        return {
          id: exec?.id || 0,
          service_id: sw.serviceId,
          amount: parseFloat(sw.weight.replace(",", ".")) || 0,
          status: "checking" // CRUCIAL para mudar status dos itens para "Em Conferência"
        };
      });

      console.log(`[UpdateOrder] Preparando envio para OS ${order.id}:`);
      console.log(`[UpdateOrder] Service Executions:`, JSON.stringify(serviceExecutions, null, 2));

      // Payload para endpoint /finish (não precisa envelopar em 'service_order')
      const updates = {
        arrival_date: arrivalTime ? new Date().toISOString() : undefined,
        departure_date: departureTime ? new Date().toISOString() : undefined,
        start_km: startKm,
        end_km: endKm,
        certificate_memo: certificateMemo || undefined,
        driver_observations: driverObservations || undefined,
        collected_equipment: collectedEquipment.filter(eq => eq.selected),
        lended_equipment: lendedEquipment.filter(eq => eq.selected),
        // service_executions_attributes é o nome correto para Rails nested attributes
        service_executions_attributes: serviceExecutions,
      };

      console.log(`[UpdateOrder] Updates completos:`, JSON.stringify(updates, null, 2));

      await CollectionService.finishOrder(order.id, updates as any);
      await CollectionService.clearDraft(order.id); // Limpa rascunho após envio
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert("Sucesso!", "OS enviada para conferência.", [
        { text: "OK", onPress: () => {
          queryClient.invalidateQueries({ queryKey: ["service_orders"] });
          router.back();
        }}
      ]);
    } catch (err: any) {
      console.error("[UpdateOrder] Erro ao enviar:", err);
      
      if (err.message === "SESSION_EXPIRED") {
        // Tenta refresh uma vez
        const refreshed = await refreshCredentials();
        
        if (refreshed) {
          Alert.alert(
            "Sessão Renovada", 
            "Sua sessão expirou mas foi renovada. Tente enviar novamente.",
            [{ text: "OK" }]
          );
        } else {
          // Refresh falhou - servidor rejeitou as credenciais
          Alert.alert(
            "Sessão Expirada",
            "Suas credenciais expiraram ou foram rejeitadas pelo servidor.\n\n" +
            "Isso pode acontecer se:\n" +
            "• O servidor reiniciou\n" +
            "• A sessão expirou\n" +
            "• O servidor de teste está instável\n\n" +
            "Você será redirecionado para o login.",
            [
              { 
                text: "OK", 
                onPress: () => {
                  logout(); 
                  router.replace("/(auth)/login");
                }
              }
            ]
          );
        }
      } else {
        // Erro dinâmico para facilitar diagnóstico (Ed PhD refactor)
        Alert.alert("Erro ao enviar", err.message || "Não foi possível enviar os dados. O rascunho continua salvo.");
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const topPadding = Platform.OS === "web" ? 67 : insets.top;

  if (!order) {
 
    return (
      <View style={[styles.container, { backgroundColor: theme.background }]}>
 
        <View style={[styles.header, { paddingTop: topPadding, backgroundColor: theme.surface }]}>
          <Pressable style={styles.backBtn} onPress={() => router.back()}><Feather name="arrow-left" size={22} color={theme.text} /></Pressable>
          <Text style={[styles.headerTitle, { color: theme.text }]}>Coleta de Dados</Text>
 
        </View>
        <View style={styles.loadingContainer}><ActivityIndicator size="large" color={Colors.primary} /></View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <View style={[styles.header, { paddingTop: topPadding, backgroundColor: theme.surface, borderBottomColor: theme.border }]}>
        <Pressable style={styles.backBtn} onPress={() => router.back()}><Feather name="arrow-left" size={22} color={theme.text} /></Pressable>
        <Text style={[styles.headerTitle, { color: theme.text }]}>Coleta de Dados</Text>
        <View style={styles.headerRight} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={[styles.scrollContent, { paddingBottom: 120 }]}>
        <View style={[styles.infoCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          <Text style={[styles.infoCardTitle, { color: theme.textSecondary }]}>OS #{String(order.id).padStart(4, "0")}</Text>
          <Text style={[styles.infoCardClient, { color: theme.text }]}>{order.customer?.name || "Cliente"}</Text>
        </View>

        <Pressable onPress={handleOpenMap} style={[styles.addressCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          <View style={styles.addressContent}>
            <Feather name="map-pin" size={18} color={Colors.primary} />
            <View style={styles.addressTextContainer}>
              <Text style={[styles.addressLabel, { color: theme.textSecondary }]}>Endereço</Text>
              <Text style={[styles.addressValue, { color: theme.text }]}>{typeof order.address === "string" ? order.address : order.address?.to_s || "Não informado"}</Text>
            </View>
          </View>
          <View style={styles.mapBtn}><Text style={[styles.mapBtnText, { color: Colors.primary }]}>Mapa</Text></View>
        </Pressable>

        {serviceWeights.length > 0 && (
          <View style={[styles.section, { backgroundColor: theme.surface, borderColor: theme.border }]}>
            <View style={styles.sectionHeader}><MaterialCommunityIcons name="scale-balance" size={18} color={theme.textSecondary} /><Text style={[styles.sectionTitle, { color: theme.textSecondary }]}>Pesagem</Text></View>
            {serviceWeights.map((sw, index) => (
              <View key={String(sw.serviceId) + index} style={[styles.serviceRow, { borderBottomColor: theme.border }]}>
                <Text style={[styles.serviceName, { color: theme.text, flex: 1 }]}>{sw.serviceName}</Text>
                <TextInput
                  style={[styles.input, { width: 80, color: theme.text, borderColor: theme.border, backgroundColor: theme.surfaceSecondary }]}
                  value={sw.weight}
                  onChangeText={(text) => setServiceWeights(prev => prev.map(s => s.serviceId === sw.serviceId ? { ...s, weight: text } : s))}
                  keyboardType="decimal-pad"
                />
              </View>
            ))}
          </View>
        )}

        <View style={[styles.section, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          <View style={styles.sectionHeader}><Feather name="clock" size={18} color={theme.textSecondary} /><Text style={[styles.sectionTitle, { color: theme.textSecondary }]}>Horários e KM</Text></View>
          <View style={styles.row}>
            <TextInput style={[styles.input, { flex: 1 }]} placeholder="Chegada" value={arrivalTime} onChangeText={setArrivalTime} />
            <TextInput style={[styles.input, { flex: 1 }]} placeholder="Saída" value={departureTime} onChangeText={setDepartureTime} />
          </View>
          <View style={styles.row}>
            <TextInput style={[styles.input, { flex: 1 }]} placeholder="KM Inicial" value={startKm} onChangeText={setStartKm} keyboardType="numeric" />
            <TextInput style={[styles.input, { flex: 1 }]} placeholder="KM Final" value={endKm} onChangeText={setEndKm} keyboardType="numeric" />
          </View>
        </View>

        <View style={[styles.section, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          <View style={styles.sectionHeader}>
            <Feather name="camera" size={18} color={theme.textSecondary} />
            <Text style={[styles.sectionTitle, { color: theme.textSecondary }]}>Fotos da Coleta (Obrigatório)</Text>
          </View>
          
          <View style={styles.photoActions}>
            <Pressable style={[styles.photoActionBtn, { backgroundColor: Colors.primary + "15" }]} onPress={handleTakePhoto}>
              <Feather name="camera" size={20} color={Colors.primary} />
              <Text style={[styles.photoActionText, { color: Colors.primary }]}>Tirar Foto</Text>
            </Pressable>
            <Pressable style={[styles.photoActionBtn, { backgroundColor: theme.surfaceSecondary }]} onPress={handlePickImage}>
              <Feather name="image" size={20} color={theme.textSecondary} />
              <Text style={[styles.photoActionText, { color: theme.textSecondary }]}>Galeria</Text>
            </Pressable>
          </View>

          {photos.length > 0 && (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.photoList}>
              {photos.map((uri, index) => (
                <View key={index} style={styles.photoContainer}>
                  <Image source={{ uri }} style={styles.photoThumb} />
                  <Pressable style={styles.removePhotoBtn} onPress={() => removePhoto(index)}>
                    <Ionicons name="close-circle" size={20} color="#EF4444" />
                  </Pressable>
                </View>
              ))}
            </ScrollView>
          )}
        </View>

        <View style={[styles.section, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          <View style={styles.sectionHeader}><Feather name="message-circle" size={18} color={theme.textSecondary} /><Text style={[styles.sectionTitle, { color: theme.textSecondary }]}>Observações</Text></View>
          <TextInput
            style={[styles.input, { height: 80 }]}
            placeholder="Observações..."
            value={driverObservations}
            onChangeText={setDriverObservations}
            multiline
          />
        </View>
      </ScrollView>

      <View style={[styles.footer, { backgroundColor: theme.surface, borderTopColor: theme.border, paddingBottom: insets.bottom + 12 }]}>
        {!order.mtr_id && !mtrResult ? (
          <Pressable style={styles.mtrBtn} onPress={handleEmitMTR} disabled={isMtrLoading}>
            {isMtrLoading ? <ActivityIndicator color="#fff" /> : <Text style={styles.mtrBtnText}>Emitir MTR</Text>}
          </Pressable>
        ) : (
          <View style={styles.mtrDoneBtn}><Text style={styles.mtrDoneText}>MTR Emitido</Text></View>
        )}

        <Pressable style={[styles.submitBtn, isSubmitting && styles.submitBtnDisabled]} onPress={handleSubmit} disabled={isSubmitting}>
          {isSubmitting ? <ActivityIndicator color="#fff" /> : <Text style={styles.submitBtnText}>Enviar Conferência</Text>}
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, flexDirection: "row", alignItems: "center" },
  backBtn: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center" },
  headerTitle: { flex: 1, fontSize: 18, fontWeight: "700", textAlign: "center" },
  headerRight: { width: 40 },
  loadingContainer: { flex: 1, alignItems: "center", justifyContent: "center" },
  scrollContent: { padding: 16, gap: 16 },
  infoCard: { borderRadius: 16, padding: 16, borderWidth: 1, alignItems: "center" },
  infoCardTitle: { fontSize: 11, fontWeight: "600", textTransform: "uppercase" },
  infoCardClient: { fontSize: 16, fontWeight: "700", marginTop: 4 },
  addressCard: { borderRadius: 16, padding: 16, borderWidth: 1, flexDirection: "row", alignItems: "center" },
  addressContent: { flexDirection: "row", alignItems: "center", gap: 10, flex: 1 },
  addressTextContainer: { flex: 1 },
  addressLabel: { fontSize: 11, fontWeight: "600", textTransform: "uppercase" },
  addressValue: { fontSize: 14 },
  mapBtn: { padding: 8, backgroundColor: Colors.primary + "15", borderRadius: 8 },
  mapBtnText: { fontSize: 13, fontWeight: "600" },
  section: { borderRadius: 16, overflow: "hidden", borderWidth: 1 },
  sectionHeader: { flexDirection: "row", alignItems: "center", gap: 8, padding: 12 },
  sectionTitle: { fontSize: 11, fontWeight: "600", textTransform: "uppercase" },
  serviceRow: { flexDirection: "row", alignItems: "center", padding: 12, borderBottomWidth: 1 },
  serviceName: { fontSize: 14 },
  input: { fontSize: 14, borderWidth: 1, borderRadius: 10, padding: 10, marginHorizontal: 12, marginBottom: 12 },
  row: { flexDirection: "row", gap: 0 },
  photoActions: { flexDirection: "row", gap: 12, padding: 12 },
  photoActionBtn: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, padding: 12, borderRadius: 12 },
  photoActionText: { fontSize: 13, fontWeight: "600" },
  photoList: { paddingHorizontal: 12, paddingBottom: 16, gap: 12 },
  photoContainer: { width: 80, height: 80, borderRadius: 12, overflow: "hidden", position: "relative" },
  photoThumb: { width: "100%", height: "100%" },
  removePhotoBtn: { position: "absolute", top: 2, right: 2, backgroundColor: "#fff", borderRadius: 10 },
  footer: { position: "absolute", bottom: 0, left: 0, right: 0, padding: 16, borderTopWidth: 1, gap: 10 },
  mtrBtn: { backgroundColor: "#059669", padding: 14, borderRadius: 14, alignItems: "center" },
  mtrBtnText: { color: "#fff", fontWeight: "700" },
  mtrDoneBtn: { padding: 14, borderRadius: 14, backgroundColor: "#DCFCE7", alignItems: "center" },
  mtrDoneText: { color: "#16A34A", fontWeight: "700" },
  submitBtn: { backgroundColor: Colors.primary, padding: 16, borderRadius: 16, alignItems: "center" },
  submitBtnDisabled: { opacity: 0.6 },
  submitBtnText: { color: "#fff", fontWeight: "700" },
});
