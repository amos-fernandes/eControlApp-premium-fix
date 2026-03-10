module.exports = {
  preset: "jest-expo",
  setupFilesAfterEnv: ["./temp-repo/__tests__/setup.ts"],
  transformIgnorePatterns: [
    "node_modules/(?!((jest-)?react-native|@react-native(-community)?)|expo(nent)?|@expo(nent)?/.*|@expo-google-fonts/.*|react-navigation|@react-navigation/.*|@unimodules/.*|unimodules|sentry-expo|native-base|react-native-svg)"
  ],
  moduleFileExtensions: ["ts", "tsx", "js", "jsx"],
  testMatch: [
    "**/temp-repo/__tests__/**/*.test.ts",
    "**/temp-repo/__tests__/**/*.test.tsx"
  ],
};
