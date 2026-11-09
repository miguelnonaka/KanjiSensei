import * as DocumentPicker from "expo-document-picker";
import * as FileSystem from "expo-file-system/legacy";
import * as Sharing from "expo-sharing";
import { createLocalBackup } from "./localStore";

export async function exportStudyBackup(profileId: string, owner: string): Promise<void> {
  const directory = FileSystem.cacheDirectory;
  if (!directory) throw new Error("O armazenamento temporário não está disponível.");
  if (!(await Sharing.isAvailableAsync())) throw new Error("O compartilhamento de arquivos não está disponível neste aparelho.");
  const backup = await createLocalBackup(profileId, owner);
  const safeOwner = owner.replace(/[^\w-]/g, "-");
  const uri = `${directory}kanjisensei-backup-${safeOwner}-${Date.now()}.json`;
  await FileSystem.writeAsStringAsync(uri, JSON.stringify(backup), { encoding: FileSystem.EncodingType.UTF8 });
  await Sharing.shareAsync(uri, { mimeType: "application/json", dialogTitle: "Salvar backup de estudos" });
}

export async function selectStudyBackup(): Promise<unknown | null> {
  const result = await DocumentPicker.getDocumentAsync({
    type: "application/json",
    copyToCacheDirectory: true,
  });
  if (result.canceled) return null;
  const contents = await FileSystem.readAsStringAsync(result.assets[0].uri, { encoding: FileSystem.EncodingType.UTF8 });
  try {
    return JSON.parse(contents) as unknown;
  } catch {
    throw new Error("O arquivo selecionado não contém JSON válido.");
  }
}
