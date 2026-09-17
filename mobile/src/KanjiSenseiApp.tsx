import { useEffect, useState } from "react";
import { ActivityIndicator, SafeAreaView, StyleSheet, Text, View } from "react-native";
import * as SecureStore from "expo-secure-store";
import { featuredKanjis } from "./data";
import { colors } from "./theme";
import { Kanji, Screen, User } from "./types";
import BottomNav from "./components/BottomNav";
import AuthScreen from "./screens/AuthScreen";
import OnboardingScreen from "./screens/OnboardingScreen";
import SplashScreen from "./screens/SplashScreen";
import { DetailScreen, HomeScreen, ProfileScreen, ProgressScreen, SearchScreen, StudyScreen } from "./screens/MainScreens";

const API_URL = "http://localhost:3000";
const TOKEN_KEY = "kanjisensei.auth.token";

export default function KanjiSenseiApp() {
  const [screen, setScreen] = useState<Screen>("splash");
  const [onboardingIndex, setOnboardingIndex] = useState(0);
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [kanjis, setKanjis] = useState<Kanji[]>(featuredKanjis);
  const [selectedKanji, setSelectedKanji] = useState<Kanji>(featuredKanjis[0]);
  const [loading, setLoading] = useState(true);
  const [connectionError, setConnectionError] = useState("");

  useEffect(() => { const timer = setTimeout(() => setScreen("onboarding"), 2200); return () => clearTimeout(timer); }, []);
  useEffect(() => { restoreSession(); }, []);

  async function restoreSession() {
    const savedToken = await SecureStore.getItemAsync(TOKEN_KEY);
    if (!savedToken) { setLoading(false); return; }
    try {
      const response = await fetch(`${API_URL}/api/auth/me`, { headers: { Authorization: `Bearer ${savedToken}` } });
      if (!response.ok) throw new Error("Sessão expirada");
      const data = await response.json() as { user: User };
      setToken(savedToken); setUser(data.user); await loadKanjis(savedToken); setScreen("home");
    } catch { await SecureStore.deleteItemAsync(TOKEN_KEY); setConnectionError("Não foi possível conectar ao backend."); }
    finally { setLoading(false); }
  }

  async function loadKanjis(authToken: string) {
    const response = await fetch(`${API_URL}/api/kanjis`, { headers: { Authorization: `Bearer ${authToken}` } });
    if (!response.ok) throw new Error("Falha ao carregar kanjis");
    const data = await response.json() as Kanji[];
    setKanjis(data);
  }

  async function authenticate(email: string, password: string, mode: "login" | "register") {
    setConnectionError("");
    const response = await fetch(`${API_URL}/api/auth/${mode}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email, password }) });
    const data = await response.json() as { token?: string; user?: User; message?: string };
    if (!response.ok || !data.token || !data.user) throw new Error(data.message ?? "Não foi possível entrar.");
    await SecureStore.setItemAsync(TOKEN_KEY, data.token); setToken(data.token); setUser(data.user); await loadKanjis(data.token); setScreen("home");
  }

  async function logout() { await SecureStore.deleteItemAsync(TOKEN_KEY); setToken(null); setUser(null); setScreen("login"); }
  function openKanji(kanji: Kanji) { setSelectedKanji(kanji); setScreen("detail"); }

  if (screen === "splash") return <SplashScreen />;
  if (screen === "onboarding") return <OnboardingScreen index={onboardingIndex} onSkip={() => setScreen("login")} onNext={() => onboardingIndex === 2 ? setScreen("login") : setOnboardingIndex(onboardingIndex + 1)} />;
  if (screen === "login") return <AuthScreen onAuthenticate={authenticate} />;
  if (loading) return <SafeAreaView style={styles.center}><ActivityIndicator color={colors.primary} /><Text style={styles.message}>Carregando sessão...</Text></SafeAreaView>;

  return <SafeAreaView style={styles.app}>{connectionError ? <Text style={styles.connectionError}>{connectionError}</Text> : null}{screen === "home" && <HomeScreen user={user} kanjis={kanjis} onOpen={openKanji} onNavigate={setScreen} />}{screen === "search" && <SearchScreen kanjis={kanjis} onOpen={openKanji} />}{screen === "study" && <StudyScreen onNavigate={setScreen} />}{screen === "progress" && <ProgressScreen />}{screen === "profile" && <ProfileScreen user={user} onLogout={logout} />}{screen === "detail" && <DetailScreen kanji={selectedKanji} onBack={() => setScreen("home")} onStudy={() => setScreen("study")} />}{screen !== "detail" && <BottomNav screen={screen} onNavigate={setScreen} />}</SafeAreaView>;
}

const styles = StyleSheet.create({ app: { backgroundColor: colors.bg, flex: 1 }, center: { alignItems: "center", backgroundColor: colors.bg, flex: 1, justifyContent: "center", gap: 12 }, message: { color: colors.secondaryText }, connectionError: { backgroundColor: "#FFF0F0", color: colors.error, fontSize: 13, padding: 10, textAlign: "center" } });
