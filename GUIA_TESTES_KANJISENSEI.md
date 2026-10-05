# Guia local do KanjiSensei

Este guia é para desenvolvimento e demonstração local. Ele fica fora do Git por escolha do projeto; copie os passos para uso próprio neste workspace.

## Resumo do aplicativo

O KanjiSensei é um app Android em React Native/Expo para aprender kanjis. A Sprint 1 inclui:

- Conta, login e sessão pelo serviço Node/Express.
- Catálogo local e remoto com 32 kanjis N5, busca, leituras, exemplos e ordem de traços.
- Câmera com OCR japonês no próprio telefone.
- Favoritos, status de aprendizado, flashcards, repetição espaçada, quiz, histórico e progresso.
- SQLite no aparelho para continuar estudando sem conexão.

Não há Firebase nesta versão. O serviço de conta e sincronização é o backend Node/Prisma.

## Requisitos

- Node.js e npm.
- JDK 17 e Android SDK.
- Android NDK `27.1.12297006`.
- Um telefone Android com Depuração USB ativada, cabo de dados e autorização ADB aceita.
- Não é necessário iniciar emulador. A build é somente para `arm64-v8a`.

## Primeira configuração

Abra dois terminais PowerShell na raiz do repositório.

No primeiro, prepare e inicie o backend. Preserve um `.env` existente; copie o exemplo somente se ainda não houver um:

```powershell
cd backend
if (-not (Test-Path .env)) { Copy-Item .env.example .env }
npm.cmd install
npm.cmd run db:generate
npm.cmd run db:migrate
npm.cmd run db:seed
npm.cmd run dev
```

Confirme que a API iniciou:

```powershell
Invoke-RestMethod http://127.0.0.1:3000/health
```

Deve retornar `status: ok`.

No segundo terminal, confirme e conecte o telefone:

```powershell
adb devices
adb reverse tcp:3000 tcp:3000
```

O aparelho deve aparecer como `device`, não `unauthorized`. Se pedir autorização, aceite a solicitação no telefone.

Configure a variante local, gere o projeto Android e compile/instale:

```powershell
cd mobile
$env:APP_VARIANT = "development"
$env:EXPO_PUBLIC_API_URL = "http://127.0.0.1:3000"
npx.cmd expo prebuild --platform android
.\build-apk.cmd
adb install -r .\android\app\build\outputs\apk\release\app-release.apk
adb shell monkey -p com.kanjisensei.app 1
```

`adb reverse` precisa ser refeito após reconectar o telefone. `adb install -r` atualiza o app sem desinstalá-lo e preserva os dados locais. Mantenha o backend rodando durante login e sincronização.

Execute `npx.cmd expo prebuild --platform android` no primeiro build e após mudanças em plugins/configuração Android ou módulos nativos. Feche uma compilação Gradle anterior antes do prebuild. Para mudanças apenas em JavaScript/TypeScript, use `build-apk.cmd` diretamente.

## Rotina ao mudar o app

1. Backend: execute `npm.cmd test` e `npm.cmd run build` em `backend/`.
2. Se alterar `schema.prisma`, crie/aplique uma migração com `npm.cmd run db:migrate -- --name descricao_curta`; confirme o Prisma Client com `npm.cmd run db:generate`.
3. Se alterar o seed, rode `npm.cmd run db:seed` e confirme `GET /api/kanjis`.
4. Mobile: execute `node_modules\.bin\tsc.cmd --noEmit` e `node_modules\.bin\expo.cmd install --check` em `mobile/`.
5. Para testar no telefone, confirme `adb devices`, refaça `adb reverse tcp:3000 tcp:3000`, defina as duas variáveis de desenvolvimento acima, compile e instale com `adb install -r`.
6. Valide o fluxo tocado: login/cadastro; busca por kanji, leitura e JLPT; exemplos e traços; favorito/status; flashcard/quiz; atividade recente; câmera apontada a um kanji de alto contraste; modo offline com a rede desligada.

Para testar as rotas sem telefone, `npm.cmd test` usa a suíte Supertest em `backend/test/api.test.ts`. A API responde em `http://127.0.0.1:3000`; os endpoints de conta exigem token.

## Espelhar no Linux

Para mostrar o telefone com scrcpy no Linux, instale `adb` e `scrcpy`, ative Depuração USB, conecte o cabo e aceite a chave RSA. Com o APK copiado para o Linux:

```bash
adb install -r app-release.apk
bash mobile/mirror-android.sh
```

O script seleciona o primeiro telefone autorizado; para vários aparelhos, informe o serial. O computador que executa o backend também precisa estar acessível ao telefone para login.

## Limites conhecidos

- Expo SDK 57 / React Native 0.86 define `minSdk 24`; isso não satisfaz Android API 21. Baixar esse mínimo exige trocar a versão da stack nativa e validar novamente os módulos.
- Builds de desenvolvimento usam HTTP somente com `APP_VARIANT=development` e a ponte ADB. Para produção, publique o backend com HTTPS e defina `APP_VARIANT=production` e `EXPO_PUBLIC_API_URL` com o domínio HTTPS; o build de produção recusa HTTP.
- O catálogo atual tem 32 kanjis N5. Outros níveis ainda precisam ser adicionados ao seed e ao catálogo embarcado.
- Firebase não faz parte da Sprint 1 deste projeto.
