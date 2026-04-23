import React from 'react';
import { StyleSheet, View, Dimensions, useColorScheme } from 'react-native';
import MapView, { Marker, Polyline, PROVIDER_GOOGLE } from 'react-native-maps';
import { ServiceOrder } from '../services/api';
import { Colors } from '../constants/colors';

interface MapViewComponentProps {
  orders: any[];
  userLocation?: { latitude: number; longitude: number };
}

const MapViewComponent: React.FC<MapViewComponentProps> = ({ orders, userLocation }) => {
  const colorScheme = useColorScheme();
  const theme = colorScheme === 'dark' ? Colors.dark : Colors.light;

  // Coordenada inicial (Suzano/SP como fallback caso não tenha localização)
  const initialRegion = {
    latitude: userLocation?.latitude || -23.5385,
    longitude: userLocation?.longitude || -46.3121,
    latitudeDelta: 0.0922,
    longitudeDelta: 0.0421,
  };

  const getMarkerColor = (status: string) => {
    switch (status?.toLowerCase()) {
      case 'concluída':
      case 'finished':
        return theme.success || '#4CAF50';
      case 'cancelada':
      case 'canceled':
        return theme.error || '#EF4444';
      case 'em conferência':
      case 'checking':
        return theme.warning || '#F59E0B';
      default:
        return Colors.primary || '#0D2E1C';
    }
  };

  return (
    <View style={styles.container}>
      <MapView
        provider={PROVIDER_GOOGLE}
        style={styles.map}
        initialRegion={initialRegion}
        showsUserLocation={true}
        showsMyLocationButton={true}
      >
        {orders.map((order, index) => {
          // Os campos de latitude/longitude devem vir no objeto address da OS
          if (!order.address?.latitude || !order.address?.longitude) return null;

          return (
            <Marker
              key={order.id || index}
              coordinate={{
                latitude: Number(order.address.latitude),
                longitude: Number(order.address.longitude),
              }}
              title={order.identifier || `#${order.id}`}
              description={order.customer?.name || order.address_text}
              pinColor={getMarkerColor(order.status)}
            />
          );
        })}
      </MapView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  map: {
    width: Dimensions.get('window').width,
    height: Dimensions.get('window').height,
  },
});

export default MapViewComponent;
