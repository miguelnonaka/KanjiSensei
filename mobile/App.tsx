import KanjiSenseiApp from "./src/KanjiSenseiRoot";
import { SafeAreaProvider } from "react-native-safe-area-context";

export default function App() {
  return <SafeAreaProvider><KanjiSenseiApp /></SafeAreaProvider>;
}
