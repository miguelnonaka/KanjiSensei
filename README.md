# KanjiSensei

Aplicativo Android para estudo de kanjis, com app React Native/Expo, API Node.js e banco SQLite com Prisma.

## Aplicativo Android

O projeto possui:

- `mobile/`: aplicativo React Native com Expo SDK 57, SQLite local, OCR japonês pela câmera ou por imagem selecionada no dispositivo.
- `backend/`: API Express em TypeScript.
- `backend/prisma/schema.prisma`: modelo do banco.
- `backend/prisma/dev.db`: banco SQLite local, gerado pela migração.

## Backlog

O desenvolvimento do KanjiSensei está organizado em etapas, priorizando primeiro o núcleo funcional da aplicação e posteriormente recursos complementares.

### Principais funcionalidades

* **Autenticação:** cadastro, login e gerenciamento de sessão.
* **Kanji:** catálogo, níveis JLPT, pesquisa, filtros, radicais e detalhes.
* **Reconhecimento:** identificação de kanjis por câmera e escrita manual.
* **Estudo:** flashcards, repetição espaçada, histórico e favoritos.
* **Avaliação:** quizzes, dificuldades e estatísticas.
* **Progresso:** acompanhamento de kanjis aprendidos e evolução do usuário.
* **Personalização:** listas de estudo, metas e lembretes.
* **Multimídia:** pronúncia e ordem de escrita.
* **Offline e sincronização:** estudo offline e sincronização do progresso.
* **Administração:** gerenciamento de kanjis, usuários e permissões.
* **Qualidade:** segurança, desempenho, testes e preparação para publicação.

### Sprint 1

* Configuração e arquitetura
* Autenticação e usuários
* Base de dados de Kanji JLPT N1–N5 no backend
* Pesquisa e consulta de Kanji
* Reconhecimento por câmera
* Sistema de estudo e flashcards
* Quiz básico por significado, leitura e identificação do kanji
* Progresso e estatísticas
* Ordem de escrita

### Sprint 2

**Etapa 4 — Personalização:** busca por significado e radical, filtros JLPT e por traços, ordenação, kanjis difíceis com prioridade na revisão, listas de estudo, metas diárias, notificações locais de revisão e pronúncia japonesa.

**Etapa 5 — Administração e sincronização:** painel administrativo protegido por papel, CRUD do catálogo e gerenciamento de permissões no backend, estudo offline, fila de sincronização idempotente, backup/restauração por arquivo e backup/restauração associado à conta.

### Sprint 3

* Reconhecimento por escrita manual
* Quiz e estatísticas avançadas
* Recomendações de estudo
* Gráficos e tempo de estudo
* Lembretes
* Recursos de áudio
* Gamificação
* Recursos complementares
* Compartilhamento
* Relatórios
* Exportação
* Interface, acessibilidade e internacionalização
* Staging


### MVP

A primeira versão funcional prioriza:

1. Cadastro e login.
2. Banco e consulta de kanjis.
3. Pesquisa, lista e filtros por JLPT.
4. Detalhes e ordem de escrita.
5. Reconhecimento por câmera.
6. Flashcards e repetição espaçada.
7. Quiz.
8. Histórico, favoritos e progresso.
9. Backend e persistência de dados.
10. Autenticação, segurança, logs e testes.

As funcionalidades restantes serão implementadas posteriormente conforme a evolução do projeto. O backlog completo permanece separado para detalhamento das histórias de usuário e critérios de aceite.



## Executar o backend

```powershell
cd backend
Copy-Item .env.example .env -Force
npm.cmd install
npm.cmd run db:generate
npm.cmd run db:migrate -- --name init
npm.cmd run db:seed
npm.cmd run dev
```

API: `http://localhost:3000`

Verificação: `GET /health`

Para criar o primeiro administrador, configure `ADMIN_EMAILS` no `backend/.env` com o e-mail exato antes do cadastro (aceita vários e-mails separados por vírgula). O cadastro correspondente recebe o papel `ADMIN`; depois, administradores podem gerenciar permissões no painel do app.

