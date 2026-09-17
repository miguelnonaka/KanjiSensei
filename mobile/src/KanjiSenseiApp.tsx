import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import * as SecureStore from "expo-secure-store";
import { featuredKanjis, Kanji, onboardingSlides } from "./data";
import { colors, jlptColors } from "./theme";

const API_URL = "http://localhost:3000";
const TOKEN_KEY = "kanjisensei.auth.token";
type Screen = "splash" | "onboarding" | "login" | "home" | "search" | "study" | "progress" | "profile" | "detail";
type User = { id: number; email: string };

type Props = { initialScreen?: Screen };

export default function KanjiSenseiApp({ initialScreen = "splash" }: Props) {
  const [screen, setScreen] = useState<Screen>(initialScreen);
  const [onboardingIndex, setOnboardingIndex] = useState(0);
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [kanjis, setKanjis] = useState<Kanji[]>(featuredKanjis);
  const [selectedKanji, setSelectedKanji] = useState<Kanji>(featuredKanjis[0]);
  const [loading, setLoading] = useState(initialScreen === "splash");

  useEffect(() => {
    if (initialScreen !== "splash") return;
    const timer = setTimeout(() => setScreen("onboarding"), 2200);
    return () => clearTimeout(timer);
  }, [initialScreen]);

  useEffect(() => {
    restoreSession();
  }, []);

  async function restoreSession() {
    const savedToken = await SecureStore.getItemAsync(TOKEN_KEY);
    if (!savedToken) {
      setLoading(false);
      return;
    }
    try {
      const response = await fetch(`${API_URL}/api/auth/me`, { headers: { Authorization: `Bearer ${savedToken}` } });
      if (!response.ok) throw new Error("Sessão expirada");
      const data = await response.json() as { user: User };
      setToken(savedToken);
      setUser(data.user);
      await loadKanjis(savedToken);
      setScreen("home");
    } catch {
      await SecureStore.deleteItemAsync(TOKEN_KEY);
    } finally {
      setLoading(false);
    }
  }

  async function loadKanjis(authToken: string) {
    const response = await fetch(`${API_URL}/api/kanjis`, { headers: { Authorization: `Bearer ${authToken}` } });
    if (response.ok) {
      const data = await response.json() as Kanji[];
      setKanjis(data.length ? data : featuredKanjis);
    }
  }

  async function authenticate(email: string, password: string, mode: "login" | "register") {
    const response = await fetch(`${API_URL}/api/auth/${mode}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    const data = await response.json() as { token?: string; user?: User; message?: string };
    if (!response.ok || !data.token || !data.user) throw new Error(data.message ?? "Não foi possível entrar.");
    await SecureStore.setItemAsync(TOKEN_KEY, data.token);
    setToken(data.token);
    setUser(data.user);
    await loadKanjis(data.token);
    setScreen("home");
  }

  async function logout() {
    await SecureStore.deleteItemAsync(TOKEN_KEY);
    setToken(null);
    setUser(null);
    setScreen("login");
  }

  function openKanji(kanji: Kanji) {
    setSelectedKanji(kanji);
    setScreen("detail");
  }

  if (loading && screen === "splash") return <SplashScreen />;
  if (screen === "splash") return <SplashScreen />;
  if (screen === "onboarding") return <OnboardingScreen index={onboardingIndex} onSkip={() => setScreen("login")} onNext={() => onboardingIndex === onboardingSlides.length - 1 ? setScreen("login") : setOnboardingIndex(onboardingIndex + 1)} />;
  if (screen === "login") return <LoginScreen onAuthenticate={authenticate} />;

  return (
    <SafeAreaView style={styles.app}>
      {screen === "home" && <HomeScreen user={user} kanjis={kanjis} onOpen={openKanji} onNavigate={setScreen} />}
      {screen === "search" && <SearchScreen kanjis={kanjis} onOpen={openKanji} />}
      {screen === "study" && <StudyScreen onNavigate={setScreen} />}
      {screen === "progress" && <ProgressScreen />}
      {screen === "profile" && <ProfileScreen user={user} onLogout={logout} />}
      {screen === "detail" && <DetailScreen kanji={selectedKanji} onBack={() => setScreen("home")} onStudy={() => setScreen("study")} />}
      {screen !== "detail" && <BottomNav screen={screen} onNavigate={setScreen} />}
    </SafeAreaView>
  );
}

function SplashScreen() {
  return <View style={styles.splash}><View style={styles.logo}><Text style={styles.logoKanji}>先</Text></View><Text style={styles.splashTitle}>KanjiSensei</Text><Text style={styles.splashSubtitle}>Aprenda kanji de forma inteligente</Text><Text style={styles.dots}>●  ●  ●</Text></View>;
}

function OnboardingScreen({ index, onSkip, onNext }: { index: number; onSkip: () => void; onNext: () => void }) {
  const slide = onboardingSlides[index];
  return <SafeAreaView style={styles.container}><Pressable onPress={onSkip} style={styles.skip}><Text style={styles.link}>Pular</Text></Pressable><View style={styles.onboardingBody}><View style={[styles.onboardingCard, { backgroundColor: slide.color }]}><Text style={styles.onboardingKanji}>{slide.character}</Text></View><Text style={styles.heroTitle}>{slide.title}</Text><Text style={styles.bodyText}>{slide.text}</Text><View style={styles.slideDots}>{onboardingSlides.map((_, dot) => <View key={dot} style={[styles.dot, dot === index && styles.activeDot]} />)}</View><Pressable onPress={onNext} style={styles.primaryButton}><Text style={styles.primaryButtonText}>{index === onboardingSlides.length - 1 ? "Começar" : "Próximo"}</Text></Pressable></View></SafeAreaView>;
}

function LoginScreen({ onAuthenticate }: { onAuthenticate: (email: string, password: string, mode: "login" | "register") => Promise<void> }) {
  const [mode, setMode] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [sending, setSending] = useState(false);
  async function submit() { setSending(true); setError(""); try { await onAuthenticate(email, password, mode); } catch (caught) { setError(caught instanceof Error ? caught.message : "Erro inesperado."); } finally { setSending(false); } }
  return <SafeAreaView style={styles.container}><View style={styles.authHeader}><View style={styles.smallLogo}><Text style={styles.smallLogoKanji}>先</Text></View><Text style={styles.title}>{mode === "login" ? "Entrar na sua conta" : "Criar conta"}</Text><Text style={styles.bodyText}>Seu progresso acompanha você.</Text></View><View style={styles.form}><TextInput autoCapitalize="none" keyboardType="email-address" onChangeText={setEmail} placeholder="E-mail" placeholderTextColor={colors.secondaryText} style={styles.input} value={email} /><TextInput onChangeText={setPassword} placeholder="Senha com pelo menos 8 caracteres" placeholderTextColor={colors.secondaryText} secureTextEntry style={styles.input} value={password} />{error ? <Text style={styles.error}>{error}</Text> : null}<Pressable disabled={sending} onPress={submit} style={styles.primaryButton}>{sending ? <ActivityIndicator color={colors.surface} /> : <Text style={styles.primaryButtonText}>{mode === "login" ? "Entrar" : "Criar conta"}</Text>}</Pressable><Pressable onPress={() => setMode(mode === "login" ? "register" : "login")}><Text style={styles.link}>{mode === "login" ? "Criar uma conta" : "Já tenho uma conta"}</Text></Pressable></View></SafeAreaView>;
}

function HomeScreen({ user, kanjis, onOpen, onNavigate }: { user: User | null; kanjis: Kanji[]; onOpen: (kanji: Kanji) => void; onNavigate: (screen: Screen) => void }) {
  const day = kanjis.find((kanji) => kanji.character === "日") ?? featuredKanjis[0];
  return <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}><Text style={styles.eyebrow}>KANJISENSEI</Text><Text style={styles.greeting}>Olá, {user?.email.split("@")[0] ?? "estudante"} 👋</Text><Text style={styles.title}>Continue seus estudos</Text><Pressable onPress={() => onOpen(day)} style={styles.dayCard}><Text style={styles.cardEyebrow}>KANJI DO DIA</Text><Text style={styles.dayKanji}>{day.character}</Text><Text style={styles.dayReading}>{day.onyomi} / {day.kunyomi}</Text><Text style={styles.dayMeaning}>{day.meaning}</Text><Text style={styles.dayLink}>Ver detalhes →</Text></Pressable><View style={styles.twoColumns}><ActionCard emoji="📋" title="Revisões de hoje" value="12 kanjis" action="Começar" onPress={() => onNavigate("study")} /><ActionCard emoji="🎯" title="Meta diária" value="8 / 10" action="2 restantes" onPress={() => onNavigate("progress")} /></View><SectionHeader title="Seu progresso" action="Ver tudo" onPress={() => onNavigate("progress")} /><View style={styles.card}><Text style={styles.progressNumber}>127 / 213 kanjis</Text><ProgressBar value={0.6} color={colors.primary} /><View style={styles.statsRow}><Stat value="127" label="Aprendidos" color={colors.success} /><Stat value="43" label="Aprendendo" color="#2E7DAF" /><Stat value="43" label="Novos" color={colors.secondaryText} /></View></View><SectionHeader title="Recomendado" action="Revisar agora" onPress={() => onNavigate("study")} /><View style={styles.recommendations}>{kanjis.slice(0, 3).map((kanji) => <Pressable key={kanji.id} onPress={() => onOpen(kanji)} style={styles.recommendation}><Text style={styles.recommendationKanji}>{kanji.character}</Text><Text style={styles.recommendationMeaning}>{kanji.meaning}</Text></Pressable>)}</View></ScrollView>;
}

function SearchScreen({ kanjis, onOpen }: { kanjis: Kanji[]; onOpen: (kanji: Kanji) => void }) {
  const [query, setQuery] = useState("");
  const results = kanjis.filter((kanji) => `${kanji.character} ${kanji.meaning} ${kanji.onyomi} ${kanji.kunyomi}`.toLowerCase().includes(query.toLowerCase()));
  return <ScrollView contentContainerStyle={styles.scroll}><Text style={styles.title}>Buscar</Text><TextInput onChangeText={setQuery} placeholder="Busque por kanji ou significado" placeholderTextColor={colors.secondaryText} style={styles.searchInput} value={query} /><View style={styles.modeRow}><ModeButton label="📷 Câmera" /><ModeButton label="✏️ Escrever" /><ModeButton label="🎤 Voz" /></View><Text style={styles.sectionTitle}>{query ? `${results.length} resultados` : "Kanjis recentes"}</Text>{results.map((kanji) => <KanjiRow key={kanji.id} kanji={kanji} onPress={() => onOpen(kanji)} />)}</ScrollView>;
}

function StudyScreen({ onNavigate }: { onNavigate: (screen: Screen) => void }) { return <ScrollView contentContainerStyle={styles.scroll}><Text style={styles.title}>Estudar</Text><Text style={styles.bodyText}>Escolha como deseja praticar.</Text><StudyCard emoji="🔄" title="Revisão diária" detail="12 cartões · SRS" onPress={() => onNavigate("detail")} /><StudyCard emoji="❓" title="Quiz" detail="10 perguntas · múltipla escolha" onPress={() => onNavigate("progress")} /><StudyCard emoji="🃏" title="Flashcards" detail="20 cartões" onPress={() => onNavigate("detail")} /><StudyCard emoji="⚡" title="Kanjis difíceis" detail="8 cartões · alta dificuldade" onPress={() => onNavigate("detail")} /></ScrollView>; }

function ProgressScreen() { return <ScrollView contentContainerStyle={styles.scroll}><Text style={styles.title}>Progresso</Text><Text style={styles.bodyText}>Sua evolução aparece aqui.</Text><View style={styles.twoColumns}><StatCard value="127" label="Aprendidos" color={colors.success} /><StatCard value="43" label="Aprendendo" color="#2E7DAF" /><StatCard value="86" label="Novos" color={colors.secondaryText} /><StatCard value="7" label="Dias seguidos" color={colors.accent} /></View><View style={styles.card}><Text style={styles.sectionTitle}>Progresso JLPT</Text>{["N5", "N4", "N3", "N2", "N1"].map((level, index) => <View key={level} style={styles.progressLevel}><View style={styles.levelHeader}><Text style={[styles.jlpt, { color: jlptColors[level] }]}>{level}</Text><Text style={styles.bodyText}>{["100%", "72%", "35%", "8%", "0%"][index]}</Text></View><ProgressBar value={[1, 0.72, 0.35, 0.08, 0][index]} color={jlptColors[level]} /></View>)}</View></ScrollView>; }

function ProfileScreen({ user, onLogout }: { user: User | null; onLogout: () => void }) { return <ScrollView contentContainerStyle={styles.scroll}><View style={styles.profileHeader}><View style={styles.avatar}><Text style={styles.avatarText}>{(user?.email[0] ?? "T").toUpperCase()}</Text></View><Text style={styles.title}>Seu perfil</Text><Text style={styles.bodyText}>{user?.email}</Text></View><View style={styles.card}>{["✏️ Editar perfil", "⚙️ Configurações", "🔔 Notificações", "🌐 Idioma", "字 Tamanho dos kanjis", "📶 Modo offline", "💾 Backup"].map((item) => <Pressable key={item} style={styles.option}><Text style={styles.optionText}>{item}</Text><Text style={styles.arrow}>›</Text></Pressable>)}</View><Pressable onPress={onLogout} style={styles.logout}><Text style={styles.logoutText}>Sair da conta</Text></Pressable></ScrollView>; }

function DetailScreen({ kanji, onBack, onStudy }: { kanji: Kanji; onBack: () => void; onStudy: () => void }) { return <ScrollView contentContainerStyle={styles.scroll}><Pressable onPress={onBack}><Text style={styles.link}>← Voltar</Text></Pressable><Text style={styles.title}>Detalhes do Kanji</Text><View style={styles.detailCard}><Text style={styles.detailKanji}>{kanji.character}</Text><View style={styles.detailInfo}><Text style={styles.detailReading}>{kanji.onyomi}</Text><Text style={styles.bodyText}>On'yomi</Text><Text style={styles.detailReading}>{kanji.kunyomi}</Text><Text style={styles.bodyText}>Kun'yomi</Text><Text style={[styles.jlpt, { color: jlptColors[kanji.jlpt ?? "N5"] }]}>{kanji.jlpt ?? "Sem JLPT"} · {kanji.strokeCount ?? "?"} traços</Text></View><View style={styles.divider} /><Text style={styles.eyebrow}>SIGNIFICADO</Text><Text style={styles.detailMeaning}>{kanji.meaning}</Text></View><Text style={styles.sectionTitle}>Ordem dos traços</Text><View style={styles.strokeDots}>{Array.from({ length: kanji.strokeCount ?? 1 }, (_, index) => <View key={index} style={styles.strokeDot}><Text>{index + 1}</Text></View>)}</View><Pressable onPress={onStudy} style={styles.primaryButton}><Text style={styles.primaryButtonText}>Estudar este kanji</Text></Pressable></ScrollView>; }

function BottomNav({ screen, onNavigate }: { screen: Screen; onNavigate: (screen: Screen) => void }) { return <View style={styles.bottomNav}>{([["home", "⌂", "Início"], ["search", "⌕", "Buscar"], ["study", "◈", "Estudar"], ["progress", "▥", "Progresso"], ["profile", "○", "Perfil"]] as [Screen, string, string][]).map(([target, icon, label]) => <Pressable key={target} onPress={() => onNavigate(target)} style={styles.navItem}><Text style={[styles.navIcon, screen === target && styles.activeNav]}>{icon}</Text><Text style={[styles.navLabel, screen === target && styles.activeNav]}>{label}</Text></Pressable>)}</View>; }

function ActionCard({ emoji, title, value, action, onPress }: { emoji: string; title: string; value: string; action: string; onPress: () => void }) { return <View style={styles.actionCard}><Text style={styles.emoji}>{emoji}</Text><Text style={styles.cardTitle}>{title}</Text><Text style={styles.bodyText}>{value}</Text><Pressable onPress={onPress}><Text style={styles.link}>{action}</Text></Pressable></View>; }
function StudyCard({ emoji, title, detail, onPress }: { emoji: string; title: string; detail: string; onPress: () => void }) { return <Pressable onPress={onPress} style={styles.studyCard}><Text style={styles.emoji}>{emoji}</Text><View><Text style={styles.cardTitle}>{title}</Text><Text style={styles.bodyText}>{detail}</Text></View><Text style={styles.arrow}>›</Text></Pressable>; }
function ModeButton({ label }: { label: string }) { return <Pressable style={styles.modeButton}><Text style={styles.modeLabel}>{label}</Text></Pressable>; }
function SectionHeader({ title, action, onPress }: { title: string; action: string; onPress: () => void }) { return <View style={styles.sectionHeader}><Text style={styles.sectionTitle}>{title}</Text><Pressable onPress={onPress}><Text style={styles.link}>{action}</Text></Pressable></View>; }
function ProgressBar({ value, color }: { value: number; color: string }) { return <View style={styles.progressTrack}><View style={[styles.progressFill, { width: `${Math.max(0, Math.min(value, 1)) * 100}%`, backgroundColor: color }]} /></View>; }
function Stat({ value, label, color }: { value: string; label: string; color: string }) { return <View><Text style={[styles.statValue, { color }]}>{value}</Text><Text style={styles.statLabel}>{label}</Text></View>; }
function StatCard({ value, label, color }: { value: string; label: string; color: string }) { return <View style={styles.statCard}><Stat value={value} label={label} color={color} /></View>; }
function KanjiRow({ kanji, onPress }: { kanji: Kanji; onPress: () => void }) { return <Pressable onPress={onPress} style={styles.kanjiRow}><Text style={styles.rowKanji}>{kanji.character}</Text><View style={styles.rowCopy}><Text style={styles.cardTitle}>{kanji.meaning}</Text><Text style={styles.bodyText}>{kanji.onyomi} · {kanji.kunyomi}</Text></View><Text style={[styles.jlpt, { color: jlptColors[kanji.jlpt ?? "N5"] }]}>{kanji.jlpt}</Text></Pressable>; }

const styles = StyleSheet.create({
  app: { flex: 1, backgroundColor: colors.bg }, container: { flex: 1, backgroundColor: colors.bg, padding: 20 }, scroll: { padding: 20, paddingBottom: 100 }, splash: { alignItems: "center", backgroundColor: colors.primary, flex: 1, justifyContent: "center" }, logo: { alignItems: "center", backgroundColor: "rgba(255,255,255,0.15)", borderRadius: 28, height: 96, justifyContent: "center", width: 96 }, logoKanji: { color: colors.surface, fontSize: 56 }, splashTitle: { color: colors.surface, fontSize: 32, fontWeight: "700", marginTop: 16 }, splashSubtitle: { color: colors.surface, fontSize: 15, marginTop: 6, opacity: 0.75 }, dots: { color: colors.surface, fontSize: 14, marginTop: 28, opacity: 0.8 }, skip: { alignSelf: "flex-end", padding: 8 }, onboardingBody: { alignItems: "center", flex: 1, justifyContent: "center" }, onboardingCard: { alignItems: "center", borderRadius: 28, height: 200, justifyContent: "center", marginBottom: 32, width: 200 }, onboardingKanji: { color: colors.surface, fontSize: 110 }, heroTitle: { color: colors.text, fontSize: 26, fontWeight: "700", textAlign: "center" }, title: { color: colors.text, fontSize: 24, fontWeight: "700", marginTop: 6 }, greeting: { color: colors.secondaryText, fontSize: 15, marginTop: 24 }, bodyText: { color: colors.secondaryText, fontSize: 15, lineHeight: 22, marginTop: 6 }, primaryButton: { alignItems: "center", backgroundColor: colors.primary, borderRadius: 12, justifyContent: "center", marginTop: 24, minHeight: 52, paddingHorizontal: 20, width: "100%" }, primaryButtonText: { color: colors.surface, fontSize: 16, fontWeight: "700" }, link: { color: colors.primary, fontSize: 15, fontWeight: "700", marginTop: 14 }, slideDots: { flexDirection: "row", gap: 8, marginTop: 30 }, dot: { backgroundColor: colors.border, borderRadius: 4, height: 8, width: 8 }, activeDot: { backgroundColor: colors.primary, width: 24 }, authHeader: { alignItems: "center", marginTop: 56 }, smallLogo: { alignItems: "center", backgroundColor: colors.primary, borderRadius: 20, height: 72, justifyContent: "center", width: 72 }, smallLogoKanji: { color: colors.surface, fontSize: 40 }, form: { gap: 14, marginTop: 40 }, input: { backgroundColor: colors.surface, borderColor: colors.border, borderRadius: 12, borderWidth: 1.5, color: colors.text, height: 50, paddingHorizontal: 16 }, error: { color: colors.error, fontSize: 14 }, eyebrow: { color: colors.primary, fontSize: 12, fontWeight: "700", letterSpacing: 1.2 }, dayCard: { backgroundColor: colors.primary, borderRadius: 20, marginTop: 24, padding: 20 }, cardEyebrow: { color: colors.surface, fontSize: 12, fontWeight: "700", letterSpacing: 1.2, opacity: 0.8 }, dayKanji: { color: colors.surface, fontSize: 72, marginTop: 12 }, dayReading: { color: colors.surface, fontSize: 18, marginTop: 4 }, dayMeaning: { color: colors.surface, fontSize: 16, marginTop: 5 }, dayLink: { color: colors.surface, fontSize: 14, fontWeight: "700", marginTop: 20 }, twoColumns: { flexDirection: "row", gap: 12, marginTop: 12 }, actionCard: { backgroundColor: colors.surface, borderColor: colors.border, borderRadius: 16, borderWidth: 1.5, flex: 1, padding: 14 }, emoji: { fontSize: 24, marginBottom: 10 }, cardTitle: { color: colors.text, fontSize: 16, fontWeight: "700" }, sectionHeader: { alignItems: "center", flexDirection: "row", justifyContent: "space-between", marginTop: 24 }, sectionTitle: { color: colors.text, fontSize: 19, fontWeight: "700", marginTop: 24 }, card: { backgroundColor: colors.surface, borderColor: colors.border, borderRadius: 16, borderWidth: 1.5, marginTop: 12, padding: 16 }, progressNumber: { color: colors.text, fontSize: 20, fontWeight: "700", marginBottom: 12 }, progressTrack: { backgroundColor: colors.border, borderRadius: 5, height: 9, overflow: "hidden" }, progressFill: { borderRadius: 5, height: "100%" }, statsRow: { flexDirection: "row", justifyContent: "space-between", marginTop: 18 }, statValue: { fontSize: 22, fontWeight: "700" }, statLabel: { color: colors.secondaryText, fontSize: 12, marginTop: 4 }, recommendations: { flexDirection: "row", gap: 10, marginTop: 12 }, recommendation: { backgroundColor: "#FFF5F5", borderColor: colors.primary, borderRadius: 12, borderWidth: 1, flex: 1, padding: 12 }, recommendationKanji: { color: colors.primary, fontSize: 32 }, recommendationMeaning: { color: colors.text, fontSize: 12, marginTop: 4 }, bottomNav: { backgroundColor: colors.surface, borderTopColor: colors.border, borderTopWidth: 1, flexDirection: "row", justifyContent: "space-around", paddingBottom: 10, paddingTop: 8 }, navItem: { alignItems: "center", flex: 1 }, navIcon: { color: colors.secondaryText, fontSize: 23 }, navLabel: { color: colors.secondaryText, fontSize: 11, marginTop: 3 }, activeNav: { color: colors.primary, fontWeight: "700" }, searchInput: { backgroundColor: colors.surface, borderColor: colors.border, borderRadius: 12, borderWidth: 1.5, color: colors.text, height: 52, marginTop: 24, paddingHorizontal: 16 }, modeRow: { flexDirection: "row", gap: 8, marginTop: 14 }, modeButton: { backgroundColor: colors.surface, borderColor: colors.border, borderRadius: 10, borderWidth: 1.5, flex: 1, padding: 12 }, modeLabel: { color: colors.text, fontSize: 12, textAlign: "center" }, kanjiRow: { alignItems: "center", backgroundColor: colors.surface, borderColor: colors.border, borderRadius: 14, borderWidth: 1.5, flexDirection: "row", marginTop: 10, padding: 14 }, rowKanji: { color: colors.primary, fontSize: 44, width: 64 }, rowCopy: { flex: 1 }, jlpt: { fontSize: 13, fontWeight: "700" }, studyCard: { alignItems: "center", backgroundColor: colors.surface, borderColor: colors.border, borderRadius: 16, borderWidth: 1.5, flexDirection: "row", gap: 14, marginTop: 12, padding: 16 }, studyCardText: { flex: 1 }, arrow: { color: colors.secondaryText, fontSize: 26 }, statCard: { backgroundColor: colors.surface, borderColor: colors.border, borderRadius: 16, borderWidth: 1.5, flex: 1, minWidth: "45%", padding: 16 }, progressLevel: { marginTop: 14 }, levelHeader: { alignItems: "center", flexDirection: "row", justifyContent: "space-between", marginBottom: 6 }, profileHeader: { alignItems: "center", marginTop: 20 }, avatar: { alignItems: "center", backgroundColor: colors.primary, borderRadius: 35, height: 70, justifyContent: "center", width: 70 }, avatarText: { color: colors.surface, fontSize: 30, fontWeight: "700" }, option: { alignItems: "center", borderBottomColor: colors.border, borderBottomWidth: 1, flexDirection: "row", justifyContent: "space-between", paddingVertical: 16 }, optionText: { color: colors.text, fontSize: 15 }, logout: { backgroundColor: "#FFF0F0", borderRadius: 12, marginTop: 20, padding: 16 }, logoutText: { color: colors.error, fontWeight: "700", textAlign: "center" }, detailCard: { backgroundColor: colors.surface, borderColor: colors.border, borderRadius: 16, borderWidth: 1.5, flexDirection: "row", flexWrap: "wrap", marginTop: 20, padding: 18 }, detailKanji: { color: colors.primary, fontSize: 100, width: "40%" }, detailInfo: { flex: 1, justifyContent: "center" }, detailReading: { color: colors.text, fontSize: 18, fontWeight: "700", marginTop: 8 }, divider: { backgroundColor: colors.border, height: 1, marginVertical: 16, width: "100%" }, detailMeaning: { color: colors.text, fontSize: 22, fontWeight: "700", marginTop: 8 }, strokeDots: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 14 }, strokeDot: { alignItems: "center", backgroundColor: "#FFF5F5", borderColor: colors.primary, borderRadius: 20, borderWidth: 1, height: 38, justifyContent: "center", width: 38 },
});
