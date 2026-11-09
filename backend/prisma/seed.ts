import "dotenv/config";
import { readFileSync } from "node:fs";
import bcrypt from "bcryptjs";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const kanjis = [
  {
    character: "日",
    meaning: "dia; sol",
    onyomi: "ニチ, ジツ",
    kunyomi: "ひ, か",
    strokeCount: 4,
    jlpt: "N5",
  },
  {
    character: "人",
    meaning: "pessoa",
    onyomi: "ジン, ニン",
    kunyomi: "ひと",
    strokeCount: 2,
    jlpt: "N5",
  },
  {
    character: "水",
    meaning: "água",
    onyomi: "スイ",
    kunyomi: "みず",
    strokeCount: 4,
    jlpt: "N5",
  },
  {
    character: "火",
    meaning: "fogo",
    onyomi: "カ",
    kunyomi: "ひ",
    strokeCount: 4,
    jlpt: "N5",
  },
  {
    character: "学",
    meaning: "estudo; aprender",
    onyomi: "ガク",
    kunyomi: "まなぶ",
    strokeCount: 8,
    jlpt: "N5",
  },
  {
    character: "食",
    meaning: "comer; comida",
    onyomi: "ショク",
    kunyomi: "たべる",
    strokeCount: 9,
    jlpt: "N5",
  },
  {
    character: "見",
    meaning: "ver",
    onyomi: "ケン",
    kunyomi: "みる",
    strokeCount: 7,
    jlpt: "N5",
  },
  {
    character: "行",
    meaning: "ir; realizar",
    onyomi: "コウ",
    kunyomi: "いく",
    strokeCount: 6,
    jlpt: "N5",
  },
  {
    character: "木",
    meaning: "árvore; madeira",
    onyomi: "モク",
    kunyomi: "き",
    strokeCount: 4,
    jlpt: "N5",
  },
  {
    character: "山",
    meaning: "montanha",
    onyomi: "サン",
    kunyomi: "やま",
    strokeCount: 3,
    jlpt: "N5",
  },
  { character: "一", meaning: "um", onyomi: "イチ, イツ", kunyomi: "ひと", strokeCount: 1, jlpt: "N5" },
  { character: "二", meaning: "dois", onyomi: "ニ", kunyomi: "ふた", strokeCount: 2, jlpt: "N5" },
  { character: "三", meaning: "três", onyomi: "サン", kunyomi: "みっ", strokeCount: 3, jlpt: "N5" },
  { character: "四", meaning: "quatro", onyomi: "シ", kunyomi: "よん, よ", strokeCount: 5, jlpt: "N5" },
  { character: "五", meaning: "cinco", onyomi: "ゴ", kunyomi: "いつ", strokeCount: 4, jlpt: "N5" },
  { character: "六", meaning: "seis", onyomi: "ロク", kunyomi: "むっ", strokeCount: 4, jlpt: "N5" },
  { character: "七", meaning: "sete", onyomi: "シチ", kunyomi: "なな", strokeCount: 2, jlpt: "N5" },
  { character: "八", meaning: "oito", onyomi: "ハチ", kunyomi: "やっ", strokeCount: 2, jlpt: "N5" },
  { character: "九", meaning: "nove", onyomi: "キュウ, ク", kunyomi: "ここの", strokeCount: 2, jlpt: "N5" },
  { character: "十", meaning: "dez", onyomi: "ジュウ", kunyomi: "とお", strokeCount: 2, jlpt: "N5" },
  { character: "月", meaning: "lua; mês", onyomi: "ゲツ, ガツ", kunyomi: "つき", strokeCount: 4, jlpt: "N5" },
  { character: "川", meaning: "rio", onyomi: "セン", kunyomi: "かわ", strokeCount: 3, jlpt: "N5" },
  { character: "本", meaning: "livro; origem", onyomi: "ホン", kunyomi: "もと", strokeCount: 5, jlpt: "N5" },
  { character: "中", meaning: "meio; dentro", onyomi: "チュウ", kunyomi: "なか", strokeCount: 4, jlpt: "N5" },
  { character: "上", meaning: "acima", onyomi: "ジョウ", kunyomi: "うえ", strokeCount: 3, jlpt: "N5" },
  { character: "下", meaning: "abaixo", onyomi: "カ, ゲ", kunyomi: "した", strokeCount: 3, jlpt: "N5" },
  { character: "金", meaning: "ouro; dinheiro", onyomi: "キン", kunyomi: "かね", strokeCount: 8, jlpt: "N5" },
  { character: "土", meaning: "terra; solo", onyomi: "ド, ト", kunyomi: "つち", strokeCount: 3, jlpt: "N5" },
  { character: "年", meaning: "ano", onyomi: "ネン", kunyomi: "とし", strokeCount: 6, jlpt: "N5" },
  { character: "大", meaning: "grande", onyomi: "ダイ, タイ", kunyomi: "おお", strokeCount: 3, jlpt: "N5" },
  { character: "小", meaning: "pequeno", onyomi: "ショウ", kunyomi: "ちい", strokeCount: 3, jlpt: "N5" },
  { character: "今", meaning: "agora", onyomi: "コン", kunyomi: "いま", strokeCount: 4, jlpt: "N5" },
  { character: "口", meaning: "boca; abertura", onyomi: "コウ, ク", kunyomi: "くち", strokeCount: 3, jlpt: "N5" },
  { character: "目", meaning: "olho", onyomi: "モク, ボク", kunyomi: "め", strokeCount: 5, jlpt: "N5" },
  { character: "耳", meaning: "orelha", onyomi: "ジ", kunyomi: "みみ", strokeCount: 6, jlpt: "N5" },
  { character: "手", meaning: "mão", onyomi: "シュ", kunyomi: "て", strokeCount: 4, jlpt: "N5" },
  { character: "足", meaning: "pé; suficiente", onyomi: "ソク", kunyomi: "あし, たりる", strokeCount: 7, jlpt: "N5" },
  { character: "力", meaning: "força", onyomi: "リョク, リキ", kunyomi: "ちから", strokeCount: 2, jlpt: "N5" },
  { character: "女", meaning: "mulher", onyomi: "ジョ, ニョ", kunyomi: "おんな", strokeCount: 3, jlpt: "N5" },
  { character: "男", meaning: "homem", onyomi: "ダン, ナン", kunyomi: "おとこ", strokeCount: 7, jlpt: "N5" },
  { character: "子", meaning: "criança", onyomi: "シ, ス", kunyomi: "こ", strokeCount: 3, jlpt: "N5" },
  { character: "父", meaning: "pai", onyomi: "フ", kunyomi: "ちち", strokeCount: 4, jlpt: "N5" },
  { character: "母", meaning: "mãe", onyomi: "ボ", kunyomi: "はは", strokeCount: 5, jlpt: "N5" },
  { character: "友", meaning: "amigo", onyomi: "ユウ", kunyomi: "とも", strokeCount: 4, jlpt: "N5" },
  { character: "先", meaning: "anterior; antes", onyomi: "セン", kunyomi: "さき", strokeCount: 6, jlpt: "N5" },
  { character: "生", meaning: "vida; nascer", onyomi: "セイ, ショウ", kunyomi: "いきる, うまれる", strokeCount: 5, jlpt: "N5" },
  { character: "何", meaning: "o que; qual", onyomi: "カ", kunyomi: "なに, なん", strokeCount: 7, jlpt: "N5" },
  { character: "時", meaning: "tempo; hora", onyomi: "ジ", kunyomi: "とき", strokeCount: 10, jlpt: "N5" },
  { character: "分", meaning: "minuto; parte", onyomi: "ブン, フン", kunyomi: "わかる", strokeCount: 4, jlpt: "N5" },
  { character: "半", meaning: "metade", onyomi: "ハン", kunyomi: "", strokeCount: 5, jlpt: "N5" },
  { character: "前", meaning: "antes; frente", onyomi: "ゼン", kunyomi: "まえ", strokeCount: 9, jlpt: "N5" },
  { character: "後", meaning: "depois; atrás", onyomi: "ゴ, コウ", kunyomi: "あと, うしろ", strokeCount: 9, jlpt: "N5" },
  { character: "午", meaning: "meio-dia", onyomi: "ゴ", kunyomi: "", strokeCount: 4, jlpt: "N5" },
  { character: "毎", meaning: "cada; todo", onyomi: "マイ", kunyomi: "", strokeCount: 6, jlpt: "N5" },
  { character: "白", meaning: "branco", onyomi: "ハク, ビャク", kunyomi: "しろ, しろい", strokeCount: 5, jlpt: "N5" },
  { character: "黒", meaning: "preto", onyomi: "コク", kunyomi: "くろ, くろい", strokeCount: 11, jlpt: "N5" },
  { character: "赤", meaning: "vermelho", onyomi: "セキ, シャク", kunyomi: "あか, あかい", strokeCount: 7, jlpt: "N5" },
  { character: "青", meaning: "azul", onyomi: "セイ, ショウ", kunyomi: "あお, あおい", strokeCount: 8, jlpt: "N5" },
  { character: "雨", meaning: "chuva", onyomi: "ウ", kunyomi: "あめ, あま", strokeCount: 8, jlpt: "N5" },
  { character: "天", meaning: "céu; paraíso", onyomi: "テン", kunyomi: "あめ, あま", strokeCount: 4, jlpt: "N5" },
  { character: "空", meaning: "céu; vazio", onyomi: "クウ", kunyomi: "そら, あく", strokeCount: 8, jlpt: "N5" },
  { character: "電", meaning: "eletricidade", onyomi: "デン", kunyomi: "", strokeCount: 13, jlpt: "N5" },
  { character: "車", meaning: "carro; veículo", onyomi: "シャ", kunyomi: "くるま", strokeCount: 7, jlpt: "N5" },
  { character: "駅", meaning: "estação", onyomi: "エキ", kunyomi: "", strokeCount: 14, jlpt: "N5" },
  { character: "国", meaning: "país", onyomi: "コク", kunyomi: "くに", strokeCount: 8, jlpt: "N5" },
  { character: "入", meaning: "entrar; inserir", onyomi: "ニュウ", kunyomi: "はいる, いる", strokeCount: 2, jlpt: "N5" },
  { character: "出", meaning: "sair; retirar", onyomi: "シュツ", kunyomi: "でる, だす", strokeCount: 5, jlpt: "N5" },
  { character: "間", meaning: "intervalo; entre", onyomi: "カン, ケン", kunyomi: "あいだ, ま", strokeCount: 12, jlpt: "N5" },
  { character: "円", meaning: "iene; círculo", onyomi: "エン", kunyomi: "まるい", strokeCount: 4, jlpt: "N5" },
  { character: "校", meaning: "escola", onyomi: "コウ", kunyomi: "", strokeCount: 10, jlpt: "N5" },
  { character: "語", meaning: "idioma; palavra", onyomi: "ゴ", kunyomi: "かたる", strokeCount: 14, jlpt: "N5" },
  { character: "話", meaning: "falar; conversa", onyomi: "ワ", kunyomi: "はなす, はなし", strokeCount: 13, jlpt: "N5" },
  { character: "読", meaning: "ler", onyomi: "ドク", kunyomi: "よむ", strokeCount: 14, jlpt: "N5" },
  { character: "書", meaning: "escrever; livro", onyomi: "ショ", kunyomi: "かく", strokeCount: 10, jlpt: "N5" },
  { character: "聞", meaning: "ouvir; perguntar", onyomi: "ブン, モン", kunyomi: "きく", strokeCount: 14, jlpt: "N5" },
  { character: "買", meaning: "comprar", onyomi: "バイ", kunyomi: "かう", strokeCount: 12, jlpt: "N5" },
  { character: "休", meaning: "descansar; folga", onyomi: "キュウ", kunyomi: "やすむ", strokeCount: 6, jlpt: "N5" },
  { character: "来", meaning: "vir; próximo", onyomi: "ライ", kunyomi: "くる", strokeCount: 7, jlpt: "N5" },
  { character: "会", meaning: "encontrar; reunião", onyomi: "カイ", kunyomi: "あう", strokeCount: 6, jlpt: "N5" },
  { character: "社", meaning: "empresa; santuário", onyomi: "シャ", kunyomi: "やしろ", strokeCount: 7, jlpt: "N5" },
  { character: "店", meaning: "loja", onyomi: "テン", kunyomi: "みせ", strokeCount: 8, jlpt: "N5" },
  { character: "道", meaning: "caminho; rua", onyomi: "ドウ, トウ", kunyomi: "みち", strokeCount: 12, jlpt: "N5" },
  { character: "花", meaning: "flor", onyomi: "カ", kunyomi: "はな", strokeCount: 7, jlpt: "N5" },
  { character: "魚", meaning: "peixe", onyomi: "ギョ", kunyomi: "さかな", strokeCount: 11, jlpt: "N5" },
  { character: "牛", meaning: "gado; vaca", onyomi: "ギュウ", kunyomi: "うし", strokeCount: 4, jlpt: "N5" },
  { character: "馬", meaning: "cavalo", onyomi: "バ", kunyomi: "うま", strokeCount: 10, jlpt: "N5" },
  { character: "犬", meaning: "cachorro", onyomi: "ケン", kunyomi: "いぬ", strokeCount: 4, jlpt: "N5" },
  { character: "鳥", meaning: "pássaro", onyomi: "チョウ", kunyomi: "とり", strokeCount: 11, jlpt: "N5" },
  { character: "名", meaning: "nome; reputação", onyomi: "メイ, ミョウ", kunyomi: "な", strokeCount: 6, jlpt: "N5" },
  { character: "物", meaning: "coisa; objeto", onyomi: "ブツ, モツ", kunyomi: "もの", strokeCount: 8, jlpt: "N5" },
  { character: "立", meaning: "ficar de pé; estabelecer", onyomi: "リツ, リュウ", kunyomi: "たつ", strokeCount: 5, jlpt: "N5" },
  { character: "多", meaning: "muito; numeroso", onyomi: "タ", kunyomi: "おおい", strokeCount: 6, jlpt: "N5" },
  { character: "少", meaning: "pouco; alguns", onyomi: "ショウ", kunyomi: "すくない, すこし", strokeCount: 4, jlpt: "N5" },
  { character: "新", meaning: "novo", onyomi: "シン", kunyomi: "あたらしい", strokeCount: 13, jlpt: "N5" },
  { character: "古", meaning: "antigo; velho", onyomi: "コ", kunyomi: "ふるい", strokeCount: 5, jlpt: "N5" },
  { character: "長", meaning: "longo; chefe", onyomi: "チョウ", kunyomi: "ながい", strokeCount: 8, jlpt: "N5" },
  { character: "安", meaning: "barato; seguro", onyomi: "アン", kunyomi: "やすい", strokeCount: 6, jlpt: "N5" },
  { character: "高", meaning: "alto; caro", onyomi: "コウ", kunyomi: "たかい", strokeCount: 10, jlpt: "N5" },
  { character: "左", meaning: "esquerda", onyomi: "サ", kunyomi: "ひだり", strokeCount: 5, jlpt: "N5" },
  { character: "右", meaning: "direita", onyomi: "ウ, ユウ", kunyomi: "みぎ", strokeCount: 5, jlpt: "N5" },
];

