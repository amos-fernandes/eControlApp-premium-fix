// Simplified: always use standard ScrollView (keyboard-controller removed)
import { ScrollView, ScrollViewProps } from "react-native";

export function KeyboardAwareScrollViewCompat({
  children,
  keyboardShouldPersistTaps = "handled",
  ...props
}: ScrollViewProps & { keyboardShouldPersistTaps?: "always" | "never" | "handled" }) {
  return (
    <ScrollView keyboardShouldPersistTaps={keyboardShouldPersistTaps} {...props}>
      {children}
    </ScrollView>
  );
}
