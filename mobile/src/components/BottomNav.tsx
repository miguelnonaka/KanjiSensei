import { Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { colors } from "../theme";
import { Screen } from "../types";
export default function BottomNav({ screen, onNavigate }: { screen: Screen; onNavigate: (screen: Screen) => void }) {
	const insets = useSafeAreaInsets();
	return <View style={[styles.nav, { paddingBottom: Math.max(insets.bottom, 10) }]}>{([['home','⌂','Início'],['search','⌕','Buscar'],['study','◈','Estudar'],['progress','▥','Progresso'],['profile','○','Perfil']] as [Screen,string,string][]).map(([target, icon, label]) => <Pressable key={target} onPress={() => onNavigate(target)} style={styles.item}><Text style={[styles.icon, screen === target && styles.active]}>{icon}</Text><Text style={[styles.label, screen === target && styles.active]}>{label}</Text></Pressable>)}</View>;
}
const styles = StyleSheet.create({ nav: { backgroundColor: colors.surface, borderTopColor: colors.border, borderTopWidth: 1, flexDirection: "row", justifyContent: "space-around", paddingTop: 8 }, item: { alignItems: "center", flex: 1 }, icon: { color: colors.secondaryText, fontSize: 23 }, label: { color: colors.secondaryText, fontSize: 11, marginTop: 3 }, active: { color: colors.primary, fontWeight: "700" } });