const examples: Record<string, { word: string; reading: string; meaning: string }[]> = {
  "日": [{ word: "日本", reading: "にほん", meaning: "Japão" }, { word: "毎日", reading: "まいにち", meaning: "todos os dias" }],
  "水": [{ word: "水曜日", reading: "すいようび", meaning: "quarta-feira" }, { word: "水道", reading: "すいどう", meaning: "abastecimento de água" }],
  "火": [{ word: "火曜日", reading: "かようび", meaning: "terça-feira" }, { word: "花火", reading: "はなび", meaning: "fogos de artifício" }],
  "学": [{ word: "学校", reading: "がっこう", meaning: "escola" }, { word: "学生", reading: "がくせい", meaning: "estudante" }],
  "食": [{ word: "食べ物", reading: "たべもの", meaning: "comida" }, { word: "食事", reading: "しょくじ", meaning: "refeição" }],
  "見": [{ word: "見る", reading: "みる", meaning: "ver" }, { word: "意見", reading: "いけん", meaning: "opinião" }],
  "行": [{ word: "行く", reading: "いく", meaning: "ir" }, { word: "銀行", reading: "ぎんこう", meaning: "banco" }],
  "木": [{ word: "木曜日", reading: "もくようび", meaning: "quinta-feira" }, { word: "木材", reading: "もくざい", meaning: "madeira" }],
  "山": [{ word: "火山", reading: "かざん", meaning: "vulcão" }, { word: "山道", reading: "やまみち", meaning: "trilha de montanha" }],
  "人": [{ word: "人間", reading: "にんげん", meaning: "ser humano" }, { word: "日本人", reading: "にほんじん", meaning: "japonês" }],
  "一": [{ word: "一つ", reading: "ひとつ", meaning: "um (objeto)" }, { word: "一人", reading: "ひとり", meaning: "uma pessoa" }],
  "二": [{ word: "二つ", reading: "ふたつ", meaning: "dois (objetos)" }, { word: "二人", reading: "ふたり", meaning: "duas pessoas" }],
  "三": [{ word: "三つ", reading: "みっつ", meaning: "três (objetos)" }, { word: "三日", reading: "みっか", meaning: "dia três; três dias" }],
  "四": [{ word: "四つ", reading: "よっつ", meaning: "quatro (objetos)" }, { word: "四月", reading: "しがつ", meaning: "abril" }],
  "五": [{ word: "五つ", reading: "いつつ", meaning: "cinco (objetos)" }, { word: "五時", reading: "ごじ", meaning: "cinco horas" }],
  "六": [{ word: "六つ", reading: "むっつ", meaning: "seis (objetos)" }, { word: "六日", reading: "むいか", meaning: "dia seis; seis dias" }],
  "七": [{ word: "七つ", reading: "ななつ", meaning: "sete (objetos)" }, { word: "七時", reading: "しちじ", meaning: "sete horas" }],
  "八": [{ word: "八つ", reading: "やっつ", meaning: "oito (objetos)" }, { word: "八月", reading: "はちがつ", meaning: "agosto" }],
  "九": [{ word: "九つ", reading: "ここのつ", meaning: "nove (objetos)" }, { word: "九月", reading: "くがつ", meaning: "setembro" }],
  "十": [{ word: "十", reading: "とお", meaning: "dez" }, { word: "十月", reading: "じゅうがつ", meaning: "outubro" }],
  "月": [{ word: "月", reading: "つき", meaning: "lua" }, { word: "月曜日", reading: "げつようび", meaning: "segunda-feira" }],
  "川": [{ word: "川", reading: "かわ", meaning: "rio" }, { word: "小川", reading: "おがわ", meaning: "riacho" }],
  "本": [{ word: "本", reading: "ほん", meaning: "livro" }, { word: "日本", reading: "にほん", meaning: "Japão" }],
  "中": [{ word: "中", reading: "なか", meaning: "dentro" }, { word: "中国", reading: "ちゅうごく", meaning: "China" }],
  "上": [{ word: "上", reading: "うえ", meaning: "acima" }, { word: "上手", reading: "じょうず", meaning: "habilidoso" }],
  "下": [{ word: "下", reading: "した", meaning: "abaixo" }, { word: "地下", reading: "ちか", meaning: "subsolo" }],
  "金": [{ word: "お金", reading: "おかね", meaning: "dinheiro" }, { word: "金曜日", reading: "きんようび", meaning: "sexta-feira" }],
  "土": [{ word: "土", reading: "つち", meaning: "terra" }, { word: "土曜日", reading: "どようび", meaning: "sábado" }],
  "年": [{ word: "今年", reading: "ことし", meaning: "este ano" }, { word: "来年", reading: "らいねん", meaning: "ano que vem" }],
  "大": [{ word: "大きい", reading: "おおきい", meaning: "grande" }, { word: "大学", reading: "だいがく", meaning: "universidade" }],
  "小": [{ word: "小さい", reading: "ちいさい", meaning: "pequeno" }, { word: "小学校", reading: "しょうがっこう", meaning: "escola primária" }],
  "今": [{ word: "今", reading: "いま", meaning: "agora" }, { word: "今日", reading: "きょう", meaning: "hoje" }],
  "口": [{ word: "口", reading: "くち", meaning: "boca" }, { word: "入口", reading: "いりぐち", meaning: "entrada" }],
  "目": [{ word: "目", reading: "め", meaning: "olho" }, { word: "目的", reading: "もくてき", meaning: "objetivo" }],
  "耳": [{ word: "耳", reading: "みみ", meaning: "orelha" }, { word: "耳鼻科", reading: "じびか", meaning: "otorrinolaringologia" }],
  "手": [{ word: "手", reading: "て", meaning: "mão" }, { word: "上手", reading: "じょうず", meaning: "habilidoso" }],
  "足": [{ word: "足", reading: "あし", meaning: "pé; perna" }, { word: "足りる", reading: "たりる", meaning: "ser suficiente" }],
  "力": [{ word: "力", reading: "ちから", meaning: "força" }, { word: "電力", reading: "でんりょく", meaning: "energia elétrica" }],
  "女": [{ word: "女の人", reading: "おんなのひと", meaning: "mulher" }, { word: "女子", reading: "じょし", meaning: "menina; mulher" }],
  "男": [{ word: "男の人", reading: "おとこのひと", meaning: "homem" }, { word: "男子", reading: "だんし", meaning: "menino; homem" }],
  "子": [{ word: "子ども", reading: "こども", meaning: "criança" }, { word: "女子", reading: "じょし", meaning: "menina; mulher" }],
  "父": [{ word: "父", reading: "ちち", meaning: "meu pai" }, { word: "お父さん", reading: "おとうさん", meaning: "pai" }],
  "母": [{ word: "母", reading: "はは", meaning: "minha mãe" }, { word: "お母さん", reading: "おかあさん", meaning: "mãe" }],
  "友": [{ word: "友だち", reading: "ともだち", meaning: "amigo" }, { word: "友人", reading: "ゆうじん", meaning: "amigo" }],
  "先": [{ word: "先生", reading: "せんせい", meaning: "professor" }, { word: "先週", reading: "せんしゅう", meaning: "semana passada" }],
  "生": [{ word: "学生", reading: "がくせい", meaning: "estudante" }, { word: "生まれる", reading: "うまれる", meaning: "nascer" }],
  "何": [{ word: "何", reading: "なに", meaning: "o que" }, { word: "何時", reading: "なんじ", meaning: "que horas" }],
  "時": [{ word: "時間", reading: "じかん", meaning: "tempo; hora" }, { word: "一時", reading: "いちじ", meaning: "uma hora" }],
  "分": [{ word: "五分", reading: "ごふん", meaning: "cinco minutos" }, { word: "分かる", reading: "わかる", meaning: "entender" }],
  "半": [{ word: "半分", reading: "はんぶん", meaning: "metade" }, { word: "一時半", reading: "いちじはん", meaning: "uma e meia" }],
  "前": [{ word: "前", reading: "まえ", meaning: "frente; antes" }, { word: "名前", reading: "なまえ", meaning: "nome" }],
  "後": [{ word: "後ろ", reading: "うしろ", meaning: "atrás" }, { word: "午後", reading: "ごご", meaning: "tarde; PM" }],
  "午": [{ word: "午前", reading: "ごぜん", meaning: "manhã; AM" }, { word: "午後", reading: "ごご", meaning: "tarde; PM" }],
  "毎": [{ word: "毎日", reading: "まいにち", meaning: "todos os dias" }, { word: "毎週", reading: "まいしゅう", meaning: "toda semana" }],
  "白": [{ word: "白い", reading: "しろい", meaning: "branco" }, { word: "白紙", reading: "はくし", meaning: "papel em branco" }],
  "黒": [{ word: "黒い", reading: "くろい", meaning: "preto" }, { word: "黒板", reading: "こくばん", meaning: "quadro-negro" }],
  "赤": [{ word: "赤い", reading: "あかい", meaning: "vermelho" }, { word: "赤ちゃん", reading: "あかちゃん", meaning: "bebê" }],
  "青": [{ word: "青い", reading: "あおい", meaning: "azul" }, { word: "青空", reading: "あおぞら", meaning: "céu azul" }],
  "雨": [{ word: "雨", reading: "あめ", meaning: "chuva" }, { word: "雨の日", reading: "あめのひ", meaning: "dia chuvoso" }],
  "天": [{ word: "天気", reading: "てんき", meaning: "tempo; clima" }, { word: "天国", reading: "てんごく", meaning: "paraíso" }],
  "空": [{ word: "空", reading: "そら", meaning: "céu" }, { word: "空気", reading: "くうき", meaning: "ar" }],
  "電": [{ word: "電気", reading: "でんき", meaning: "eletricidade" }, { word: "電車", reading: "でんしゃ", meaning: "trem elétrico" }],
  "車": [{ word: "車", reading: "くるま", meaning: "carro" }, { word: "電車", reading: "でんしゃ", meaning: "trem elétrico" }],
  "駅": [{ word: "駅", reading: "えき", meaning: "estação" }, { word: "駅前", reading: "えきまえ", meaning: "em frente à estação" }],
  "国": [{ word: "国", reading: "くに", meaning: "país" }, { word: "外国", reading: "がいこく", meaning: "país estrangeiro" }],
  "入": [{ word: "入る", reading: "はいる", meaning: "entrar" }, { word: "入口", reading: "いりぐち", meaning: "entrada" }],
  "出": [{ word: "出る", reading: "でる", meaning: "sair" }, { word: "出口", reading: "でぐち", meaning: "saída" }],
  "間": [{ word: "時間", reading: "じかん", meaning: "tempo; hora" }, { word: "間", reading: "あいだ", meaning: "entre" }],
  "円": [{ word: "百円", reading: "ひゃくえん", meaning: "cem ienes" }, { word: "円", reading: "えん", meaning: "iene" }],
  "校": [{ word: "学校", reading: "がっこう", meaning: "escola" }, { word: "高校", reading: "こうこう", meaning: "ensino médio" }],
  "語": [{ word: "日本語", reading: "にほんご", meaning: "língua japonesa" }, { word: "英語", reading: "えいご", meaning: "língua inglesa" }],
  "話": [{ word: "話す", reading: "はなす", meaning: "falar" }, { word: "電話", reading: "でんわ", meaning: "telefone" }],
  "読": [{ word: "読む", reading: "よむ", meaning: "ler" }, { word: "読書", reading: "どくしょ", meaning: "leitura" }],
  "書": [{ word: "書く", reading: "かく", meaning: "escrever" }, { word: "辞書", reading: "じしょ", meaning: "dicionário" }],
  "聞": [{ word: "聞く", reading: "きく", meaning: "ouvir; perguntar" }, { word: "新聞", reading: "しんぶん", meaning: "jornal" }],
  "買": [{ word: "買う", reading: "かう", meaning: "comprar" }, { word: "買い物", reading: "かいもの", meaning: "compras" }],
  "休": [{ word: "休む", reading: "やすむ", meaning: "descansar" }, { word: "休日", reading: "きゅうじつ", meaning: "feriado" }],
  "来": [{ word: "来る", reading: "くる", meaning: "vir" }, { word: "来年", reading: "らいねん", meaning: "próximo ano" }],
  "会": [{ word: "会う", reading: "あう", meaning: "encontrar" }, { word: "会社", reading: "かいしゃ", meaning: "empresa" }],
  "社": [{ word: "会社", reading: "かいしゃ", meaning: "empresa" }, { word: "社会", reading: "しゃかい", meaning: "sociedade" }],
  "店": [{ word: "店", reading: "みせ", meaning: "loja" }, { word: "店員", reading: "てんいん", meaning: "atendente" }],
  "道": [{ word: "道", reading: "みち", meaning: "caminho" }, { word: "道路", reading: "どうろ", meaning: "estrada" }],
  "花": [{ word: "花", reading: "はな", meaning: "flor" }, { word: "花火", reading: "はなび", meaning: "fogos de artifício" }],
  "魚": [{ word: "魚", reading: "さかな", meaning: "peixe" }, { word: "金魚", reading: "きんぎょ", meaning: "peixe-dourado" }],
  "牛": [{ word: "牛", reading: "うし", meaning: "gado; vaca" }, { word: "牛肉", reading: "ぎゅうにく", meaning: "carne bovina" }],
  "馬": [{ word: "馬", reading: "うま", meaning: "cavalo" }, { word: "馬車", reading: "ばしゃ", meaning: "carruagem" }],
  "犬": [{ word: "犬", reading: "いぬ", meaning: "cachorro" }, { word: "子犬", reading: "こいぬ", meaning: "filhote de cachorro" }],
  "鳥": [{ word: "鳥", reading: "とり", meaning: "pássaro" }, { word: "小鳥", reading: "ことり", meaning: "pássaro pequeno" }],
  "名": [{ word: "名前", reading: "なまえ", meaning: "nome" }, { word: "有名", reading: "ゆうめい", meaning: "famoso" }],
  "物": [{ word: "食べ物", reading: "たべもの", meaning: "comida" }, { word: "買い物", reading: "かいもの", meaning: "compras" }],
  "立": [{ word: "立つ", reading: "たつ", meaning: "ficar de pé" }, { word: "国立", reading: "こくりつ", meaning: "nacional" }],
  "多": [{ word: "多い", reading: "おおい", meaning: "muito; numeroso" }, { word: "多分", reading: "たぶん", meaning: "provavelmente" }],
  "少": [{ word: "少ない", reading: "すくない", meaning: "pouco" }, { word: "少し", reading: "すこし", meaning: "um pouco" }],
  "新": [{ word: "新しい", reading: "あたらしい", meaning: "novo" }, { word: "新聞", reading: "しんぶん", meaning: "jornal" }],
  "古": [{ word: "古い", reading: "ふるい", meaning: "antigo" }, { word: "中古", reading: "ちゅうこ", meaning: "usado" }],
  "長": [{ word: "長い", reading: "ながい", meaning: "longo" }, { word: "社長", reading: "しゃちょう", meaning: "presidente de empresa" }],
  "安": [{ word: "安い", reading: "やすい", meaning: "barato" }, { word: "安全", reading: "あんぜん", meaning: "segurança" }],
  "高": [{ word: "高い", reading: "たかい", meaning: "alto; caro" }, { word: "高校", reading: "こうこう", meaning: "ensino médio" }],
  "左": [{ word: "左", reading: "ひだり", meaning: "esquerda" }, { word: "左手", reading: "ひだりて", meaning: "mão esquerda" }],
  "右": [{ word: "右", reading: "みぎ", meaning: "direita" }, { word: "右手", reading: "みぎて", meaning: "mão direita" }],
};

