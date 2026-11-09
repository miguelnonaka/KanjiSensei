import { useState } from "react";
import { Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { colors } from "../theme";
import { Kanji } from "../types";

type KanjiForm = {
  id?: number;
  character: string;
  meaning: string;
  onyomi: string;
  kunyomi: string;
  radical: string;
  strokeCount: string;
  jlpt: string;
  examples: string;
  etymology: string;
  mnemonic: string;
};
type AdminUser = { id: number; email: string; role: "USER" | "ADMIN" };

const emptyForm: KanjiForm = {
  character: "",
  meaning: "",
  onyomi: "",
  kunyomi: "",
  radical: "",
  strokeCount: "",
  jlpt: "N5",
  examples: "",
  etymology: "",
  mnemonic: "",
};

export default function AdminScreen({ kanjis, users, onSave, onDelete, onUpdateRole, onBack }: {
  kanjis: Kanji[];
  users: AdminUser[];
  onSave: (kanji: Omit<Kanji, "id">, id?: number) => Promise<void>;
  onDelete: (id: number) => Promise<void>;
  onUpdateRole: (user: AdminUser) => Promise<void>;
  onBack: () => void;
}) {
  const [form, setForm] = useState<KanjiForm>(emptyForm);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  function edit(kanji: Kanji) {
    setForm({
      id: kanji.id,
      character: kanji.character,
      meaning: kanji.meaning,
      onyomi: kanji.onyomi ?? "",
      kunyomi: kanji.kunyomi ?? "",
      radical: kanji.radical ?? "",
      strokeCount: kanji.strokeCount ? String(kanji.strokeCount) : "",
      jlpt: kanji.jlpt ?? "",
      examples: (kanji.examples ?? []).map((example) => `${example.word} | ${example.reading} | ${example.meaning}`).join("\n"),
      etymology: kanji.etymology ?? "",
      mnemonic: kanji.mnemonic ?? "",
    });
    setError("");
  }

  async function save() {
    const strokeCount = form.strokeCount ? Number(form.strokeCount) : null;
    const examples = form.examples.split("\n").filter((line) => line.trim()).map((line) => {
      const [word, reading, meaning] = line.split("|").map((part) => part.trim());
      return { word, reading, meaning };
    });
    if (!form.character.trim() || !form.meaning.trim() ||
      (form.jlpt && !["N1", "N2", "N3", "N4", "N5"].includes(form.jlpt)) ||
      (strokeCount !== null && (!Number.isInteger(strokeCount) || strokeCount < 1 || strokeCount > 100)) ||
      examples.some((example) => !example.word || !example.reading || !example.meaning)) {
      setError("Revise caractere, significado, nível, traços e exemplos.");
      return;
    }

    setSaving(true);
    setError("");
    try {
      await onSave({
        character: form.character.trim(),
        meaning: form.meaning.trim(),
        onyomi: form.onyomi.trim() || null,
        kunyomi: form.kunyomi.trim() || null,
        radical: form.radical.trim() || null,
        strokeCount,
        jlpt: form.jlpt || null,
        examples,
        etymology: form.etymology.trim() || null,
        mnemonic: form.mnemonic.trim() || null,
      }, form.id);
      setForm(emptyForm);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Não foi possível salvar o kanji.");
    } finally {
      setSaving(false);
    }
  }

  function confirmDelete(kanji: Kanji) {
    Alert.alert("Remover kanji", `Remover ${kanji.character} e os dados de estudo associados?`, [
      { text: "Cancelar", style: "cancel" },
      { text: "Remover", style: "destructive", onPress: () => {
        void onDelete(kanji.id).catch((deleteError: unknown) =>
          setError(deleteError instanceof Error ? deleteError.message : "Não foi possível remover o kanji."));
      } },
    ]);
  }

  return <ScrollView contentContainerStyle={styles.container}>
    <Pressable onPress={onBack}><Text style={styles.link}>← Perfil</Text></Pressable>
    <Text style={styles.title}>Painel administrativo</Text>
    <Text style={styles.body}>Gerencie o catálogo de kanjis. As alterações são gravadas no servidor.</Text>
    {(["character", "meaning", "onyomi", "kunyomi", "radical", "strokeCount", "jlpt"] as const).map((field) =>
      <TextInput key={field} accessibilityLabel={field} onChangeText={(value) => setForm((current) => ({ ...current, [field]: value }))}
        placeholder={field === "strokeCount" ? "Número de traços" : field.toUpperCase()}
        placeholderTextColor={colors.secondaryText} style={styles.input} value={form[field]} />)}
    <TextInput accessibilityLabel="Exemplos" multiline onChangeText={(examples) => setForm((current) => ({ ...current, examples }))}
      placeholder="Exemplos (uma linha: palavra | leitura | significado)" placeholderTextColor={colors.secondaryText}
      style={[styles.input, styles.examples]} value={form.examples} />
    <TextInput accessibilityLabel="Etimologia" maxLength={2000} multiline
      onChangeText={(etymology) => setForm((current) => ({ ...current, etymology }))}
      placeholder="Etimologia (opcional; informe a fonte)" placeholderTextColor={colors.secondaryText}
      style={[styles.input, styles.longInput]} value={form.etymology} />
    <TextInput accessibilityLabel="Mnemônica" maxLength={2000} multiline
      onChangeText={(mnemonic) => setForm((current) => ({ ...current, mnemonic }))}
      placeholder="Mnemônica (opcional; texto original)" placeholderTextColor={colors.secondaryText}
      style={[styles.input, styles.longInput]} value={form.mnemonic} />
    {error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}
    <Pressable disabled={saving} onPress={() => void save()} style={styles.primary}>
      <Text style={styles.primaryText}>{saving ? "Salvando..." : form.id ? "Salvar alterações" : "Adicionar kanji"}</Text>
    </Pressable>
    {form.id ? <Pressable onPress={() => { setForm(emptyForm); setError(""); }}><Text style={styles.link}>Cancelar edição</Text></Pressable> : null}
    <Text style={styles.section}>Catálogo ({kanjis.length})</Text>
    {kanjis.map((kanji) => <View key={kanji.id} style={styles.row}>
      <View style={styles.copy}><Text style={styles.character}>{kanji.character}</Text><Text style={styles.body}>{kanji.meaning} · {kanji.jlpt ?? "sem JLPT"}</Text></View>
      <Pressable accessibilityLabel={`Editar ${kanji.character}`} onPress={() => edit(kanji)}><Text style={styles.link}>Editar</Text></Pressable>
      <Pressable accessibilityLabel={`Remover ${kanji.character}`} onPress={() => confirmDelete(kanji)}><Text style={styles.delete}>Remover</Text></Pressable>
    </View>)}
    <Text style={styles.section}>Usuários e permissões</Text>
    <Text style={styles.body}>Somente administradores podem alterar estes níveis de acesso.</Text>
    {users.map((user) => <View key={user.id} style={styles.row}>
      <View style={styles.copy}><Text style={styles.body}>{user.email}</Text><Text style={styles.body}>{user.role === "ADMIN" ? "Administrador" : "Usuário"}</Text></View>
      <Pressable onPress={() => {
        const nextUser = { ...user, role: user.role === "ADMIN" ? "USER" as const : "ADMIN" as const };
        void onUpdateRole(nextUser).catch((updateError: unknown) =>
          setError(updateError instanceof Error ? updateError.message : "Não foi possível alterar a permissão."));
      }}><Text style={styles.link}>Alterar</Text></Pressable>
    </View>)}
  </ScrollView>;
}

const styles = StyleSheet.create({
  container: { padding: 20, paddingBottom: 100 },
  title: { color: colors.text, fontSize: 24, fontWeight: "700" },
  body: { color: colors.secondaryText, fontSize: 14, marginTop: 6 },
  input: { backgroundColor: colors.surface, borderColor: colors.border, borderRadius: 10, borderWidth: 1, color: colors.text, height: 48, marginTop: 10, paddingHorizontal: 12 },
  examples: { height: 100, paddingTop: 12, textAlignVertical: "top" },
  longInput: { height: 100, paddingTop: 12, textAlignVertical: "top" },
  primary: { alignItems: "center", backgroundColor: colors.primary, borderRadius: 10, marginTop: 14, padding: 14 },
  primaryText: { color: colors.surface, fontWeight: "700" },
  error: { color: colors.error, marginTop: 10 },
  link: { color: colors.primary, fontWeight: "700", padding: 10 },
  section: { color: colors.text, fontSize: 18, fontWeight: "700", marginTop: 22 },
  row: { alignItems: "center", borderBottomColor: colors.border, borderBottomWidth: 1, flexDirection: "row", gap: 5, paddingVertical: 8 },
  copy: { flex: 1 },
  character: { color: colors.text, fontSize: 26, fontWeight: "700" },
  delete: { color: colors.error, fontWeight: "700", padding: 8 },
});
