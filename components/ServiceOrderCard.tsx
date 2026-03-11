import { Feather, MaterialCommunityIcons } from "@expo/vector-icons";
import React, { useRef } from "react";
import { Animated, Pressable, StyleSheet, Text, View } from "react-native";
import { Colors } from "@/constants/colors";
import { useTheme } from "@/constants/theme";
import type { ServiceOrder } from "@/services/api";
import { getRouteName, getVoyageName, hasVoyage, getAddressName, getClientName } from "@/services/api";
import { StatusBadge } from "./StatusBadge";

interface ServiceOrderCardProps {
  order: ServiceOrder;
  onPress: () => void;
}

export function ServiceOrderCard({ order, onPress }: ServiceOrderCardProps) {
  const { theme } = useTheme();
  const scale = useRef(new Animated.Value(1)).current;

  const handlePressIn = () => {
    Animated.spring(scale, {
      toValue: 0.97,
      useNativeDriver: true,
      speed: 30,
      bounciness: 0,
    }).start();
  };

  const handlePressOut = () => {
    Animated.spring(scale, {
      toValue: 1,
      useNativeDriver: true,
      speed: 20,
      bounciness: 2,
    }).start();
  };

  const clientName = getClientName(order);
  const address = getAddressName(order);
  const routeName = getRouteName(order);
  const voyageName = getVoyageName(order);
  const orderHasVoyage = hasVoyage(order);
  
  // Usa identifier se disponível, senão usa ID formatado
  const displayId = order.identifier || `#${String(order.id).padStart(4, "0")}`;

  return (
    <Animated.View style={{ transform: [{ scale }] }}>
      <Pressable
        style={[
          styles.card,
          {
            backgroundColor: theme.card,
            borderColor: theme.border,
          },
        ]}
        onPress={onPress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
      >
        <View style={styles.header}>
          <View style={styles.idContainer}>
            <Text style={[styles.idLabel, { color: theme.textMuted }]}>OS</Text>
            <Text style={[styles.id, { color: theme.text }]}>
              {displayId}
            </Text>
          </View>
          <StatusBadge status={order.status} small />
        </View>

        <Text style={[styles.clientName, { color: theme.text }]} numberOfLines={1}>
          {clientName}
        </Text>

        {address ? (
          <View style={styles.row}>
            <Feather name="map-pin" size={12} color={theme.textMuted} />
            <Text
              style={[styles.infoText, { color: theme.textSecondary }]}
              numberOfLines={1}
            >
              {address}
            </Text>
          </View>
        ) : null}

        <View style={styles.footer}>
          <View style={styles.row}>
            <MaterialCommunityIcons
              name="routes"
              size={12}
              color={theme.textMuted}
            />
            <Text style={[styles.infoText, { color: theme.textMuted }]}>
              {routeName}
            </Text>
          </View>

          {orderHasVoyage && voyageName ? (
            <View style={styles.voyageBadge}>
              <Feather name="truck" size={10} color={Colors.primary} />
              <Text style={[styles.voyageText, { color: Colors.primary }]}>
                {voyageName}
              </Text>
            </View>
          ) : null}
        </View>

        {order.mtr_id ? (
          <View style={[styles.mtrBadge, { backgroundColor: "#DCFCE7" }]}>
            <Feather name="file-text" size={10} color="#166534" />
            <Text style={styles.mtrText}>MTR emitido</Text>
          </View>
        ) : null}
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 16,
    padding: 16,
    marginHorizontal: 16,
    marginVertical: 6,
    borderWidth: 1,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  idContainer: {
    flexDirection: "row",
    alignItems: "baseline",
    gap: 4,
  },
  idLabel: {
    fontSize: 11,
    fontWeight: "500",
    fontFamily: "Inter_400Regular",
  },
  id: {
    fontSize: 16,
    fontWeight: "700",
    fontFamily: "Inter_700Bold",
  },
  clientName: {
    fontSize: 15,
    fontWeight: "600",
    marginBottom: 6,
    fontFamily: "Inter_600SemiBold",
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    flex: 1,
  },
  infoText: {
    fontSize: 12,
    flex: 1,
    fontFamily: "Inter_400Regular",
  },
  footer: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 8,
  },
  voyageBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    backgroundColor: "#DCFCE7",
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 10,
  },
  voyageText: {
    fontSize: 10,
    fontWeight: "600",
    fontFamily: "Inter_600SemiBold",
  },
  mtrBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginTop: 8,
    alignSelf: "flex-start",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  mtrText: {
    fontSize: 10,
    color: "#166534",
    fontWeight: "600",
    fontFamily: "Inter_600SemiBold",
  },
});
