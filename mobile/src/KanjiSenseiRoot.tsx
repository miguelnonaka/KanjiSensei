import { useEffect, useState } from "react";
import { ActivityIndicator, SafeAreaView, StyleSheet, Text } from "react-native";
import * as SecureStore from "expo-secure-store";
import Storage from "expo-sqlite/kv-store";
import { featuredKanjis } from "./data";
import { colors } from "./theme";
import { Kanji, KanjiProgress, KnowledgeStatus, QuizAttempt, ReviewHistoryItem, Screen, User } from "./types";
import {
  cacheRemoteKanjis,
  emptyProgress,
  getLocalKanjis,
  getLocalProgress,
  getLocalQuizAttempts,
  getLocalReviewHistory,
  getReviewSchedule,
  initializeLocalStore,
  saveLocalQuizAttempt,
  saveLocalProgress,
} from "./localStore";
import BottomNav from "./components/BottomNav";
import AuthScreen from "./screens/AuthScreen";
import OnboardingScreen from "./screens/OnboardingScreen";
import SplashScreen from "./screens/SplashScreen";
import {
  CameraScreen,
  DetailScreen,
  HomeScreen,
  ProgressScreen,
  ProfileScreen,
  SearchScreen,
  StudyScreen,
} from "./screens/ActiveScreens";

const API_URL = (process.env.EXPO_PUBLIC_API_URL ?? "").replace(/\/$/, "");
const API_CONFIGURATION_ERROR = "Não foi possível entrar agora. Verifique sua conexão e tente novamente, ou continue seus estudos offline.";
const TOKEN_KEY = "kanjisensei.auth.token";
const PROFILE_KEY = "kanjisensei.local.profile";