Para criar contas locais pelo seed, preencha `SEED_ADMIN_EMAIL`, `SEED_ADMIN_PASSWORD`, `SEED_USER_EMAIL` e `SEED_USER_PASSWORD` em `backend/.env` antes de executar `npm.cmd run db:seed`. O seed atualiza essas duas contas em execuções posteriores, exige senhas com pelo menos 12 caracteres e recusa criar contas de seed quando `NODE_ENV=production`. Não use credenciais de desenvolvimento em produção.

Kanjis: `GET /api/kanjis`

Testes da API:

```powershell
cd backend
npm.cmd test
```

Os testes cobrem saúde da API, validação de cadastro, hash de senha, login, JWT, sessão e leitura dos kanjis persistidos.

O progresso autenticado fica associado ao usuário. Os endpoints `GET /api/me/kanjis`, `PUT /api/me/kanjis/:kanjiId` e `GET /api/me/reviews` exigem `Authorization: Bearer <token>`.

## Executar o mobile

O app pode estudar sem conexão. Para testar login e sincronização no telefone via USB, use dois terminais.

No primeiro terminal, inicie a API:

```powershell
cd backend
npm.cmd run dev
```

No segundo terminal, com o celular conectado e Depuração USB autorizada, gere e instale o APK:

```powershell
cd mobile
adb reverse tcp:3000 tcp:3000
$env:APP_VARIANT = "development"
$env:EXPO_PUBLIC_API_URL = "http://127.0.0.1:3000"
npx.cmd expo prebuild --platform android
.\build-apk.cmd
adb install -r .\android\app\build\outputs\apk\release\app-release.apk
```

O `prebuild` é necessário no primeiro build e após mudanças em plugins/configuração Android; feche builds Gradle antes de executá-lo. Para rebuilds sem mudanças nativas, use apenas `.\build-apk.cmd`. O encaminhamento USB mantém o app conectado ao serviço de estudos no computador.

Para produção, publique a API com HTTPS e configure `$env:APP_VARIANT = "production"` e `$env:EXPO_PUBLIC_API_URL = "https://SEU-DOMINIO"` antes do prebuild/build. O app recusa login sem uma URL configurada e o build de produção recusa HTTP.

Requisitos de build local: Node.js/npm, JDK 17, Android SDK/platform-tools e NDK `27.1.12297006` instalado pelo SDK Manager do Android Studio. O script compila somente `arm64-v8a`, o ABI do celular de teste conectado. O primeiro build baixa dependências Gradle. A câmera e o OCR ML Kit exigem esse binário nativo; Expo Go não inclui o módulo de OCR.

O Expo SDK 57 com React Native 0.86 gera `minSdk 24`; por isso não atende ao requisito legado Android API 21 sem trocar a stack nativa. Para produção, publique o backend e configure a URL HTTPS antes do build; o config plugin recusa `APP_VARIANT=production` sem HTTPS e mantém cleartext desativado.

## Dados do catálogo

A pasta `data/` contém os arquivos de kanji usados pelo seed do backend:

| Arquivo | Registros |
|---|---:|
| `kanji-n1.csv` | 1.345 |
| `kanji-n2.csv` | 398 |
| `kanji-n3.csv` | 387 |
| `kanji-n4.csv` | 169 |
| `kanji-n5.csv` | 84 |

Ao executar `npm.cmd run db:seed` em `backend/`, os cinco arquivos alimentam o catálogo remoto com 2.383 registros. O catálogo é organizado por nível JLPT (N5, N4, N3, N2, N1) e mantém, dentro de cada nível, a ordem de frequência/listagem do CSV. O seed também preserva informações revisadas manualmente para kanjis selecionados, incluindo exemplos. Os significados fornecidos nos CSVs estão em inglês. Os CSVs de vocabulário e gramática também estão na pasta, mas ainda não são importados pelo aplicativo.

