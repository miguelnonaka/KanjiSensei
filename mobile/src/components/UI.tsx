import { PropsWithChildren } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { colors, jlptColors } from "../theme";

export function ProgressBar({ value, color }: { value: number; color: string }) {
  return <View style={styles.progressTrack}><View style={[styles.progressFill, { width: `${Math.max(0, Math.min(value, 1)) * 100}%`, backgroundColor: color }]} /></View>;
}

export function SectionHeader({ title, action, onPress }: { title: string; action?: string; onPress?: () => void }) {
  return <View style={styles.sectionHeader}><Text style={styles.sectionTitle}>{title}</Text>{action && onPress ? <Pressable onPress={onPress}><Text style={styles.link}>{action}</Text></Pressable> : null}</View>;
}

export function KanjiRow({ kanji, onPress }: { kanji: import("../types").Kanji; onPress: () => void }) {
  return <Pressable onPress={onPress} style={styles.kanjiRow}><Text style={styles.rowKanji}>{kanji.character}</Text><View style={styles.rowCopy}><Text style={styles.cardTitle}>{kanji.meaning}</Text><Text style={styles.bodyText}>{kanji.onyomi} · {kanji.kunyomi}</Text></View><Text style={[styles.jlpt, { color: jlptColors[kanji.jlpt ?? "N5"] }]}>{kanji.jlpt}</Text></Pressable>;
}

export function ScreenTitle({ children }: PropsWithChildren) { return <Text style={styles.title}>{children}</Text>; }

const styles = StyleSheet.create({
  progressTrack: { backgroundColor: colors.border, borderRadius: 5, height: 9, overflow: "hidden" },
  progressFill: { borderRadius: 5, height: "100%" },
  sectionHeader: { alignItems: "center", flexDirection: "row", justifyContent: "space-between", marginTop: 24 },
  sectionTitle: { color: colors.text, fontSize: 19, fontWeight: "700", marginTop: 24 },
  link: { color: colors.primary, fontSize: 15, fontWeight: "700", marginTop: 14 },
  title: { color: colors.text, fontSize: 24, fontWeight: "700", marginTop: 6 },
  bodyText: { color: colors.secondaryText, fontSize: 15, lineHeight: 22, marginTop: 6 },
  kanjiRow: { alignItems: "center", backgroundColor: colors.surface, borderColor: colors.border, borderRadius: 14, borderWidth: 1.5, flexDirection: "row", marginTop: 10, padding: 14 },
  rowKanji: { color: colors.primary, fontSize: 44, width: 64 },
  rowCopy: { flex: 1 },
  cardTitle: { color: colors.text, fontSize: 16, fontWeight: "700" },
  jlpt: { fontSize: 13, fontWeight: "700" },
});