function parseCsv(contents: string, fileName: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;

  for (let index = 0; index < contents.length; index += 1) {
    const character = contents[index];
    if (character === '"') {
      if (quoted && contents[index + 1] === '"') {
        field += '"';
        index += 1;
      } else {
        quoted = !quoted;
      }
    } else if (character === "," && !quoted) {
      row.push(field);
      field = "";
    } else if ((character === "\n" || character === "\r") && !quoted) {
      if (character === "\r" && contents[index + 1] === "\n") index += 1;
      row.push(field);
      if (row.some((value) => value.length > 0)) rows.push(row);
      row = [];
      field = "";
    } else {
      field += character;
    }
  }

  if (quoted) throw new Error(`O arquivo ${fileName} contém uma aspa CSV sem fechamento.`);
  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows;
}

function loadCatalog() {
  const catalog = new Map<string, {
    character: string;
    meaning: string;
    onyomi: string | null;
    kunyomi: string | null;
    strokeCount: number;
    jlpt: string;
    radical: string | null;
    examples: string;
    etymology: string | null;
    mnemonic: string | null;
    catalogOrder: number;
  }>();

  for (const level of ["n1", "n2", "n3", "n4", "n5"]) {
    const fileName = `kanji-${level}.csv`;
    const csv = readFileSync(new URL(`../../data/${fileName}`, import.meta.url), "utf8")
      .replace(/^\uFEFF/, "");
    const [header, ...records] = parseCsv(csv, fileName);
    const columns = new Map((header ?? []).map((column, index) => [column, index]));
    const requiredColumns = ["character", "level", "strokes", "radical", "onyomi", "kunyomi", "meanings"];
    if (requiredColumns.some((column) => !columns.has(column))) {
      throw new Error(`O CSV ${fileName} não contém todas as colunas necessárias.`);
    }

    for (const [index, record] of records.entries()) {
      const values = new Map([...columns].map(([column, columnIndex]) => [column, record[columnIndex] ?? ""]));
      const character = values.get("character")?.trim() ?? "";
      const strokes = Number(values.get("strokes"));
      const jlpt = values.get("level")?.trim() ?? "";
      const meaning = values.get("meanings")?.trim() ?? "";
      if (!character || !meaning || !Number.isInteger(strokes) || strokes < 1 || jlpt !== level.toUpperCase()) {
        throw new Error(`Registro inválido em ${fileName}, linha ${index + 2}.`);
      }
      catalog.set(character, {
        character,
        meaning: meaning.replace(/;\s*/g, ", "),
        onyomi: values.get("onyomi")?.trim().replace(/;\s*/g, ", ") || null,
        kunyomi: values.get("kunyomi")?.trim().replace(/;\s*/g, ", ") || null,
        strokeCount: strokes,
        jlpt,
        radical: values.get("radical")?.trim() || null,
        examples: JSON.stringify(examples[character] ?? []),
        etymology: null,
        mnemonic: null,
        catalogOrder: index,
      });
    }
  }

  for (const kanji of kanjis) {
    const fromCsv = catalog.get(kanji.character);
    const catalogOrder = fromCsv?.catalogOrder ??
      [...catalog.values()].filter((item) => item.jlpt === "N5").length;
    catalog.set(kanji.character, {
      ...fromCsv,
      ...kanji,
      jlpt: fromCsv?.jlpt ?? kanji.jlpt,
      radical: fromCsv?.radical ?? null,
      examples: JSON.stringify(examples[kanji.character] ?? []),
      etymology: null,
      mnemonic: null,
      catalogOrder,
    });
  }
  return catalog;
}

