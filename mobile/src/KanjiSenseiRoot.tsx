import { useEffect, useState } from "react";
import { ActivityIndicator, Alert, AppState, SafeAreaView, StyleSheet, Text } from "react-native";
import * as Notifications from "expo-notifications";
import * as SecureStore from "expo-secure-store";
import Storage from "expo-sqlite/kv-store";
import { featuredKanjis } from "./data";
import { colors } from "./theme";
import { DailyGoal, Kanji, KanjiProgress, KnowledgeStatus, QuizAttempt, ReviewHistoryItem, Screen, StudyList, User } from "./types";
import {
  cacheRemoteKanjis,
  cacheRemoteCatalog,
  emptyProgress,
  getLocalKanjis,
  getLocalProgress,
  getLocalGoal,
  getLocalStudyLists,
  getLocalQuizAttempts,
  getLocalReviewHistory,
  getPendingSyncOperations,
  getReviewSchedule,
  clearLocalStudyData,
  deleteCachedKanji,
  enqueueSyncOperation,
  initializeLocalStore,
  removePendingSyncOperation,
  replaceLocalStudyLists,
  restoreLocalBackup,
  saveLocalQuizAttempt,
  saveLocalGoal,
  saveLocalStudyList,
  deleteLocalStudyList,
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
import AdminScreen from "./screens/AdminScreen";
import { exportStudyBackup, selectStudyBackup } from "./backupService";
import { requestReviewNotifications, scheduleReviewNotification } from "./notifications";

const API_URL = (process.env.EXPO_PUBLIC_API_URL ?? "").replace(/\/$/, "");
const API_CONFIGURATION_ERROR = "Não foi possível entrar agora. Verifique sua conexão e tente novamente, ou continue seus estudos offline.";
const TOKEN_KEY = "kanjisensei.auth.token";
const PROFILE_KEY = "kanjisensei.local.profile";
const NOTIFICATIONS_KEY = "kanjisensei.notifications.enabled";
const CATALOG_SYNC_KEY = "kanjisensei.catalog.lastSync";

function createSyncId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

type AdminUser = { id: number; email: string; role: "USER" | "ADMIN" };

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
  const [studyLists, setStudyLists] = useState<StudyList[]>([]);
  const [goal, setGoal] = useState<DailyGoal>({ target: 10, unit: "KANJIS", progress: 0 });
  const [notificationsEnabled, setNotificationsEnabled] = useState(false);
  const [adminUsers, setAdminUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [connectionError, setConnectionError] = useState("");
  const [catalogSyncing, setCatalogSyncing] = useState(false);
  const [catalogSyncError, setCatalogSyncError] = useState("");
  const [catalogSyncedAt, setCatalogSyncedAt] = useState<string | null>(null);

  useEffect(() => { void restoreApp(); }, []);
  useEffect(() => {
    const subscription = Notifications.addNotificationResponseReceivedListener(() => {
      setScreen("study");
    });
    return () => subscription.remove();
  }, []);
  useEffect(() => {
    if (!notificationsEnabled || !user) return;
    void scheduleReviewNotification(progress).catch((error: unknown) => {
      setConnectionError(error instanceof Error ? error.message : "Não foi possível agendar a notificação de revisão.");
    });
  }, [notificationsEnabled, progress, user]);
  useEffect(() => {
    if (!token || !user || user.isGuest) return;
    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "active") {
        void loadRemoteKanjis(token)
          .then(() => syncPendingChanges(user, token))
          .catch((error: unknown) => setConnectionError(error instanceof Error ? error.message : "Não foi possível atualizar o catálogo."));
      }
    });
    return () => subscription.remove();
  }, [token, user]);
  useEffect(() => {
    if (screen !== "admin" || user?.role !== "ADMIN" || !token) return;
    void loadAdminUsers().catch((error: unknown) =>
      setConnectionError(error instanceof Error ? error.message : "Não foi possível carregar os usuários."));
  }, [screen, token, user]);

  async function restoreApp() {
    try {
      await initializeLocalStore();
      const catalog = await getLocalKanjis();
      if (catalog.length) setKanjis(catalog);

      const [savedToken, savedProfile, savedNotifications] = await Promise.all([
        SecureStore.getItemAsync(TOKEN_KEY),
        Storage.getItem(PROFILE_KEY),
        Storage.getItem(NOTIFICATIONS_KEY),
      ]);
      setCatalogSyncedAt(await Storage.getItem(CATALOG_SYNC_KEY));
      setNotificationsEnabled(savedNotifications === "true");
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
        } catch {
          setConnectionError("Não foi possível atualizar seus estudos. O que já está salvo neste aparelho permanece disponível.");
        }
      }

      if (restoredUser) {
        setUser(restoredUser);
        try {
          await loadRemoteKanjis(activeToken ?? undefined);
        } catch (error) {
          setCatalogSyncError(error instanceof Error ? error.message : "Não foi possível baixar o catálogo.");
        }
        if (activeToken && !restoredUser.isGuest) {
          await syncPendingChanges(restoredUser, activeToken);
        }
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
    let savedLists = await getLocalStudyLists(id);
    let savedGoal = await getLocalGoal(id);
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
    if (authToken && !profile.isGuest) {
      try {
        const [listsResponse, goalResponse] = await Promise.all([
          request(`${API_URL}/api/me/study-lists`, { headers: { Authorization: "Bearer " + authToken } }),
          request(`${API_URL}/api/me/goal`, { headers: { Authorization: "Bearer " + authToken } }),
        ]);
        if (!listsResponse.ok || !goalResponse.ok) throw new Error("Falha ao carregar personalizações da conta.");
        const remoteLists = await listsResponse.json() as StudyList[];
        const remoteGoal = await goalResponse.json() as DailyGoal;
        const catalog = await getLocalKanjis();
        await replaceLocalStudyLists(id, remoteLists.map((list) => ({
          ...list,
          characters: list.characters.filter((character) => catalog.some((kanji) => kanji.character === character)),
        })));
        savedLists = await getLocalStudyLists(id);
        await saveLocalGoal(id, remoteGoal);
        savedGoal = remoteGoal;
      } catch {
        setConnectionError("Não foi possível atualizar suas listas e metas. Os dados salvos neste aparelho continuam disponíveis.");
      }
    }
    setProgress(savedProgress);
    setHistory(savedHistory);
    setQuizHistory(savedQuizHistory);
    setStudyLists(savedLists);
    setGoal(savedGoal);
  }

  async function loadRemoteKanjis(authToken?: string): Promise<Kanji[]> {
    const response = await request(`${API_URL}/api/kanjis`, { headers: { Authorization: `Bearer ${authToken}` } });
    if (!response.ok) throw new Error(`O servidor não enviou o catálogo (HTTP ${response.status}).`);
    const data = await response.json() as unknown;
    if (!Array.isArray(data) || data.length === 0 || !data.every((kanji): kanji is Kanji =>
      kanji !== null && typeof kanji === "object" &&
      "id" in kanji && Number.isSafeInteger(kanji.id) &&
      "character" in kanji && typeof kanji.character === "string" &&
      "meaning" in kanji && typeof kanji.meaning === "string" &&
      "jlpt" in kanji && (kanji.jlpt === null || typeof kanji.jlpt === "string"))) {
      throw new Error("O servidor retornou um catálogo vazio ou inválido; a cópia local foi mantida.");
    }
    const remoteKanjis = data;
    await cacheRemoteCatalog(remoteKanjis.map((kanji) => ({ ...kanji, serverId: kanji.id })));
    const catalog = await getLocalKanjis();
    if (catalog.length < remoteKanjis.length) {
      throw new Error("Nem todos os kanjis foram salvos no aparelho; tente atualizar novamente.");
    }
    setKanjis(catalog);
    const syncedAt = new Date().toISOString();
    await Storage.setItem(CATALOG_SYNC_KEY, syncedAt);
    setCatalogSyncedAt(syncedAt);
    setCatalogSyncError("");
    return catalog;
  }

  async function refreshCatalog() {
    if (catalogSyncing) return;
    setCatalogSyncing(true);
    setCatalogSyncError("");
    try {
      await loadRemoteKanjis(token ?? undefined);
    } catch (error) {
      setCatalogSyncError(error instanceof Error ? error.message : "Não foi possível atualizar o catálogo.");
    } finally {
      setCatalogSyncing(false);
    }
  }

  async function syncPendingChanges(profile: User, authToken: string) {
    if (profile.isGuest) return;
    const queue = await getPendingSyncOperations(profileId(profile));
    const catalog = await getLocalKanjis();
    for (const operation of queue) {
      let payload: unknown;
      try {
        payload = JSON.parse(operation.payload) as unknown;
      } catch {
        setConnectionError("Uma alteração offline está inválida e não foi sincronizada.");
        return;
      }
      if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
        setConnectionError("Uma alteração offline está inválida e não foi sincronizada.");
        return;
      }
      const data = payload as Record<string, unknown>;
      try {
        let response: Response;
        if (operation.operation === "progress") {
          if (typeof data.kanjiId !== "number" || !data.progress || typeof data.progress !== "object") {
            setConnectionError("Uma alteração de progresso offline está inválida.");
            return;
          }
          const kanji = catalog.find((item) => item.id === data.kanjiId);
          if (!kanji?.serverId) {
            setConnectionError("O catálogo ainda não foi sincronizado; suas alterações permanecem salvas neste aparelho.");
            return;
          }
          response = await request(`${API_URL}/api/me/kanjis/${kanji.serverId}`, {
            method: "PUT",
            headers: { Authorization: "Bearer " + authToken, "Content-Type": "application/json" },
            body: JSON.stringify({ ...(data.progress as KanjiProgress), rating: data.rating, requestId: data.requestId }),
          });
        } else if (operation.operation === "quiz") {
          response = await request(`${API_URL}/api/me/quizzes`, {
            method: "POST",
            headers: { Authorization: "Bearer " + authToken, "Content-Type": "application/json" },
            body: operation.payload,
          });
        } else if (operation.operation === "study-list-save" && data.list) {
          const list = data.list as StudyList;
          response = await request(`${API_URL}/api/me/study-lists/${encodeURIComponent(list.clientId)}`, {
            method: "PUT",
            headers: { Authorization: "Bearer " + authToken, "Content-Type": "application/json" },
            body: JSON.stringify(list),
          });
        } else if (operation.operation === "study-list-delete" && typeof data.clientId === "string") {
          response = await request(`${API_URL}/api/me/study-lists/${encodeURIComponent(data.clientId)}`, {
            method: "DELETE",
            headers: { Authorization: "Bearer " + authToken },
          });
        } else if (operation.operation === "goal") {
          response = await request(`${API_URL}/api/me/goal`, {
            method: "PUT",
            headers: { Authorization: "Bearer " + authToken, "Content-Type": "application/json" },
            body: JSON.stringify(data),
          });
        } else {
          setConnectionError("Uma alteração offline não pôde ser reconhecida.");
          return;
        }
        if (!response.ok) {
          setConnectionError(`A sincronização foi interrompida (HTTP ${response.status}); suas alterações permanecem salvas neste aparelho.`);
          return;
        }
        await removePendingSyncOperation(operation.id);
      } catch {
        setConnectionError("Sem conexão para sincronizar. Suas alterações permanecem salvas e serão reenviadas quando a rede voltar.");
        return;
      }
    }
    setConnectionError("");
    await loadProfileData(profile, authToken);
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
    try {
      await loadRemoteKanjis(data.token);
    } catch (error) {
      setCatalogSyncError(error instanceof Error ? error.message : "Não foi possível atualizar o catálogo.");
    }
    await syncPendingChanges(data.user, data.token);
    await loadProfileData(data.user, data.token);
    setScreen("home");
  }

  async function continueOffline() {
    const guest: User = { id: 0, email: "estudante@offline.local", isGuest: true };
    setConnectionError("");
    await Storage.setItem(PROFILE_KEY, JSON.stringify(guest));
    setUser(guest);
    setToken(null);
    await refreshCatalog();
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
    setStudyLists([]);
    setGoal({ target: 10, unit: "KANJIS", progress: 0 });
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
    setGoal(await getLocalGoal(profileId(user)));

    if (token && !user.isGuest) {
      const requestId = createSyncId();
      await enqueueSyncOperation(profileId(user), requestId, "progress", { kanjiId, progress: updated, rating, requestId });
      void syncPendingChanges(user, token).catch((error: unknown) =>
        setConnectionError(error instanceof Error ? error.message : "Não foi possível sincronizar o progresso."));
    }
  }

  async function reviewKanji(kanjiId: number, rating: number) {
    const previous = progress.find((item) => item.kanjiId === kanjiId) ?? emptyProgress(kanjiId);
    const schedule = getReviewSchedule(previous, rating);
    await updateProgress(kanjiId, schedule, rating);
  }

  async function completeQuiz(correctAnswers: number, totalQuestions: number) {
    if (!user) return;
    const requestId = createSyncId();
    const attempt = await saveLocalQuizAttempt(profileId(user), correctAnswers, totalQuestions, requestId);
    setQuizHistory((current) => [attempt, ...current]);
    setGoal(await getLocalGoal(profileId(user)));
    if (token && !user.isGuest) {
      await enqueueSyncOperation(profileId(user), requestId, "quiz", { correctAnswers, totalQuestions, requestId });
      void syncPendingChanges(user, token).catch((error: unknown) =>
        setConnectionError(error instanceof Error ? error.message : "Não foi possível sincronizar o resultado do quiz."));
    }
  }

  async function saveGoal(nextGoal: Pick<DailyGoal, "target" | "unit">) {
    if (!user) return;
    await saveLocalGoal(profileId(user), nextGoal);
    setGoal(await getLocalGoal(profileId(user)));
    if (token && !user.isGuest) {
      const requestId = createSyncId();
      await enqueueSyncOperation(profileId(user), requestId, "goal", nextGoal);
      void syncPendingChanges(user, token).catch((error: unknown) =>
        setConnectionError(error instanceof Error ? error.message : "Não foi possível sincronizar a meta."));
    }
  }

  async function saveStudyList(name: string, characters: string[], clientId = createSyncId()) {
    if (!user) return;
    const list = { clientId, name, characters: [...new Set(characters)] };
    await saveLocalStudyList(profileId(user), list);
    setStudyLists(await getLocalStudyLists(profileId(user)));
    if (token && !user.isGuest) {
      await enqueueSyncOperation(profileId(user), createSyncId(), "study-list-save", { list });
      void syncPendingChanges(user, token).catch((error: unknown) =>
        setConnectionError(error instanceof Error ? error.message : "Não foi possível sincronizar a lista."));
    }
  }

  async function toggleKanjiInList(clientId: string, character: string) {
    const list = studyLists.find((item) => item.clientId === clientId);
    if (!list) return;
    const characters = list.characters.includes(character)
      ? list.characters.filter((item) => item !== character)
      : [...list.characters, character];
    await saveStudyList(list.name, characters, clientId);
  }

  async function removeStudyList(clientId: string) {
    if (!user) return;
    await deleteLocalStudyList(profileId(user), clientId);
    setStudyLists(await getLocalStudyLists(profileId(user)));
    if (token && !user.isGuest) {
      await enqueueSyncOperation(profileId(user), createSyncId(), "study-list-delete", { clientId });
      void syncPendingChanges(user, token).catch((error: unknown) =>
        setConnectionError(error instanceof Error ? error.message : "Não foi possível sincronizar a remoção da lista."));
    }
  }

  async function toggleReviewNotifications() {
    if (notificationsEnabled) {
      await Notifications.cancelAllScheduledNotificationsAsync();
      await Storage.setItem(NOTIFICATIONS_KEY, "false");
      setNotificationsEnabled(false);
      return;
    }
    if (!(await requestReviewNotifications())) {
      Alert.alert("Permissão necessária", "Ative as notificações do KanjiSensei nas configurações do aparelho.");
      return;
    }
    await Storage.setItem(NOTIFICATIONS_KEY, "true");
    setNotificationsEnabled(true);
    await scheduleReviewNotification(progress);
  }

  async function exportBackup() {
    if (!user) return;
    const owner = user.isGuest ? "guest" : user.email;
    try {
      await exportStudyBackup(profileId(user), owner);
    } catch (error) {
      Alert.alert("Falha ao exportar backup", error instanceof Error ? error.message : "Não foi possível exportar seus dados.");
    }
  }

  async function restoreBackup() {
    if (!user) return;
    try {
      const backup = await selectStudyBackup();
      if (!backup) return;
      const owner = user.isGuest ? "guest" : user.email;
      await restoreLocalBackup(profileId(user), owner, backup);
      await loadProfileData(user);
      Alert.alert("Backup restaurado", "Os dados deste perfil foram restaurados.");
    } catch (error) {
      Alert.alert("Falha ao restaurar backup", error instanceof Error ? error.message : "Não foi possível restaurar o arquivo.");
    }
  }

  async function createServerBackup() {
    if (!token || !user) return;
    try {
      await syncPendingChanges(user, token);
      if ((await getPendingSyncOperations(profileId(user))).length) {
        throw new Error("Conecte-se para sincronizar as alterações offline antes do backup.");
      }
      const response = await request(`${API_URL}/api/me/backups`, {
        method: "POST",
        headers: { Authorization: "Bearer " + token },
      });
      if (!response.ok) throw new Error(`O servidor recusou o backup (HTTP ${response.status}).`);
      Alert.alert("Backup criado", "O backup seguro da sua conta foi armazenado.");
    } catch (error) {
      Alert.alert("Falha ao criar backup", error instanceof Error ? error.message : "Não foi possível criar o backup.");
    }
  }

  async function restoreServerBackup() {
    if (!token || !user) return;
    try {
      const response = await request(`${API_URL}/api/me/backups`, {
        headers: { Authorization: "Bearer " + token },
      });
      if (!response.ok) throw new Error(`Não foi possível consultar os backups (HTTP ${response.status}).`);
      const backups = await response.json() as Array<{ id: number; createdAt: string }>;
      const latest = backups[0];
      if (!latest) {
        Alert.alert("Nenhum backup", "Crie um backup da conta antes de restaurar.");
        return;
      }
      Alert.alert("Restaurar backup", `Substituir seus dados pelo backup de ${new Date(latest.createdAt).toLocaleString("pt-BR")}?`, [
        { text: "Cancelar", style: "cancel" },
        { text: "Restaurar", style: "destructive", onPress: () => {
          void (async () => {
            const restoreResponse = await request(`${API_URL}/api/me/backups/${latest.id}/restore`, {
              method: "POST",
              headers: { Authorization: "Bearer " + token },
            });
            if (!restoreResponse.ok) throw new Error(`A restauração falhou (HTTP ${restoreResponse.status}).`);
            await clearLocalStudyData(profileId(user));
            await loadRemoteKanjis(token);
            await loadProfileData(user);
            Alert.alert("Backup restaurado", "Os dados da conta foram restaurados.");
          })().catch((error: unknown) => Alert.alert("Falha ao restaurar backup", error instanceof Error ? error.message : "Não foi possível restaurar."));
        } },
      ]);
    } catch (error) {
      Alert.alert("Falha ao restaurar backup", error instanceof Error ? error.message : "Não foi possível consultar os backups.");
    }
  }

  async function loadAdminUsers() {
    if (!token || user?.role !== "ADMIN") return;
    const response = await request(`${API_URL}/api/admin/users`, {
      headers: { Authorization: "Bearer " + token },
    });
    if (!response.ok) throw new Error(`Não foi possível carregar usuários (HTTP ${response.status}).`);
    setAdminUsers(await response.json() as AdminUser[]);
  }

  async function updateAdminRole(target: AdminUser) {
    if (!token || user?.role !== "ADMIN") throw new Error("Acesso restrito a administradores.");
    const response = await request(`${API_URL}/api/admin/users/${target.id}/role`, {
      method: "PUT",
      headers: { Authorization: "Bearer " + token, "Content-Type": "application/json" },
      body: JSON.stringify({ role: target.role }),
    });
    if (!response.ok) {
      const data = await response.json() as { message?: string };
      throw new Error(data.message ?? `Não foi possível alterar a permissão (HTTP ${response.status}).`);
    }
    const updatedUser = await response.json() as AdminUser;
    setAdminUsers((current) => current.map((item) => item.id === updatedUser.id ? updatedUser : item));
  }

  async function saveAdminKanji(kanji: Omit<Kanji, "id">, localId?: number) {
    if (!token || user?.role !== "ADMIN") throw new Error("Acesso restrito a administradores.");
    const existing = localId === undefined ? undefined : kanjis.find((item) => item.id === localId);
    const serverId = existing?.serverId ?? (existing ? existing.id : undefined);
    const response = await request(
      serverId ? `${API_URL}/api/admin/kanjis/${serverId}` : `${API_URL}/api/admin/kanjis`,
      {
        method: serverId ? "PUT" : "POST",
        headers: { Authorization: "Bearer " + token, "Content-Type": "application/json" },
        body: JSON.stringify(kanji),
      },
    );
    if (!response.ok) {
      const data = await response.json() as { message?: string };
      throw new Error(data.message ?? `Não foi possível salvar (HTTP ${response.status}).`);
    }
    const saved = await response.json() as Kanji;
    await cacheRemoteKanjis([{ ...saved, serverId: saved.id }]);
    setKanjis(await getLocalKanjis());
  }

  async function deleteAdminKanji(localId: number) {
    if (!token || user?.role !== "ADMIN") throw new Error("Acesso restrito a administradores.");
    const kanji = kanjis.find((item) => item.id === localId);
    if (!kanji) throw new Error("Kanji não encontrado no catálogo local.");
    const serverId = kanji.serverId ?? kanji.id;
    const response = await request(`${API_URL}/api/admin/kanjis/${serverId}`, {
      method: "DELETE",
      headers: { Authorization: "Bearer " + token },
    });
    if (!response.ok) throw new Error(`Não foi possível remover o kanji (HTTP ${response.status}).`);
    await deleteCachedKanji(serverId);
    setKanjis(await getLocalKanjis());
  }

  if (loading || screen === "splash") return <SplashScreen />;
  if (screen === "onboarding") return <OnboardingScreen index={onboardingIndex}
    onSkip={() => setScreen("login")}
    onNext={() => onboardingIndex === 2 ? setScreen("login") : setOnboardingIndex(onboardingIndex + 1)} />;
  if (screen === "login") return <AuthScreen onAuthenticate={authenticate} onGuest={continueOffline} />;
  if (!user) return <AuthScreen onAuthenticate={authenticate} onGuest={continueOffline} />;
  if (screen === "admin") {
    return user.role === "ADMIN"
      ? <SafeAreaView style={styles.app}><AdminScreen kanjis={kanjis} users={adminUsers} onSave={saveAdminKanji} onDelete={deleteAdminKanji} onUpdateRole={updateAdminRole} onBack={() => setScreen("profile")} /></SafeAreaView>
      : <SafeAreaView style={styles.app}><Text style={styles.connectionError}>Acesso restrito a administradores.</Text></SafeAreaView>;
  }
  if (screen === "camera") return <CameraScreen kanjis={kanjis} onBack={() => setScreen(previousScreen)} onRecognized={openKanji} />;

  return <SafeAreaView style={styles.app}>
    {connectionError ? <Text style={styles.connectionError}>{connectionError}</Text> : null}
    {screen === "home" && <HomeScreen user={user} kanjis={kanjis} progress={progress} history={history} quizHistory={quizHistory} goal={goal} onSetGoal={(value) => void saveGoal(value)} onOpen={openKanji} onNavigate={setScreen} />}
    {screen === "search" && <SearchScreen kanjis={kanjis} progress={progress} onOpen={openKanji} onCamera={() => { setPreviousScreen("search"); setScreen("camera"); }} />}
    {screen === "study" && <StudyScreen kanjis={kanjis} progress={progress} lists={studyLists} goal={goal} onReview={reviewKanji} onQuizComplete={(correct, total) => void completeQuiz(correct, total)} onOpen={openKanji} onCreateList={(name, characters) => void saveStudyList(name, characters)} onDeleteList={(clientId) => void removeStudyList(clientId)} onSetGoal={(value) => void saveGoal(value)} />}
    {screen === "progress" && <ProgressScreen kanjis={kanjis} progress={progress} history={history} quizHistory={quizHistory} onOpen={openKanji} />}
    {screen === "profile" && <ProfileScreen user={user} notificationsEnabled={notificationsEnabled} catalogCount={kanjis.length} catalogSyncing={catalogSyncing} catalogSyncError={catalogSyncError} catalogSyncedAt={catalogSyncedAt} onRefreshCatalog={() => void refreshCatalog()} onToggleNotifications={() => void toggleReviewNotifications()} onExportBackup={() => void exportBackup()} onRestoreBackup={() => void restoreBackup()} onServerBackup={() => void createServerBackup()} onServerRestore={() => void restoreServerBackup()} onOpenAdmin={() => setScreen("admin")} onLogout={logout} />}
    {screen === "detail" && <DetailScreen kanji={selectedKanji}
      progress={progress.find((item) => item.kanjiId === selectedKanji.id)}
      lists={studyLists}
      onBack={() => setScreen(previousScreen)} onStudy={() => setScreen("study")}
      onSetStatus={(status: KnowledgeStatus) => void updateProgress(selectedKanji.id, { status })}
      onToggleDifficult={() => {
        const current = progress.find((item) => item.kanjiId === selectedKanji.id) ?? emptyProgress(selectedKanji.id);
        void updateProgress(selectedKanji.id, { difficult: !current.difficult });
      }}
      onToggleStudyList={(clientId, character) => void toggleKanjiInList(clientId, character)}
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