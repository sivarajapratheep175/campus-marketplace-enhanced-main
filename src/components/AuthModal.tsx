import { useState } from "react";
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { ThemeColors } from "../theme";

export function AuthModal({
  visible,
  onClose,
  onClearError,
  onSubmit,
  onGoogleSignIn,
  error,
  colors,
}: {
  visible: boolean;
  onClose: () => void;
  onClearError: () => void;
  onSubmit: (
    displayName: string,
    email: string,
    password: string,
    isSignUp: boolean,
  ) => Promise<void>;
  onGoogleSignIn?: () => Promise<void>;
  error: string;
  colors: ThemeColors;
}) {
  const [isSignUp, setIsSignUp] = useState(false);
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [formError, setFormError] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    setFormError("");
    const normalizedEmail = email.trim();
    if (isSignUp && !displayName.trim()) {
      setFormError("Enter your name to create an account.");
      return;
    }
    if (!normalizedEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
      setFormError("Enter a valid email address.");
      return;
    }
    if (!password) {
      setFormError("Enter your password.");
      return;
    }
    if (isSignUp && password.length < 6) {
      setFormError("Choose a password with at least 6 characters.");
      return;
    }

    setBusy(true);
    try {
      await onSubmit(displayName, normalizedEmail, password, isSignUp);
      setPassword("");
    } catch (error) {
      setFormError(
        error instanceof Error ? error.message : "Authentication failed. Please try again.",
      );
    } finally {
      setBusy(false);
    }
  };

  const switchMode = () => {
    setIsSignUp((current) => !current);
    setFormError("");
    onClearError();
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.backdrop}>
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
        >
          <View style={[styles.card, { backgroundColor: colors.surface }]}>
            <Text style={[styles.title, { color: colors.text }]}>
              {isSignUp ? "Create your account" : "Welcome back"}
            </Text>
            <Text style={[styles.subtitle, { color: colors.muted }]}>
              {isSignUp
                ? "Join your campus marketplace community."
                : "Sign in to continue to your campus marketplace."}
            </Text>

            {isSignUp && (
              <TextInput
                accessibilityLabel="Your name"
                autoCapitalize="words"
                editable={!busy}
                onChangeText={setDisplayName}
                placeholder="Full name"
                placeholderTextColor={colors.muted}
                returnKeyType="next"
                style={[
                  styles.input,
                  { backgroundColor: colors.background, borderColor: colors.border, color: colors.text },
                ]}
                value={displayName}
              />
            )}
            <TextInput
              accessibilityLabel="Email address"
              autoCapitalize="none"
              autoComplete="email"
              editable={!busy}
              keyboardType="email-address"
              onChangeText={setEmail}
              placeholder="Email address"
              placeholderTextColor={colors.muted}
              returnKeyType="next"
              style={[
                styles.input,
                { backgroundColor: colors.background, borderColor: colors.border, color: colors.text },
              ]}
              textContentType="emailAddress"
              value={email}
            />
            <TextInput
              accessibilityLabel="Password"
              autoCapitalize="none"
              autoComplete={isSignUp ? "new-password" : "current-password"}
              editable={!busy}
              onChangeText={setPassword}
              onSubmitEditing={submit}
              placeholder="Password"
              placeholderTextColor={colors.muted}
              returnKeyType="done"
              secureTextEntry
              style={[
                styles.input,
                { backgroundColor: colors.background, borderColor: colors.border, color: colors.text },
              ]}
              textContentType={isSignUp ? "newPassword" : "password"}
              value={password}
            />
            <Text style={[styles.hint, { color: colors.muted }]}>
              {isSignUp ? "Use at least 6 characters." : " "}
            </Text>

            {error || formError ? (
              <Text accessibilityRole="alert" style={styles.error}>
                {formError || error}
              </Text>
            ) : null}

            <Pressable
              accessibilityRole="button"
              disabled={busy}
              onPress={submit}
              style={[styles.primary, { backgroundColor: colors.accent }, busy && styles.disabled]}
            >
              {busy ? (
                <ActivityIndicator color={colors.accentText} />
              ) : (
                <Text style={[styles.primaryText, { color: colors.accentText }]}>
                  {isSignUp ? "Create account" : "Sign in"}
                </Text>
              )}
            </Pressable>

            <Pressable
              accessibilityRole="button"
              disabled={busy}
              onPress={switchMode}
              style={styles.modeButton}
            >
              <Text style={[styles.modeText, { color: colors.accent }]}>
                {isSignUp
                  ? "Already have an account? Sign in"
                  : "New here? Create an account"}
              </Text>
            </Pressable>

            {onGoogleSignIn && (
              <Pressable
                accessibilityRole="button"
                disabled={busy}
                onPress={() => {
                  setFormError("");
                  setBusy(true);
                  onGoogleSignIn().catch((error: unknown) => {
                    setFormError(
                      error instanceof Error
                        ? error.message
                        : "Google sign-in failed. Please try again.",
                    );
                  }).finally(() => setBusy(false));
                }}
                style={[styles.secondary, { borderColor: colors.border }]}
              >
                <Text style={[styles.secondaryText, { color: colors.accent }]}>
                  Continue with Google
                </Text>
              </Pressable>
            )}

            <Pressable
              accessibilityRole="button"
              disabled={busy}
              onPress={onClose}
              style={styles.closeButton}
            >
              <Text style={[styles.closeText, { color: colors.muted }]}>Maybe later</Text>
            </Pressable>
          </View>
        </ScrollView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(15,40,33,.55)",
    justifyContent: "center",
  },
  scrollContent: { flexGrow: 1, justifyContent: "center", padding: 20 },
  card: { borderRadius: 20, padding: 24 },
  title: { fontSize: 24, fontWeight: "800" },
  subtitle: { lineHeight: 20, marginTop: 8, marginBottom: 12 },
  input: {
    height: 50,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    fontSize: 14,
    marginTop: 12,
  },
  hint: { fontSize: 12, minHeight: 16, marginTop: 6 },
  error: {
    color: "#B64950",
    backgroundColor: "#FBECEE",
    borderRadius: 10,
    padding: 10,
    fontSize: 12,
    marginTop: 8,
  },
  primary: {
    height: 50,
    borderRadius: 14,
    justifyContent: "center",
    alignItems: "center",
    marginTop: 16,
  },
  primaryText: { fontWeight: "800" },
  modeButton: { alignItems: "center", paddingVertical: 16 },
  modeText: { fontWeight: "700", fontSize: 13 },
  secondary: {
    height: 48,
    borderRadius: 14,
    borderWidth: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  secondaryText: { fontWeight: "700" },
  closeButton: { alignItems: "center", paddingTop: 16 },
  closeText: { fontWeight: "600" },
  disabled: { opacity: 0.65 },
});