export default function KanjiSenseiRoot() {
  const [screen, setScreen] = useState<Screen>("splash");
  const [previousScreen, setPreviousScreen] = useState<Screen>("home");
  const [onboardingIndex, setOnboardingIndex] = useState(0);
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [kanjis, setKanjis] = useState<Kanji[]>(featuredKanjis);
  const [selectedKanji, setSelectedKanji] = useState<Kanji>(featuredKanjis[0]);
  const [progress, setProgress] = useState<KanjiProgress[]>([]);
  const [history, setHistory] = useState<ReviewHistoryItem[]>([]);
  const [quizHistory, setQuizHistory] = useState<QuizAttempt[]>([]);
  const [loading, setLoading] = useState(true);
  const [connectionError, setConnectionError] = useState("");

  useEffect(() => { void restoreApp(); }, []);

  async function restoreApp() {
    try {
      await initializeLocalStore();
      const catalog = await getLocalKanjis();
      if (catalog.length) setKanjis(catalog);

      const [savedToken, savedProfile] = await Promise.all([
        SecureStore.getItemAsync(TOKEN_KEY),
        Storage.getItem(PROFILE_KEY),
      ]);
      let restoredUser: User | null = savedProfile ? JSON.parse(savedProfile) as User : null;
      let activeToken: string | null = null;
      if (savedToken) {
        try {
          const response = await request(`${API_URL}/api/auth/me`, { headers: { Authorization: `Bearer ${savedToken}` } });
          if (!response.ok) throw new Error("Sessão expirada");
          const data = await response.json() as { user: User };
          restoredUser = data.user;
          activeToken = savedToken;
          setToken(savedToken);
          await Storage.setItem(PROFILE_KEY, JSON.stringify(data.user));
          await loadRemoteKanjis(savedToken);
        } catch {
          setConnectionError("Não foi possível atualizar seus estudos. O que já está salvo neste aparelho permanece disponível.");
        }
      }

      if (restoredUser) {
        setUser(restoredUser);
        await loadProfileData(restoredUser, activeToken);
        setScreen("home");
      } else {
        setScreen("onboarding");
      }
    } catch (error) {
      setConnectionError(error instanceof Error ? error.message : "Falha ao iniciar o banco local.");
      setScreen("onboarding");
    } finally {
      setLoading(false);
    }
  }

  async function request(url: string, options: RequestInit = {}) {
    if (!API_URL) throw new Error(API_CONFIGURATION_ERROR);
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 3500);
    try {
      return await fetch(url, { ...options, signal: controller.signal });
    } finally {
      clearTimeout(timeout);
    }
  }

  function profileId(profile: User) {
    return profile.isGuest ? "guest" : `user-${profile.id}`;
  }

  async function loadProfileData(profile: User, authToken: string | null = token) {
    const id = profileId(profile);
    let savedProgress = await getLocalProgress(id);
    if (authToken && !profile.isGuest) {
      try {
        const response = await request(`${API_URL}/api/me/kanjis`, {
          headers: { Authorization: `Bearer ${authToken}` },
        });
        if (response.ok) {
          const remoteProgress = await response.json() as Array<Omit<KanjiProgress, "kanjiId"> & { kanjiId: number }>;
          const catalog = await getLocalKanjis();
          for (const remote of remoteProgress) {
            const localKanji = catalog.find((kanji) => kanji.serverId === remote.kanjiId);
            if (!localKanji) continue;
            await saveLocalProgress(id, { ...remote, kanjiId: localKanji.id });
          }
          savedProgress = await getLocalProgress(id);
        }
      } catch {
        setConnectionError("Não foi possível atualizar seu progresso. Os dados deste aparelho continuam disponíveis.");
      }
    }
    let savedHistory = await getLocalReviewHistory(id);
    if (authToken && !profile.isGuest) {
      try {
        const response = await request(`${API_URL}/api/me/reviews`, {
          headers: { Authorization: `Bearer ${authToken}` },
        });
        if (response.ok) {
          const remoteHistory = await response.json() as Array<ReviewHistoryItem & { character: string }>;
          const catalog = await getLocalKanjis();
          savedHistory = remoteHistory.flatMap((item) => {
            const kanji = catalog.find((value) => value.serverId === item.kanjiId || value.character === item.character);
            return kanji ? [{ ...item, id: -item.id, kanjiId: kanji.id }] : [];
          });
        }
      } catch {
        setConnectionError("Não foi possível atualizar suas revisões. Os registros deste aparelho continuam disponíveis.");
      }
    }
    let savedQuizHistory = await getLocalQuizAttempts(id);
    if (authToken && !profile.isGuest) {
      try {
        const response = await request(`${API_URL}/api/me/quizzes`, {
          headers: { Authorization: `Bearer ${authToken}` },
        });
        if (response.ok) {
          const remoteAttempts = await response.json() as QuizAttempt[];
          savedQuizHistory = remoteAttempts.map((attempt) => ({ ...attempt, id: -attempt.id }));
        }
      } catch {
        setConnectionError("Não foi possível atualizar suas pontuações. Os resultados deste aparelho continuam disponíveis.");
      }
    }
    setProgress(savedProgress);
    setHistory(savedHistory);
    setQuizHistory(savedQuizHistory);
  }

  async function loadRemoteKanjis(authToken: string) {
    const response = await request(`${API_URL}/api/kanjis`, { headers: { Authorization: `Bearer ${authToken}` } });
    if (!response.ok) return;
    const remoteKanjis = await response.json() as Kanji[];
    await cacheRemoteKanjis(remoteKanjis.map((kanji) => ({ ...kanji, serverId: kanji.id })));
    const catalog = await getLocalKanjis();
    if (catalog.length) setKanjis(catalog);
  }

  async function authenticate(email: string, password: string, mode: "login" | "register") {
    setConnectionError("");
    if (!API_URL) throw new Error(API_CONFIGURATION_ERROR);
    let response: Response;
    try {
      response = await request(`${API_URL}/api/auth/${mode}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
    } catch {
      throw new Error("Não conseguimos entrar agora. Verifique sua conexão ou continue estudando offline.");
    }
    const data = await response.json() as { token?: string; user?: User; message?: string };
    if (!response.ok || !data.token || !data.user) throw new Error(data.message ?? "Não foi possível entrar.");
    await SecureStore.setItemAsync(TOKEN_KEY, data.token);
    await Storage.setItem(PROFILE_KEY, JSON.stringify(data.user));
    setToken(data.token);
    setUser(data.user);
    await loadRemoteKanjis(data.token);
    await loadProfileData(data.user, data.token);
    setScreen("home");
  }

  async function continueOffline() {
    const guest: User = { id: 0, email: "estudante@offline.local", isGuest: true };
    setConnectionError("");
    await Storage.setItem(PROFILE_KEY, JSON.stringify(guest));
    setUser(guest);
    setToken(null);
    await loadProfileData(guest);
    setScreen("home");
  }

  async function logout() {
    await SecureStore.deleteItemAsync(TOKEN_KEY);
    await Storage.removeItem(PROFILE_KEY);
    setToken(null);
    setUser(null);
    setProgress([]);
    setHistory([]);
    setQuizHistory([]);
    setScreen("login");
  }

  function openKanji(kanji: Kanji) {
    setSelectedKanji(kanji);
    setPreviousScreen(screen === "detail" || screen === "camera" ? previousScreen : screen);
    setScreen("detail");
  }

  async function updateProgress(kanjiId: number, changes: Partial<KanjiProgress>, rating?: number) {
    if (!user) return;
    const previous = progress.find((item) => item.kanjiId === kanjiId) ?? emptyProgress(kanjiId);
    const updated = { ...previous, ...changes, kanjiId };
    await saveLocalProgress(profileId(user), updated, rating);
    setProgress((current) => [...current.filter((item) => item.kanjiId !== kanjiId), updated]);
    setHistory(await getLocalReviewHistory(profileId(user)));

    if (token && !user.isGuest) {
      const kanji = kanjis.find((item) => item.id === kanjiId);
      if (kanji?.serverId) {
        try {
          const response = await request(`${API_URL}/api/me/kanjis/${kanji.serverId}`, {
            method: "PUT",
            headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
            body: JSON.stringify({ ...updated, rating }),
          });
          if (!response.ok) throw new Error("Falha ao sincronizar progresso.");
        } catch {
          setConnectionError("Seu progresso está salvo neste aparelho e será atualizado quando a conexão voltar.");
        }
      }
    }
  }

  async function reviewKanji(kanjiId: number, rating: number) {
    const previous = progress.find((item) => item.kanjiId === kanjiId) ?? emptyProgress(kanjiId);
    const schedule = getReviewSchedule(previous, rating);
    await updateProgress(kanjiId, schedule, rating);
  }

  async function completeQuiz(correctAnswers: number, totalQuestions: number) {
    if (!user) return;
    const attempt = await saveLocalQuizAttempt(profileId(user), correctAnswers, totalQuestions);
    setQuizHistory((current) => [attempt, ...current]);
    if (token && !user.isGuest) {
      try {
        const response = await request(`${API_URL}/api/me/quizzes`, {
          method: "POST",
          headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
          body: JSON.stringify({ correctAnswers, totalQuestions }),
        });
        if (!response.ok) throw new Error("Falha ao sincronizar resultado do quiz.");
      } catch {
        setConnectionError("Sua pontuação está salva neste aparelho e será atualizada quando a conexão voltar.");
      }
    }
  }

  if (loading || screen === "splash") return <SplashScreen />;
  if (screen === "onboarding") return <OnboardingScreen index={onboardingIndex}
    onSkip={() => setScreen("login")}
    onNext={() => onboardingIndex === 2 ? setScreen("login") : setOnboardingIndex(onboardingIndex + 1)} />;
  if (screen === "login") return <AuthScreen onAuthenticate={authenticate} onGuest={continueOffline} />;
  if (!user) return <AuthScreen onAuthenticate={authenticate} onGuest={continueOffline} />;
  if (screen === "camera") return <CameraScreen kanjis={kanjis} onBack={() => setScreen(previousScreen)} onRecognized={openKanji} />;

  return <SafeAreaView style={styles.app}>
    {connectionError ? <Text style={styles.connectionError}>{connectionError}</Text> : null}
    {screen === "home" && <HomeScreen user={user} kanjis={kanjis} progress={progress} history={history} quizHistory={quizHistory} onOpen={openKanji} onNavigate={setScreen} />}
    {screen === "search" && <SearchScreen kanjis={kanjis} progress={progress} onOpen={openKanji} onCamera={() => { setPreviousScreen("search"); setScreen("camera"); }} />}
    {screen === "study" && <StudyScreen kanjis={kanjis} progress={progress} onReview={reviewKanji} onQuizComplete={(correct, total) => void completeQuiz(correct, total)} onOpen={openKanji} />}
    {screen === "progress" && <ProgressScreen kanjis={kanjis} progress={progress} history={history} quizHistory={quizHistory} onOpen={openKanji} />}
    {screen === "profile" && <ProfileScreen user={user} onLogout={logout} />}
    {screen === "detail" && <DetailScreen kanji={selectedKanji}
      progress={progress.find((item) => item.kanjiId === selectedKanji.id)}
      onBack={() => setScreen(previousScreen)} onStudy={() => setScreen("study")}
      onSetStatus={(status: KnowledgeStatus) => void updateProgress(selectedKanji.id, { status })}
      onToggleFavorite={() => {
        const current = progress.find((item) => item.kanjiId === selectedKanji.id) ?? emptyProgress(selectedKanji.id);
        void updateProgress(selectedKanji.id, { favorite: !current.favorite });
      }} />}
    {screen !== "detail" && <BottomNav screen={screen} onNavigate={setScreen} />}
  </SafeAreaView>;
}

const styles = StyleSheet.create({
  app: { backgroundColor: colors.bg, flex: 1 },
  connectionError: { backgroundColor: "#FFF0F0", color: colors.error, fontSize: 13, padding: 9, textAlign: "center" },
});