async function main() {
  const catalog = loadCatalog();
  for (const data of catalog.values()) {
    const update = { ...data };
    delete update.etymology;
    delete update.mnemonic;
    await prisma.kanji.upsert({
      where: { character: data.character },
      update,
      create: data,
    });
  }

  const seedAccounts = [
    { email: process.env.SEED_ADMIN_EMAIL, password: process.env.SEED_ADMIN_PASSWORD, role: "ADMIN" as const },
    { email: process.env.SEED_USER_EMAIL, password: process.env.SEED_USER_PASSWORD, role: "USER" as const },
  ];
  const configuredAccountValues = seedAccounts.flatMap(({ email, password }) => [email, password]);
  if (configuredAccountValues.some(Boolean)) {
    if (process.env.NODE_ENV === "production") {
      throw new Error("Contas de seed de desenvolvimento não podem ser criadas em produção.");
    }
    if (configuredAccountValues.some((value) => !value)) {
      throw new Error("Configure os quatro valores SEED_ADMIN_EMAIL, SEED_ADMIN_PASSWORD, SEED_USER_EMAIL e SEED_USER_PASSWORD.");
    }
    for (const account of seedAccounts) {
      const email = account.email!.trim().toLowerCase();
      const password = account.password!;
      if (!email.includes("@") || password.length < 12) {
        throw new Error("As contas do seed exigem e-mail válido e senhas com pelo menos 12 caracteres.");
      }
      const passwordHash = await bcrypt.hash(password, 12);
      await prisma.user.upsert({
        where: { email },
        update: { passwordHash, role: account.role },
        create: { email, passwordHash, role: account.role },
      });
    }
  }
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });