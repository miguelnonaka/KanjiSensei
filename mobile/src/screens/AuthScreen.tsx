import { useState } from "react";
import { ActivityIndicator, Pressable, SafeAreaView, StyleSheet, Text, TextInput, View } from "react-native";
import { colors } from "../theme";

type Props = { onAuthenticate: (email: string, password: string, mode: "login" | "register") => Promise<void> };

export default function AuthScreen({ onAuthenticate }: Props) {
  const [mode, setMode] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [sending, setSending] = useState(false);

  async function submit() {
    setSending(true); setError("");
    try { await onAuthenticate(email, password, mode); }
    catch (caught) { setError(caught instanceof Error ? caught.message : "Erro inesperado."); }
    finally { setSending(false); }
  }

  return <SafeAreaView style={styles.container}><View style={styles.header}><View style={styles.logo}><Text style={styles.logoKanji}>先</Text></View><Text style={styles.title}>{mode === "login" ? "Entrar na sua conta" : "Criar conta"}</Text><Text style={styles.body}>Seu progresso acompanha você.</Text></View><View style={styles.form}><TextInput autoCapitalize="none" keyboardType="email-address" onChangeText={setEmail} placeholder="E-mail" placeholderTextColor={colors.secondaryText} style={styles.input} value={email} /><TextInput onChangeText={setPassword} placeholder="Senha com pelo menos 8 caracteres" placeholderTextColor={colors.secondaryText} secureTextEntry style={styles.input} value={password} />{error ? <Text style={styles.error}>{error}</Text> : null}<Pressable disabled={sending} onPress={submit} style={styles.primary}>{sending ? <ActivityIndicator color={colors.surface} /> : <Text style={styles.primaryText}>{mode === "login" ? "Entrar" : "Criar conta"}</Text>}</Pressable><Pressable onPress={() => setMode(mode === "login" ? "register" : "login")}><Text style={styles.link}>{mode === "login" ? "Criar uma conta" : "Já tenho uma conta"}</Text></Pressable></View></SafeAreaView>;
}

const styles = StyleSheet.create({ container: { flex: 1, backgroundColor: colors.bg, padding: 20 }, header: { alignItems: "center", marginTop: 56 }, logo: { alignItems: "center", backgroundColor: colors.primary, borderRadius: 20, height: 72, justifyContent: "center", width: 72 }, logoKanji: { color: colors.surface, fontSize: 40 }, title: { color: colors.text, fontSize: 24, fontWeight: "700", marginTop: 18 }, body: { color: colors.secondaryText, fontSize: 15, marginTop: 6 }, form: { gap: 14, marginTop: 40 }, input: { backgroundColor: colors.surface, borderColor: colors.border, borderRadius: 12, borderWidth: 1.5, color: colors.text, height: 50, paddingHorizontal: 16 }, error: { color: colors.error, fontSize: 14 }, primary: { alignItems: "center", backgroundColor: colors.primary, borderRadius: 12, justifyContent: "center", minHeight: 52 }, primaryText: { color: colors.surface, fontSize: 16, fontWeight: "700" }, link: { color: colors.primary, fontSize: 15, fontWeight: "700", textAlign: "center" } });
