# KanjiSensei

Aplicativo Android para estudo de kanjis, com app React Native/Expo, API Node.js e banco SQLite com Prisma.

## Aplicativo Android

O projeto possui:

- `mobile/`: aplicativo React Native com Expo SDK 57, SQLite local e câmera com OCR japonês no dispositivo.
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
* Base de dados de Kanji
* Pesquisa e consulta de Kanji
* Reconhecimento por câmera
* Sistema de estudo e flashcards
* Quiz e avaliação
* Progresso e estatísticas
* Ordem de escrita

### Sprint 2

* Personalização do estudo
* Notificações e metas
* Recursos multimídia
* Recursos offline e sincronização
* Administração
* Backup e restauração

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

O catálogo inicial contém 32 kanjis JLPT N5, com exemplos e ordem de traços para consulta offline. Os caminhos de escrita adaptados de KanjiVG são licenciados CC BY-SA 3.0; veja [os créditos](mobile/assets/kanjivg-credits.md). A lista pode ser ampliada por seed/migração conforme novos níveis de estudo forem adicionados.

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

O aplicativo mobile apresenta as telas e conversa com o backend por HTTP. O backend concentra validações, autenticação e regras de negócio. O Prisma traduz as operações da API para o banco SQLite local. Essa separação permite trocar o banco ou conectar serviços externos sem colocar credenciais e regras sensíveis dentro do aplicativo.

Com o backend, o fluxo autenticado é:

```text
React Native/Expo -> API Express -> Prisma -> SQLite
```

Sem backend, o catálogo inicial, status de conhecimento, favoritos, revisões e histórico são guardados em SQLite no próprio Android. Cadastro/login e sincronização entre dispositivos requerem conexão com a API.

O arquivo `backend/src/app.ts` define a API para ser reutilizada pelos testes. O arquivo `backend/src/server.ts` apenas inicia a porta `3000` e encerra a conexão com o banco quando o processo termina.
