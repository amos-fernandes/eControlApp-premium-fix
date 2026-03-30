import { Feather, MaterialCommunityIcons, Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import * as ImagePicker from "expo-image-picker";
import { Linking, Image, Platform } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import React, { useState, useRef, useEffect } from "react";
import {
  ActivityIndicator,
  Alert,
  Animated,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import DateTimePicker from "@react-native-community/datetimepicker";
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
  const [arrivalDate, setArrivalDate] = useState<Date | null>(null);
  const [departureDate, setDepartureDate] = useState<Date | null>(null);
  const [showArrivalPicker, setShowArrivalPicker] = useState(false);
  const [showDeparturePicker, setShowDeparturePicker] = useState(false);
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

        // Carrega horários do rascunho ou da OS
        if (draft?.arrival_date) {
          const arrival = new Date(draft.arrival_date);
          const timeStr = arrival.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
          console.log("[UpdateOrder] ✅ Horário de chegada do RASCUNHO:", {
            original: draft.arrival_date,
            parsed: arrival.toISOString(),
            timeStr: timeStr
          });
          setArrivalDate(arrival);
          setArrivalTime(timeStr);
        } else if (order.arrival_date) {
          const arrival = new Date(order.arrival_date);
          const timeStr = arrival.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
          console.log("[UpdateOrder] ✅ Horário de chegada da OS:", {
            original: order.arrival_date,
            parsed: arrival.toISOString(),
            timeStr: timeStr
          });
          setArrivalDate(arrival);
          setArrivalTime(timeStr);
        }

        if (draft?.departure_date) {
          const departure = new Date(draft.departure_date);
          const timeStr = departure.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
          console.log("[UpdateOrder] ✅ Horário de saída do RASCUNHO:", {
            original: draft.departure_date,
            parsed: departure.toISOString(),
            timeStr: timeStr
          });
          setDepartureDate(departure);
          setDepartureTime(timeStr);
        } else if (order.departure_date) {
          const departure = new Date(order.departure_date);
          const timeStr = departure.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
          console.log("[UpdateOrder] ✅ Horário de saída da OS:", {
            original: order.departure_date,
            parsed: departure.toISOString(),
            timeStr: timeStr
          });
          setDepartureDate(departure);
          setDepartureTime(timeStr);
        }

        if (!draft) {
          // Inicializa outros dados apenas se não houver rascunho
          console.log("\n========== [UpdateOrder] INICIALIZANDO DADOS DA OS ==========");
          console.log("[UpdateOrder] OS data:", {
            id: order.id,
            has_arrival_date: !!order.arrival_date,
            has_departure_date: !!order.departure_date,
            has_start_km: !!order.start_km,
            has_end_km: !!order.end_km,
            arrival_date: order.arrival_date,
            departure_date: order.departure_date,
            start_km: order.start_km,
            end_km: order.end_km
          });

          setStartKm(order.start_km || "");
          setEndKm(order.end_km || "");
          setCertificateMemo(order.certificate_memo || "");
          setDriverObservations(order.driver_observations || "");

          console.log("[UpdateOrder] Dados inicializados:", {
            arrivalTime,
            departureTime,
            startKm: order.start_km,
            endKm: order.end_km
          });
          console.log("===============================================================\n");
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

  const handleArrivalTimePress = () => {
    console.log("[UpdateOrder] handleArrivalTimePress: Abrindo DateTimePicker");
    setShowArrivalPicker(true);
  };

  const handleDepartureTimePress = () => {
    console.log("[UpdateOrder] handleDepartureTimePress: Abrindo DateTimePicker");
    setShowDeparturePicker(true);
  };

  const onArrivalTimeChange = (event: any, selectedDate?: Date) => {
    console.log("[UpdateOrder] onArrivalTimeChange:", {
      event_type: event.type,
      has_selectedDate: !!selectedDate,
      selectedDate: selectedDate?.toISOString()
    });
    
    if (Platform.OS === "android") {
      setShowArrivalPicker(false);
    }
    
    if (selectedDate) {
      const timeStr = selectedDate.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
      console.log("[UpdateOrder] Horário de chegada selecionado:", timeStr);
      setArrivalDate(selectedDate);
      setArrivalTime(timeStr);
    }
  };

  const onDepartureTimeChange = (event: any, selectedDate?: Date) => {
    console.log("[UpdateOrder] onDepartureTimeChange:", {
      event_type: event.type,
      has_selectedDate: !!selectedDate,
      selectedDate: selectedDate?.toISOString()
    });
    
    if (Platform.OS === "android") {
      setShowDeparturePicker(false);
    }
    
    if (selectedDate) {
      const timeStr = selectedDate.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
      console.log("[UpdateOrder] Horário de saída selecionado:", timeStr);
      setDepartureDate(selectedDate);
      setDepartureTime(timeStr);
    }
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

    // LOG COMPLETO DO ESTADO ATUAL
    console.log("\n========== [UpdateOrder] handleSubmit INICIADO ==========");
    console.log("[UpdateOrder] Estado atual dos campos:");
    console.log(`  - arrivalTime: "${arrivalTime}"`);
    console.log(`  - departureTime: "${departureTime}"`);
    console.log(`  - arrivalDate: ${arrivalDate?.toISOString() || "null"}`);
    console.log(`  - departureDate: ${departureDate?.toISOString() || "null"}`);
    console.log(`  - startKm: "${startKm}"`);
    console.log(`  - endKm: "${endKm}"`);
    console.log("===============================================================\n");

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

      // Prepara os service_executions
      // O endpoint /finish é responsável por mudar o status da OS para "Em Conferência"
      console.log("\n========== [UpdateOrder] PREPARANDO SERVICE EXECUTIONS ==========");
      console.log("[UpdateOrder] serviceWeights (estado):", JSON.stringify(serviceWeights, null, 2));
      
      const serviceExecutions = serviceWeights.map(sw => {
        const exec = order.service_executions?.find((e: ServiceExecution) => String(e.service?.id) === String(sw.serviceId));
        
        // Parse do peso com tratamento de erro
        const weightStr = sw.weight.replace(",", ".");
        const parsedAmount = parseFloat(weightStr);
        const finalAmount = parsedAmount || 0;
        
        console.log(`[UpdateOrder] Service: ${sw.serviceName}`);
        console.log(`  - serviceId: ${sw.serviceId}`);
        console.log(`  - weight (original): "${sw.weight}"`);
        console.log(`  - weight (formatado): "${weightStr}"`);
        console.log(`  - parsedAmount: ${parsedAmount}`);
        console.log(`  - finalAmount: ${finalAmount}`);
        console.log(`  - exec.id: ${exec?.id}`);
        console.log(`  - exec.service.id: ${exec?.service?.id}`);
        
        return {
          id: exec?.id || 0,
          service_id: sw.serviceId,
          amount: finalAmount
        };
      });
      
      console.log("[UpdateOrder] serviceExecutions (pronto para envio):", JSON.stringify(serviceExecutions, null, 2));
      console.log("===============================================================\n");

      // Prepara dados completos para envio
      const updates = {
        // Usa arrivalDate/departureDate se existirem, senão cria data com a hora selecionada
        arrival_date: arrivalDate ? arrivalDate.toISOString() : (arrivalTime ? new Date().toISOString() : undefined),
        departure_date: departureDate ? departureDate.toISOString() : (departureTime ? new Date().toISOString() : undefined),
        start_km: startKm,
        end_km: endKm,
        certificate_memo: certificateMemo || undefined,
        driver_observations: driverObservations || undefined,
        collected_equipment: collectedEquipment.filter(eq => eq.selected),
        lended_equipment: lendedEquipment.filter(eq => eq.selected),
        // ✅ CORREÇÃO: Backend Rails espera "service_executions" (não "service_executions_attributes")
        service_executions: serviceExecutions,
      };

      // LOG EXTREMAMENTE DETALHADO DO PAYLOAD
      console.log("\n💰💰💰 [UPDATEORDER] PAYLOAD COMPLETO SENDO ENVIADO 💰💰💰");
      console.log("===============================================================");
      console.log(`OS ID: ${order.id}`);
      console.log(`Status: checking`);
      console.log(`Checking: true`);
      console.log("\n--- service_executions ---");
      updates.service_executions?.forEach((exec: any, i: number) => {
        console.log(`\n[Item ${i + 1}]:`);
        console.log(`  id: ${exec.id}`);
        console.log(`  service_id: ${exec.service_id}`);
        console.log(`  amount: ${exec.amount} ← ESTE É O VALOR QUE ESTÁ SENDO ENVIADO!`);
        console.log(`  amount type: ${typeof exec.amount}`);
        console.log(`  amount isNaN: ${isNaN(exec.amount)}`);
      });
      console.log("\n--- Outros dados ---");
      console.log(`arrival_date: ${updates.arrival_date}`);
      console.log(`departure_date: ${updates.departure_date}`);
      console.log(`start_km: ${updates.start_km}`);
      console.log(`end_km: ${updates.end_km}`);
      console.log(`driver_observations: ${updates.driver_observations}`);
      console.log("===============================================================\n");
      console.log("💰💰💰 FIM DO PAYLOAD 💰💰💰\n");

      console.log("\n========== [UpdateOrder] ENVIANDO OS PARA CONFERÊNCIA ==========");
      console.log(`[UpdateOrder] OS ID: ${order.id}`);
      console.log(`[UpdateOrder] Dados sendo enviados:`);
      console.log(`  - arrival_date: ${updates.arrival_date || "NÃO ENVIADO"}`);
      console.log(`    → arrivalDate: ${arrivalDate?.toISOString() || "null"}`);
      console.log(`    → arrivalTime: "${arrivalTime || "vazio"}"`);
      console.log(`  - departure_date: ${updates.departure_date || "NÃO ENVIADO"}`);
      console.log(`    → departureDate: ${departureDate?.toISOString() || "null"}`);
      console.log(`    → departureTime: "${departureTime || "vazio"}"`);
      console.log(`  - start_km: ${updates.start_km || "NÃO ENVIADO"}`);
      console.log(`  - end_km: ${updates.end_km || "NÃO ENVIADO"}`);
      console.log(`  - certificate_memo: ${updates.certificate_memo || "NÃO ENVIADO"}`);
      console.log(`  - driver_observations: ${updates.driver_observations || "NÃO ENVIADO"}`);
      console.log(`  - collected_equipment: ${JSON.stringify(updates.collected_equipment)}`);
      console.log(`  - lended_equipment: ${JSON.stringify(updates.lended_equipment)}`);
      console.log(`  - service_executions: ${JSON.stringify(updates.service_executions, null, 2)}`);
      console.log(`[UpdateOrder] Payload completo:`, JSON.stringify(updates, null, 2));
      console.log("===============================================================\n");

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
          <View style={styles.sectionHeader}>
            <Feather name="clock" size={18} color={theme.textSecondary} />
            <Text style={[styles.sectionTitle, { color: theme.textSecondary }]}>Horários e KM</Text>
          </View>
          
          <View style={styles.timeRow}>
            <View style={styles.timeLabel}><Text style={[styles.timeLabelText, { color: theme.textSecondary }]}>Chegada</Text></View>
            <View style={styles.timeLabel}><Text style={[styles.timeLabelText, { color: theme.textSecondary }]}>Saída</Text></View>
          </View>
          
          <View style={styles.row}>
            <Pressable 
              onPress={handleArrivalTimePress} 
              style={({ pressed }) => [
                styles.timeInput, 
                { 
                  flex: 1, 
                  backgroundColor: theme.surfaceSecondary, 
                  borderColor: theme.border, 
                  borderRadius: 10, 
                  padding: 12,
                  flexDirection: "row",
                  alignItems: "center",
                  justifyContent: "space-between",
                  opacity: pressed ? 0.7 : 1
                }
              ]}
            >
              <Text style={{ fontSize: 16, color: arrivalTime ? theme.text : theme.textMuted, fontWeight: "500" }}>
                {arrivalTime || "Selecionar"}
              </Text>
              <Feather name="clock" size={18} color={theme.textMuted} />
            </Pressable>
            
            <Pressable 
              onPress={handleDepartureTimePress} 
              style={({ pressed }) => [
                styles.timeInput, 
                { 
                  flex: 1, 
                  backgroundColor: theme.surfaceSecondary, 
                  borderColor: theme.border, 
                  borderRadius: 10, 
                  padding: 12,
                  flexDirection: "row",
                  alignItems: "center",
                  justifyContent: "space-between",
                  opacity: pressed ? 0.7 : 1
                }
              ]}
            >
              <Text style={{ fontSize: 16, color: departureTime ? theme.text : theme.textMuted, fontWeight: "500" }}>
                {departureTime || "Selecionar"}
              </Text>
              <Feather name="clock" size={18} color={theme.textMuted} />
            </Pressable>
          </View>
          
          <View style={styles.row}>
            <TextInput style={[styles.input, { flex: 1 }]} placeholder="KM Inicial" value={startKm} onChangeText={setStartKm} keyboardType="numeric" />
            <TextInput style={[styles.input, { flex: 1 }]} placeholder="KM Final" value={endKm} onChangeText={setEndKm} keyboardType="numeric" />
          </View>
        </View>

        {showArrivalPicker && (
          <DateTimePicker
            value={arrivalDate || new Date()}
            mode="time"
            display="default"
            onChange={onArrivalTimeChange}
          />
        )}

        {showDeparturePicker && (
          <DateTimePicker
            value={departureDate || new Date()}
            mode="time"
            display="default"
            onChange={onDepartureTimeChange}
          />
        )}

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
  row: { flexDirection: "row", gap: 10 },
  timeRow: { flexDirection: "row", justifyContent: "space-between", paddingHorizontal: 12, marginBottom: 6 },
  timeLabel: { flex: 1 },
  timeLabelText: { fontSize: 12, fontWeight: "600", textTransform: "uppercase" },
  timeInput: { justifyContent: "center" },
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
