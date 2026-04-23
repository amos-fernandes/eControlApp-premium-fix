import React, { useEffect, useState } from 'react';
import { View, StyleSheet, ActivityIndicator, Text, useColorScheme } from 'react-native';
import MapViewComponent from '@/components/MapViewComponent';
import { getServiceOrders } from '@/databases/database';
import { Colors } from '@/constants/colors';
import { useIsFocused } from '@react-navigation/native';
import { getCurrentPosition } from '@/utils/locationManager';

export default function LogisticsScreen() {
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [userLocation, setUserLocation] = useState<{ latitude: number; longitude: number } | undefined>();
  const isFocused = useIsFocused();
  const colorScheme = useColorScheme();
  const theme = colorScheme === 'dark' ? Colors.dark : Colors.light;

  const loadData = async () => {
    try {
      setLoading(true);
      // Busca OS do cache local (SQLite)
      const cachedOrders = getServiceOrders();
      
      // Converte dados do SQLite para o formato ServiceOrder (parse JSON de strings)
      const formattedOrders = cachedOrders.map((o: any) => ({
        ...o,
        customer: { name: o.customer_name },
        address: { 
          to_s: o.address_text,
          // 📍 Campos de latitude e longitude que o Rails deve enviar no futuro
          latitude: o.latitude || null, 
          longitude: o.longitude || null
        }
      }));

      setOrders(formattedOrders);

      // Captura localização atual para centralizar mapa
      const pos = await getCurrentPosition();
      if (pos) {
        setUserLocation({
          latitude: pos.latitude,
          longitude: pos.longitude
        });
      }
    } catch (error) {
      console.error('[LogisticsScreen] Erro ao carregar dados:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isFocused) {
      loadData();
    }
  }, [isFocused]);

  if (loading && orders.length === 0) {
    return (
      <View style={[styles.center, { backgroundColor: theme.background }]}>
        <ActivityIndicator size="large" color={Colors.primary} />
        <Text style={[styles.loadingText, { color: Colors.primary }]}>Carregando mapa logístico...</Text>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <MapViewComponent orders={orders} userLocation={userLocation} />
      
      {/* Overlay informativo se não houver pontos com coordenadas */}
      {orders.filter(o => o.address?.latitude).length === 0 && (
        <View style={[styles.warningOverlay, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          <Text style={[styles.warningText, { color: theme.textSecondary }]}>
            Nenhuma coordenada GPS disponível nas OS atuais para exibição no mapa.
          </Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 10,
    fontSize: 16,
    fontWeight: '600',
  },
  warningOverlay: {
    position: 'absolute',
    top: 50,
    left: 20,
    right: 20,
    padding: 15,
    borderRadius: 12,
    borderWidth: 1,
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  warningText: {
    textAlign: 'center',
    fontSize: 14,
  }
});
