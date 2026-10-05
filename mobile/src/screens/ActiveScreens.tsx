import { useRef, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { CameraView, useCameraPermissions } from "expo-camera";
import Svg, { Path } from "react-native-svg";
import TextRecognition, { TextRecognitionScript } from "@react-native-ml-kit/text-recognition";
import { toRomaji } from "wanakana";
import { Kanji, KanjiProgress, KnowledgeStatus, QuizAttempt, ReviewHistoryItem, Screen, User } from "../types";
import { colors, jlptColors } from "../theme";
import { KanjiRow, ProgressBar, ScreenTitle, SectionHeader } from "../components/UI";
import { strokeData } from "../strokeData";
import { extractCatalogKanjisFromOcr, getOcrErrorMessage } from "../ocr/kanjiRecognition";

const levels = ["Todos", "N5", "N4", "N3", "N2", "N1"];
type RecentActivity = { key: string; title: string; detail: string; date: string; kanji?: Kanji };

export function HomeScreen({ user, kanjis, progress, history, quizHistory, onOpen, onNavigate }: {
  user: User;
  kanjis: Kanji[];
  progress: KanjiProgress[];
  history: ReviewHistoryItem[];
  quizHistory: QuizAttempt[];
  onOpen: (kanji: Kanji) => void;
  onNavigate: (screen: Screen) => void;
}) {
  const learned = progress.filter((item) => item.status === "learned").length;
  const today = new Date().toISOString().slice(0, 10);
  const due = progress.filter((item) => item.dueAt && item.dueAt.slice(0, 10) <= today).length;
  const daily = kanjis[new Date().getDate() % Math.max(kanjis.length, 1)];
  const recentActivities: RecentActivity[] = [
    ...history.map((item) => {
      const kanji = kanjis.find((value) => value.id === item.kanjiId);
      return {
        key: `review-${item.id}`,
        title: kanji ? `Revisou ${kanji.character}` : "Revisão de kanji",
        detail: `Nota ${item.rating} / 5`,
        date: item.reviewedAt,
        kanji,
      };
    }),
    ...quizHistory.map((item) => ({
      key: `quiz-${item.id}`,
      title: "Quiz de significados",
      detail: `${item.correctAnswers} / ${item.totalQuestions} acertos`,
      date: item.completedAt,
    })),
  ].sort((left, right) => right.date.localeCompare(left.date)).slice(0, 4);

  return <ScrollView contentContainerStyle={styles.scroll}>
    <Text style={styles.eyebrow}>KANJISENSEI · {user.isGuest ? "MODO OFFLINE" : "ESTUDO"}</Text>
    <Text style={styles.greeting}>Olá, {user.isGuest ? "estudante" : user.email.split("@")[0]}</Text>
    <ScreenTitle>Continue seus estudos</ScreenTitle>
    {daily ? <Pressable onPress={() => onOpen(daily)} style={styles.dayCard}>
      <Text style={styles.cardEyebrow}>KANJI DO DIA</Text><Text style={styles.dayKanji}>{daily.character}</Text>
      <Text style={styles.dayReading}>{daily.onyomi || ""} {daily.kunyomi ? `/ ${daily.kunyomi}` : ""}</Text>
      <Text style={styles.dayMeaning}>{daily.meaning}</Text><Text style={styles.dayLink}>Ver detalhes</Text>
    </Pressable> : null}
    <View style={styles.columns}>
      <ActionCard title="Revisões pendentes" value={`${due} kanjis`} action="Estudar" onPress={() => onNavigate("study")} />
      <ActionCard title="Aprendidos" value={`${learned} de ${kanjis.length}`} action="Progresso" onPress={() => onNavigate("progress")} />
    </View>
    <SectionHeader title="Seu progresso" action="Ver tudo" onPress={() => onNavigate("progress")} />
    <View style={styles.card}>
      <Text style={styles.progressNumber}>{learned} / {kanjis.length} kanjis dominados</Text>
      <ProgressBar value={kanjis.length ? learned / kanjis.length : 0} color={colors.primary} />
    </View>
    <SectionHeader title="Atividades recentes" action="Ver progresso" onPress={() => onNavigate("progress")} />
    {recentActivities.map((activity) => <Pressable key={activity.key}
      onPress={() => activity.kanji ? onOpen(activity.kanji) : onNavigate("progress")}
      style={styles.activityRow}>
      <View style={styles.activityCopy}><Text style={styles.cardTitle}>{activity.title}</Text><Text style={styles.body}>{activity.detail}</Text></View>
      <Text style={styles.activityDate}>{new Date(activity.date).toLocaleDateString("pt-BR")}</Text>
    </Pressable>)}
    {!recentActivities.length ? <Text style={styles.body}>Suas revisões e quizzes aparecerão aqui.</Text> : null}
    <SectionHeader title="Retomar estudo" action="Abrir flashcards" onPress={() => onNavigate("study")} />
    {kanjis.slice(0, 4).map((kanji) => <KanjiRow key={kanji.id} kanji={kanji} onPress={() => onOpen(kanji)} />)}
  </ScrollView>;
}

export function SearchScreen({ kanjis, progress, onOpen, onCamera }: {
  kanjis: Kanji[];
  progress: KanjiProgress[];
  onOpen: (kanji: Kanji) => void;
  onCamera: () => void;
}) {
  const [query, setQuery] = useState("");
  const [level, setLevel] = useState("Todos");
  const [favoritesOnly, setFavoritesOnly] = useState(false);
  const normalizedQuery = query.trim().toLocaleLowerCase();
  const results = kanjis.filter((kanji) => {
    const readings = `${kanji.onyomi ?? ""} ${kanji.kunyomi ?? ""}`;
    const matchesQuery = !normalizedQuery ||
      `${kanji.character} ${kanji.meaning} ${readings} ${toRomaji(readings)}`.toLocaleLowerCase().includes(normalizedQuery);
    const isFavorite = progress.some((item) => item.kanjiId === kanji.id && item.favorite);
    return matchesQuery && (level === "Todos" || kanji.jlpt === level) && (!favoritesOnly || isFavorite);
  });

  return <ScrollView contentContainerStyle={styles.scroll}>
    <ScreenTitle>Buscar kanjis</ScreenTitle>
    <TextInput accessibilityLabel="Buscar por kanji, leitura romaji ou significado" onChangeText={setQuery}
      placeholder="Kanji, leitura ou significado" placeholderTextColor={colors.secondaryText}
      style={styles.input} value={query} />
    <View style={styles.filterRow}>{levels.map((item) => <Pressable key={item} onPress={() => setLevel(item)}
      style={[styles.filter, level === item && styles.filterActive]}>
      <Text style={[styles.filterLabel, level === item && styles.filterLabelActive]}>{item}</Text>
    </Pressable>)}</View>
    <Pressable onPress={() => setFavoritesOnly((value) => !value)} style={[styles.filter, favoritesOnly && styles.filterActive, { alignSelf: "flex-start", marginTop: 10 }]}>
      <Text style={[styles.filterLabel, favoritesOnly && styles.filterLabelActive]}>★ Favoritos</Text>
    </Pressable>
    <Pressable onPress={onCamera} style={styles.cameraButton}><Text style={styles.primaryText}>Abrir câmera para reconhecer</Text></Pressable>
    <Text style={styles.section}>{results.length} resultados</Text>
    {results.map((kanji) => <KanjiRow key={kanji.id} kanji={kanji} onPress={() => onOpen(kanji)} />)}
    {results.length === 0 ? <Text style={styles.body}>Nenhum kanji encontrado.</Text> : null}
  </ScrollView>;
}

export function StudyScreen({ kanjis, progress, onReview, onQuizComplete, onOpen }: {
  kanjis: Kanji[];
  progress: KanjiProgress[];
  onReview: (kanjiId: number, rating: number) => void;
  onQuizComplete: (correctAnswers: number, totalQuestions: number) => void;
  onOpen: (kanji: Kanji) => void;
}) {
  const [mode, setMode] = useState<"menu" | "cards" | "quiz">("menu");
  const [index, setIndex] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const [answer, setAnswer] = useState<string | null>(null);
  const [score, setScore] = useState(0);
  const [quizFinished, setQuizFinished] = useState(false);
  const scheduled = new Map(progress.map((item) => [item.kanjiId, item]));
  const today = new Date().toISOString().slice(0, 10);
  const due = kanjis.filter((kanji) => {
    const dueAt = scheduled.get(kanji.id)?.dueAt;
    return !dueAt || dueAt.slice(0, 10) <= today;
  });
  const cards = due.length ? due : kanjis;
  const current = cards[index % Math.max(cards.length, 1)];
  const quizQuestionCount = Math.min(10, kanjis.length);
  const alternatives = current ? kanjis.filter((item) => item.id !== current.id) : [];
  const quizChoices = current ? [current, ...Array.from(
    { length: Math.min(3, alternatives.length) },
    (_, choiceIndex) => alternatives[(index * 3 + choiceIndex) % alternatives.length],
  )] : [];

  function start(nextMode: "cards" | "quiz") {
    setIndex(0); setScore(0); setAnswer(null); setQuizFinished(false); setRevealed(false); setMode(nextMode);
  }

  function nextCard(rating: number) {
    if (current) onReview(current.id, rating);
    setIndex((value) => value + 1);
    setRevealed(false);
  }

  if (mode === "menu") return <ScrollView contentContainerStyle={styles.scroll}>
    <ScreenTitle>Estudar</ScreenTitle><Text style={styles.body}>Escolha uma atividade. Seu histórico fica salvo neste aparelho.</Text>
    <Pressable onPress={() => start("cards")} style={styles.studyCard}><Text style={styles.cardTitle}>Flashcards · repetição espaçada</Text><Text style={styles.body}>{due.length} para revisar hoje</Text></Pressable>
    <Pressable onPress={() => start("quiz")} style={styles.studyCard}><Text style={styles.cardTitle}>Quiz de significados</Text><Text style={styles.body}>Pontuação registrada no histórico local</Text></Pressable>
    <Pressable onPress={() => onOpen(kanjis[0])} style={styles.secondaryButton}><Text style={styles.link}>Consultar catálogo</Text></Pressable>
  </ScrollView>;

  if (!current) return <ScrollView contentContainerStyle={styles.scroll}><ScreenTitle>Estudar</ScreenTitle><Text style={styles.body}>O catálogo ainda não tem kanjis disponíveis.</Text></ScrollView>;

  if (mode === "cards") return <ScrollView contentContainerStyle={styles.scroll}>
    <Pressable onPress={() => setMode("menu")}><Text style={styles.link}>← Atividades</Text></Pressable>
    <Text style={styles.eyebrow}>FLASHCARD {index + 1} · {cards.length}</Text>
    <Pressable onPress={() => setRevealed(true)} style={styles.flashcard}>
      <Text style={styles.flashKanji}>{current.character}</Text>
      {revealed ? <><Text style={styles.reading}>{current.onyomi} · {current.kunyomi}</Text><Text style={styles.meaning}>{current.meaning}</Text></> : <Text style={styles.body}>Toque para revelar</Text>}
    </Pressable>
    {revealed ? <View style={styles.columns}>
      <Pressable onPress={() => nextCard(1)} style={styles.rateButton}><Text style={styles.rateLabel}>Não lembrei</Text></Pressable>
      <Pressable onPress={() => nextCard(4)} style={[styles.rateButton, styles.rateGood]}><Text style={styles.rateLabel}>Lembrei</Text></Pressable>
    </View> : null}
  </ScrollView>;

  if (quizFinished) return <ScrollView contentContainerStyle={styles.scroll}>
    <ScreenTitle>Quiz concluído</ScreenTitle>
    <Text style={styles.feedback}>{score} / {quizQuestionCount} acertos</Text>
    <Text style={styles.body}>Resultado salvo no seu histórico.</Text>
    <Pressable onPress={() => setMode("menu")} style={styles.cameraButton}><Text style={styles.primaryText}>Voltar às atividades</Text></Pressable>
  </ScrollView>;

  if (answer !== null) return <ScrollView contentContainerStyle={styles.scroll}>
    <ScreenTitle>{answer === current.meaning ? "Correto" : "Vamos revisar"}</ScreenTitle>
    <Text style={styles.feedback}>{current.character} · {current.meaning}</Text>
    <Text style={styles.body}>Pontuação: {score}</Text>
    <Pressable onPress={() => {
      if (index + 1 >= quizQuestionCount) {
        setQuizFinished(true);
        onQuizComplete(score, quizQuestionCount);
      } else {
        setIndex((value) => value + 1);
        setAnswer(null);
      }
    }} style={styles.cameraButton}><Text style={styles.primaryText}>{index + 1 >= quizQuestionCount ? "Finalizar quiz" : "Próxima pergunta"}</Text></Pressable>
  </ScrollView>;

  return <ScrollView contentContainerStyle={styles.scroll}>
    <Pressable onPress={() => setMode("menu")}><Text style={styles.link}>← Atividades</Text></Pressable>
    <Text style={styles.eyebrow}>QUIZ · {index + 1}</Text><Text style={styles.flashKanji}>{current.character}</Text>
    <Text style={styles.body}>Qual é o significado?</Text>
    {quizChoices.map((choice) => <Pressable key={choice.id} onPress={() => {
      const correct = choice.id === current.id;
      if (correct) setScore((value) => value + 1);
      onReview(current.id, correct ? 5 : 1);
      setAnswer(choice.meaning);
    }} style={styles.choice}><Text style={styles.choiceText}>{choice.meaning}</Text></Pressable>)}
  </ScrollView>;
}

export function ProgressScreen({ kanjis, progress, history, quizHistory, onOpen }: {
  kanjis: Kanji[];
  progress: KanjiProgress[];
  history: ReviewHistoryItem[];
  quizHistory: QuizAttempt[];
  onOpen: (kanji: Kanji) => void;
}) {
  const learned = progress.filter((item) => item.status === "learned").length;
  const learning = progress.filter((item) => item.status === "learning").length;
  const favorites = progress.filter((item) => item.favorite).length;
  return <ScrollView contentContainerStyle={styles.scroll}>
    <ScreenTitle>Progresso</ScreenTitle><Text style={styles.body}>Dados das suas revisões registradas neste aparelho.</Text>
    <View style={styles.columns}>{[[String(learned), "Aprendidos"], [String(learning), "Em aprendizado"], [String(favorites), "Favoritos"]].map(([value, label]) =>
      <View key={label} style={styles.statCard}><Text style={styles.statValue}>{value}</Text><Text style={styles.body}>{label}</Text></View>)}</View>
    <View style={styles.card}><Text style={styles.cardTitle}>Domínio por nível JLPT</Text>
      {levels.slice(1).map((level) => {
        const inLevel = kanjis.filter((kanji) => kanji.jlpt === level);
        const mastered = inLevel.filter((kanji) => progress.find((item) => item.kanjiId === kanji.id)?.status === "learned").length;
        return <View key={level} style={styles.level}><View style={styles.levelHeader}><Text style={[styles.jlpt, { color: jlptColors[level] }]}>{level}</Text><Text style={styles.body}>{mastered} / {inLevel.length}</Text></View>
          <ProgressBar value={inLevel.length ? mastered / inLevel.length : 0} color={jlptColors[level]} /></View>;
      })}
    </View>
    <SectionHeader title="Revisões recentes" />
    {history.slice(0, 20).map((item) => {
      const kanji = kanjis.find((value) => value.id === item.kanjiId);
      return kanji ? <KanjiRow key={item.id} kanji={kanji} onPress={() => onOpen(kanji)} /> : null;
    })}
    {!history.length ? <Text style={styles.body}>Suas revisões aparecerão aqui.</Text> : null}
    <SectionHeader title="Resultados dos quizzes" />
    {quizHistory.slice(0, 10).map((attempt) => <View key={attempt.id} style={styles.quizResult}>
      <Text style={styles.cardTitle}>{attempt.correctAnswers} / {attempt.totalQuestions} acertos</Text>
      <Text style={styles.body}>{new Date(attempt.completedAt).toLocaleDateString("pt-BR")}</Text>
    </View>)}
    {!quizHistory.length ? <Text style={styles.body}>Suas pontuações aparecerão aqui.</Text> : null}
  </ScrollView>;
}

export function ProfileScreen({ user, onLogout }: { user: User; onLogout: () => void }) {
  return <ScrollView contentContainerStyle={styles.scroll}>
    <View style={styles.profile}><View style={styles.avatar}><Text style={styles.avatarText}>{user.isGuest ? "漢" : user.email[0].toUpperCase()}</Text></View>
      <ScreenTitle>Seu perfil</ScreenTitle><Text style={styles.body}>{user.isGuest ? "Perfil local, sem conta" : user.email}</Text></View>
    <View style={styles.card}><Text style={styles.cardTitle}>Seus estudos</Text><Text style={styles.body}>{user.isGuest ? "Seu progresso fica salvo neste aparelho. Entre na sua conta para levar seus estudos a outros dispositivos." : "Seu progresso fica disponível sem conexão e acompanha sua conta em outros dispositivos."}</Text></View>
    <Pressable onPress={onLogout} style={styles.logout}><Text style={styles.logoutText}>{user.isGuest ? "Trocar perfil" : "Sair da conta"}</Text></Pressable>
  </ScrollView>;
}

export function DetailScreen({ kanji, progress, onBack, onStudy, onSetStatus, onToggleFavorite }: {
  kanji: Kanji;
  progress?: KanjiProgress;
  onBack: () => void;
  onStudy: () => void;
  onSetStatus: (status: KnowledgeStatus) => void;
  onToggleFavorite: () => void;
}) {
  const [strokeStep, setStrokeStep] = useState(0);
  const statusLabels: Record<KnowledgeStatus, string> = { not_started: "Novo", learning: "Aprendendo", learned: "Aprendido" };
  const strokes = strokeData[kanji.character] ?? [];
  return <ScrollView contentContainerStyle={styles.scroll}>
    <Pressable onPress={onBack}><Text style={styles.link}>← Voltar</Text></Pressable>
    <View style={styles.detail}><Text style={styles.detailKanji}>{kanji.character}</Text>
      <Text style={styles.meaning}>{kanji.meaning}</Text>
      <View style={styles.divider} />
      <Text style={styles.section}>Leituras</Text><Text style={styles.reading}>On'yomi  {kanji.onyomi || "—"}</Text><Text style={styles.reading}>Kun'yomi  {kanji.kunyomi || "—"}</Text>
      <Text style={[styles.jlpt, { color: jlptColors[kanji.jlpt ?? "N5"] }]}>{kanji.jlpt ?? "Sem nível"} · {kanji.strokeCount ?? "?"} traços</Text>
    </View>
    {kanji.examples?.length ? <View style={styles.card}>
      <Text style={styles.cardTitle}>Palavras de exemplo</Text>
      {kanji.examples.map((example) => <View key={example.word} style={styles.exampleRow}>
        <Text style={styles.exampleWord}>{example.word}</Text>
        <View style={styles.exampleCopy}><Text style={styles.reading}>{example.reading}</Text><Text style={styles.body}>{example.meaning}</Text></View>
      </View>)}
    </View> : null}
    <SectionHeader title="Seu domínio" />
    <View style={styles.filterRow}>{(["not_started", "learning", "learned"] as KnowledgeStatus[]).map((status) =>
      <Pressable key={status} onPress={() => onSetStatus(status)} style={[styles.filter, progress?.status === status && styles.filterActive]}>
        <Text style={[styles.filterLabel, progress?.status === status && styles.filterLabelActive]}>{statusLabels[status]}</Text>
      </Pressable>)}</View>
    <Pressable onPress={onToggleFavorite} style={styles.secondaryButton}><Text style={styles.link}>{progress?.favorite ? "★ Remover dos favoritos" : "☆ Adicionar aos favoritos"}</Text></Pressable>
    <View style={styles.card}>
      <Text style={styles.cardTitle}>Ordem dos traços</Text>
      {strokes.length ? <>
        <Svg height={220} viewBox="0 0 109 109" width={220}>
          {strokes.map((path, index) => <Path key={`${kanji.character}-${index}`} d={path}
            fill="none" stroke={index < strokeStep ? colors.primary : "#D8DADD"}
            strokeLinecap="round" strokeLinejoin="round" strokeWidth={3.5} />)}
        </Svg>
        <Text style={styles.strokeLabel}>{strokeStep === strokes.length ? "Sequência completa" : `Traço ${strokeStep + 1} de ${strokes.length}`}</Text>
        <View style={styles.strokeControls}>
          <Pressable accessibilityLabel="Traço anterior" disabled={strokeStep === 0}
            onPress={() => setStrokeStep((step) => Math.max(0, step - 1))} style={styles.strokeButton}>
            <Text style={styles.strokeButtonText}>Anterior</Text>
          </Pressable>
          <Pressable accessibilityLabel={strokeStep === strokes.length ? "Reiniciar ordem dos traços" : "Próximo traço"}
            onPress={() => setStrokeStep((step) => step === strokes.length ? 0 : step + 1)} style={styles.strokeButton}>
            <Text style={styles.strokeButtonText}>{strokeStep === strokes.length ? "Reiniciar" : "Próximo"}</Text>
          </Pressable>
        </View>
      </> : <Text style={styles.body}>A ordem dos traços ainda não está disponível para este kanji.</Text>}
    </View>
    <Pressable onPress={onStudy} style={styles.cameraButton}><Text style={styles.primaryText}>Praticar este kanji</Text></Pressable>
  </ScrollView>;
}

export function CameraScreen({ kanjis, onBack, onRecognized }: {
  kanjis: Kanji[];
  onBack: () => void;
  onRecognized: (kanji: Kanji) => void;
}) {
  const [permission, requestPermission] = useCameraPermissions();
  const [cameraReady, setCameraReady] = useState(false);
  const [recognizing, setRecognizing] = useState(false);
  const [recognizedOptions, setRecognizedOptions] = useState<Kanji[]>([]);
  const [feedback, setFeedback] = useState<{ title: string; message: string } | null>(null);
  const camera = useRef<CameraView>(null);

  async function captureAndRecognize() {
    if (!camera.current || !cameraReady || recognizing) return;
    setRecognizing(true);
    setFeedback(null);
    setRecognizedOptions([]);
    try {
      const photo = await camera.current.takePictureAsync({ quality: 0.75 });
      if (!photo?.uri) throw new Error("A captura não retornou uma imagem.");
      const result = await TextRecognition.recognize(photo.uri, TextRecognitionScript.JAPANESE);
      const matches = extractCatalogKanjisFromOcr(result, kanjis);
      if (!result.text.trim()) {
        setFeedback({ title: "Nenhum texto detectado", message: "Tente aproximar a câmera, melhorar a iluminação ou buscar manualmente." });
        return;
      }
      if (!matches.length) {
        setFeedback({ title: "Kanji não encontrado no catálogo", message: `Texto reconhecido: ${result.text}` });
        return;
      }
      if (matches.length === 1) {
        onRecognized(matches[0]);
        return;
      }
      setRecognizedOptions(matches);
    } catch (error) {
      setFeedback({ title: "Falha no reconhecimento", message: getOcrErrorMessage(error) });
    } finally {
      setRecognizing(false);
    }
  }

  if (!permission) return <View style={styles.cameraMessage}><ActivityIndicator color={colors.primary} /></View>;
  if (!permission.granted) return <View style={styles.cameraMessage}>
    <Text style={styles.cardTitle}>A câmera precisa de permissão</Text>
    <Pressable onPress={requestPermission} style={styles.cameraButton}><Text style={styles.primaryText}>Permitir câmera</Text></Pressable>
    <Pressable onPress={onBack}><Text style={styles.link}>Voltar à busca</Text></Pressable>
  </View>;

  return <View style={styles.cameraScreen}>
    <CameraView ref={camera} facing="back" onCameraReady={() => setCameraReady(true)} style={StyleSheet.absoluteFill} />
    <View style={styles.cameraOverlay}><Pressable onPress={onBack}><Text style={styles.cameraBack}>Fechar</Text></Pressable>
      <View style={styles.focusFrame} /><Text style={styles.cameraHint}>Enquadre um caractere japonês</Text>
      {recognizedOptions.length ? <View style={styles.cameraResultPanel}>
        <Text style={styles.cameraResultTitle}>Escolha o kanji reconhecido</Text>
        <View style={styles.cameraOptions}>
          {recognizedOptions.map((kanji) => <Pressable key={kanji.id} onPress={() => onRecognized(kanji)} style={styles.cameraOption}>
            <Text style={styles.cameraOptionKanji}>{kanji.character}</Text>
            <Text style={styles.cameraOptionText}>{kanji.meaning}</Text>
          </Pressable>)}
        </View>
        <Pressable onPress={() => { setRecognizedOptions([]); setFeedback(null); }} style={styles.cameraPanelButton}>
          <Text style={styles.link}>Tentar novamente</Text>
        </Pressable>
      </View> : null}
      {feedback ? <View style={styles.cameraResultPanel}>
        <Text style={styles.cameraResultTitle}>{feedback.title}</Text>
        <Text style={styles.cameraResultMessage}>{feedback.message}</Text>
        <View style={styles.cameraPanelActions}>
          <Pressable onPress={() => setFeedback(null)} style={styles.cameraPanelButton}><Text style={styles.link}>Tentar novamente</Text></Pressable>
          <Pressable onPress={onBack} style={styles.cameraPanelButton}><Text style={styles.link}>Buscar manualmente</Text></Pressable>
        </View>
      </View> : null}
      <Pressable disabled={!cameraReady || recognizing} onPress={captureAndRecognize} style={styles.captureButton}>
        {recognizing ? <ActivityIndicator color={colors.text} /> : <Text style={styles.captureLabel}>Capturar e reconhecer</Text>}
      </Pressable>
    </View>
  </View>;
}

function ActionCard({ title, value, action, onPress }: { title: string; value: string; action: string; onPress: () => void }) {
  return <View style={styles.actionCard}><Text style={styles.cardTitle}>{title}</Text><Text style={styles.body}>{value}</Text><Pressable onPress={onPress}><Text style={styles.link}>{action}</Text></Pressable></View>;
}

const styles = StyleSheet.create({
  scroll: { padding: 20, paddingBottom: 100 }, eyebrow: { color: colors.primary, fontSize: 12, fontWeight: "700" },
  greeting: { color: colors.secondaryText, fontSize: 15, marginTop: 12 }, body: { color: colors.secondaryText, fontSize: 15, lineHeight: 22, marginTop: 6 },
  dayCard: { backgroundColor: colors.primary, borderRadius: 16, marginTop: 20, padding: 20 }, cardEyebrow: { color: colors.surface, fontSize: 12, fontWeight: "700" },
  dayKanji: { color: colors.surface, fontSize: 72, marginTop: 10 }, dayReading: { color: colors.surface, fontSize: 18, marginTop: 4 }, dayMeaning: { color: colors.surface, fontSize: 16, marginTop: 5 }, dayLink: { color: colors.surface, fontWeight: "700", marginTop: 16 },
  columns: { flexDirection: "row", gap: 10, marginTop: 12 }, actionCard: { backgroundColor: colors.surface, borderColor: colors.border, borderRadius: 12, borderWidth: 1, flex: 1, padding: 14 },
  cardTitle: { color: colors.text, fontSize: 16, fontWeight: "700" }, link: { color: colors.primary, fontSize: 15, fontWeight: "700", marginTop: 12 },
  card: { backgroundColor: colors.surface, borderColor: colors.border, borderRadius: 12, borderWidth: 1, marginTop: 12, padding: 16 }, progressNumber: { color: colors.text, fontSize: 18, fontWeight: "700", marginBottom: 12 },
  activityRow: { alignItems: "center", borderBottomColor: colors.border, borderBottomWidth: 1, flexDirection: "row", justifyContent: "space-between", minHeight: 64, paddingVertical: 8 },
  activityCopy: { flex: 1 }, activityDate: { color: colors.secondaryText, fontSize: 12, marginLeft: 12 },
  exampleRow: { alignItems: "center", borderBottomColor: colors.border, borderBottomWidth: 1, flexDirection: "row", gap: 16, paddingVertical: 12 },
  exampleWord: { color: colors.primary, fontSize: 25, minWidth: 104 }, exampleCopy: { flex: 1 },
  input: { backgroundColor: colors.surface, borderColor: colors.border, borderRadius: 10, borderWidth: 1, color: colors.text, height: 50, marginTop: 20, paddingHorizontal: 14 },
  filterRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 14 }, filter: { borderColor: colors.border, borderRadius: 8, borderWidth: 1, paddingHorizontal: 12, paddingVertical: 9 },
  filterActive: { backgroundColor: colors.primary, borderColor: colors.primary }, filterLabel: { color: colors.text, fontSize: 13 }, filterLabelActive: { color: colors.surface, fontWeight: "700" },
  cameraButton: { alignItems: "center", backgroundColor: colors.primary, borderRadius: 10, justifyContent: "center", marginTop: 14, minHeight: 50, padding: 12 }, primaryText: { color: colors.surface, fontSize: 15, fontWeight: "700" },
  section: { color: colors.text, fontSize: 18, fontWeight: "700", marginTop: 22 }, studyCard: { backgroundColor: colors.surface, borderColor: colors.border, borderRadius: 12, borderWidth: 1, marginTop: 14, padding: 18 },
  secondaryButton: { alignItems: "center", backgroundColor: colors.surface, borderColor: colors.border, borderRadius: 10, borderWidth: 1, marginTop: 12, minHeight: 48, padding: 8 },
  flashcard: { alignItems: "center", backgroundColor: colors.surface, borderColor: colors.border, borderRadius: 14, borderWidth: 1, justifyContent: "center", marginTop: 22, minHeight: 300, padding: 20 },
  flashKanji: { color: colors.primary, fontSize: 76, textAlign: "center" }, reading: { color: colors.text, fontSize: 18, marginTop: 14 }, meaning: { color: colors.text, fontSize: 22, fontWeight: "700", marginTop: 10 },
  rateButton: { alignItems: "center", backgroundColor: colors.border, borderRadius: 10, flex: 1, justifyContent: "center", minHeight: 52 }, rateGood: { backgroundColor: colors.success }, rateLabel: { color: colors.text, fontWeight: "700" }, feedback: { color: colors.primary, fontSize: 24, fontWeight: "700", marginTop: 24 },
  choice: { backgroundColor: colors.surface, borderColor: colors.border, borderRadius: 10, borderWidth: 1, marginTop: 12, padding: 16 }, choiceText: { color: colors.text, fontSize: 16 },
  statCard: { backgroundColor: colors.surface, borderColor: colors.border, borderRadius: 10, borderWidth: 1, flex: 1, marginTop: 14, padding: 12 }, statValue: { color: colors.primary, fontSize: 25, fontWeight: "700" },
  level: { marginTop: 16 }, levelHeader: { alignItems: "center", flexDirection: "row", justifyContent: "space-between", marginBottom: 6 }, jlpt: { fontSize: 14, fontWeight: "700" },
  profile: { alignItems: "center", paddingVertical: 24 }, avatar: { alignItems: "center", backgroundColor: colors.primary, borderRadius: 32, height: 64, justifyContent: "center", width: 64 }, avatarText: { color: colors.surface, fontSize: 28 },
  logout: { alignItems: "center", borderColor: colors.error, borderRadius: 10, borderWidth: 1, marginTop: 26, padding: 14 }, logoutText: { color: colors.error, fontWeight: "700" },
  detail: { alignItems: "center", backgroundColor: colors.surface, borderColor: colors.border, borderRadius: 14, borderWidth: 1, marginTop: 18, padding: 20 }, detailKanji: { color: colors.text, fontSize: 112 }, divider: { backgroundColor: colors.border, height: 1, marginVertical: 16, width: "100%" },
  strokeLabel: { color: colors.secondaryText, fontSize: 14, textAlign: "center" }, strokeControls: { flexDirection: "row", gap: 12, marginTop: 14 },
  strokeButton: { alignItems: "center", backgroundColor: colors.bg, borderColor: colors.border, borderRadius: 8, borderWidth: 1, minWidth: 100, paddingHorizontal: 16, paddingVertical: 11 },
  strokeButtonText: { color: colors.text, fontSize: 14, fontWeight: "700" },
  quizResult: { backgroundColor: colors.surface, borderColor: colors.border, borderRadius: 10, borderWidth: 1, marginTop: 9, padding: 12 },
  captureButton: { alignItems: "center", backgroundColor: colors.surface, borderRadius: 12, justifyContent: "center", minHeight: 54, paddingHorizontal: 22 }, captureLabel: { color: colors.text, fontWeight: "700" },
  cameraScreen: { backgroundColor: "#111", flex: 1 }, cameraOverlay: { alignItems: "center", flex: 1, justifyContent: "space-between", padding: 24, paddingTop: 50 }, cameraBack: { alignSelf: "flex-start", color: colors.surface, fontSize: 16, fontWeight: "700" },
  focusFrame: { borderColor: colors.surface, borderRadius: 8, borderWidth: 2, height: 220, width: 220 }, cameraHint: { color: colors.surface, fontSize: 15 }, cameraMessage: { alignItems: "center", backgroundColor: colors.bg, flex: 1, gap: 14, justifyContent: "center", padding: 24 },
  cameraResultPanel: { alignSelf: "stretch", backgroundColor: colors.surface, borderRadius: 12, padding: 14 },
  cameraResultTitle: { color: colors.text, fontSize: 16, fontWeight: "700" },
  cameraResultMessage: { color: colors.secondaryText, fontSize: 14, lineHeight: 20, marginTop: 8 },
  cameraOptions: { gap: 8, marginTop: 12 },
  cameraOption: { alignItems: "center", borderColor: colors.border, borderRadius: 8, borderWidth: 1, flexDirection: "row", gap: 12, minHeight: 54, paddingHorizontal: 12 },
  cameraOptionKanji: { color: colors.primary, fontSize: 30, minWidth: 42 },
  cameraOptionText: { color: colors.text, flex: 1, fontSize: 15, fontWeight: "700" },
  cameraPanelActions: { flexDirection: "row", gap: 10, marginTop: 8 },
  cameraPanelButton: { alignItems: "center", flex: 1, minHeight: 42 },
});