O catálogo incluído diretamente no app para uso offline contém 100 kanjis N5 curados; ele é independente dos CSVs. Em **Perfil → Atualizar catálogo para uso offline**, qualquer usuário conectado pode baixar o catálogo remoto completo, que é armazenado no SQLite do aparelho para consultas posteriores sem conexão. Os CSVs não contêm etimologias nem mnemônicas; administradores podem preencher esses campos no painel, e o seed preserva os valores cadastrados.

O quiz permite escolher questões de significado, leitura ou identificação do caractere, com dificuldade básica (N5/N4), intermediária (N3) ou avançada (N2/N1). A opção “Escolher kanji” é de múltipla escolha; não substitui reconhecimento de escrita manual. Etimologia e mnemônica são campos opcionais preenchidos manualmente; recomenda-se registrar uma fonte para informações etimológicas.

Os caminhos de escrita adaptados de KanjiVG são licenciados CC BY-SA 3.0; veja [os créditos](mobile/assets/kanjivg-credits.md).

## Espelhar no Linux com scrcpy

No Linux, instale `adb` e `scrcpy` (em Ubuntu/Debian: `sudo apt install adb scrcpy`), ative Depuração USB no Android, conecte-o e autorize a chave RSA. Copie o APK para o Linux e instale/espelhe:

```bash
adb install -r app-release.apk
bash mobile/mirror-android.sh
```

O script usa o primeiro dispositivo ADB autorizado; passe um serial como primeiro argumento se houver mais de um. Para usar Wi-Fi, conecte o aparelho e o Linux à mesma rede, execute `adb tcpip 5555`, `adb connect IP_DO_CELULAR:5555` e então rode o script. scrcpy espelha a tela e encaminha interação; não é uma dependência dentro do aplicativo.

## Banco

Para abrir o banco visualmente:

```powershell
cd backend
npm.cmd run db:studio
```

O arquivo local `backend/prisma/dev.db` e o `.env` não devem ser enviados ao repositório.

## Arquitetura

O aplicativo mobile apresenta as telas e conversa com o backend por HTTP. O backend concentra validações, autenticação e regras de negócio. O Prisma traduz as operações da API para o SQLite do backend. Essa separação permite trocar o banco ou conectar serviços externos sem colocar credenciais e regras sensíveis dentro do aplicativo.

O backlog não exige Firebase: a US03 pede persistência de usuários, kanjis e dados de estudo; as US46/US47 pedem operação offline e sincronização. O SQLite do aparelho deve permanecer para o modo offline. O SQLite do backend é a configuração atual do projeto; para uma implantação multi-instância, avalie migrar apenas o banco do servidor para PostgreSQL, preservando a API e o armazenamento offline.

Com o backend, o fluxo autenticado é:

```text
React Native/Expo -> API Express -> Prisma -> SQLite
```

O app inclui 100 kanjis N5 no primeiro uso. Enquanto estiver conectado, use **Perfil → Atualizar catálogo para uso offline** para baixar o catálogo remoto completo para o SQLite do aparelho; a tela mostra a quantidade salva e quando foi atualizado. Depois do download, catálogo e estudos continuam acessíveis sem internet. Cadastro/login e sincronização entre dispositivos ainda requerem conexão com a API.

O progresso, quizzes, listas e metas feitos sem conexão por um perfil de conta são enfileirados no aparelho e sincronizados quando a conexão retorna. O modo convidado salva os estudos localmente, sem sincronizá-los com uma conta. O app oferece exportação/restauração de backup JSON pelo seletor/compartilhamento do Android; contas também podem guardar e restaurar snapshots no backend. Notificações locais de revisão usam o horário das 9h do aparelho.

O arquivo `backend/src/app.ts` define a API para ser reutilizada pelos testes. O arquivo `backend/src/server.ts` apenas inicia a porta `3000` e encerra a conexão com o banco quando o processo termina.
