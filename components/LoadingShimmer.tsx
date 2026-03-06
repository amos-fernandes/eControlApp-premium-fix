import React, { useEffect, useRef } from "react";
import { Animated, StyleSheet, View } from "react-native";
import { useTheme } from "@/constants/theme";

function ShimmerCard() {
  const { theme } = useTheme();
  const opacity = useRef(new Animated.Value(0.4)).current;

  useEffect(() => {
    const anim = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, {
          toValue: 1,
          duration: 800,
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 0.4,
          duration: 800,
          useNativeDriver: true,
        }),
      ])
    );
    anim.start();
    return () => anim.stop();
  }, [opacity]);

  return (
    <Animated.View
      style={[
        styles.card,
        { backgroundColor: theme.card, borderColor: theme.border, opacity },
      ]}
    >
      <View style={styles.header}>
        <View style={[styles.idPlaceholder, { backgroundColor: theme.border }]} />
        <View style={[styles.badgePlaceholder, { backgroundColor: theme.border }]} />
      </View>
      <View style={[styles.lineLong, { backgroundColor: theme.border }]} />
      <View style={[styles.lineShort, { backgroundColor: theme.border }]} />
      <View style={[styles.lineShort, { backgroundColor: theme.border, width: "40%" }]} />
    </Animated.View>
  );
}

export function LoadingShimmer({ count = 5 }: { count?: number }) {
  return (
    <View style={styles.container}>
      {Array.from({ length: count }).map((_, i) => (
        <ShimmerCard key={i} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { paddingVertical: 8 },
  card: {
    borderRadius: 16,
    padding: 16,
    marginHorizontal: 16,
    marginVertical: 6,
    borderWidth: 1,
    gap: 10,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  idPlaceholder: {
    height: 18,
    width: 60,
    borderRadius: 6,
  },
  badgePlaceholder: {
    height: 18,
    width: 80,
    borderRadius: 10,
  },
  lineLong: {
    height: 14,
    width: "70%",
    borderRadius: 6,
  },
  lineShort: {
    height: 12,
    width: "50%",
    borderRadius: 6,
  },
});
