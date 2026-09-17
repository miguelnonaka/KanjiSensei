# KanjiSensei

Aplicativo Android para estudo de kanjis, com app React Native/Expo, API Node.js e banco SQLite com Prisma.

## Épico 1

O projeto possui:

- `mobile/`: aplicativo React Native com Expo SDK 57.
- `backend/`: API Express em TypeScript.
- `backend/prisma/schema.prisma`: modelo do banco.
- `backend/prisma/dev.db`: banco SQLite local, gerado pela migração.

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

## Executar o mobile

Em outro terminal:

```powershell
cd mobile
npm.cmd install
npm.cmd start
```

No emulador Android, o app usa `10.0.2.2` para acessar o computador. Em um aparelho físico, substitua esse endereço pelo IP local da máquina em `mobile/App.tsx`.

## Banco

Para abrir o banco visualmente:

```powershell
cd backend
npm.cmd run db:studio
```

O arquivo local `backend/prisma/dev.db` e o `.env` não devem ser enviados ao repositório.

## Arquitetura

O aplicativo mobile apresenta as telas e conversa com o backend por HTTP. O backend concentra validações, autenticação e regras de negócio. O Prisma traduz as operações da API para o banco SQLite local. Essa separação permite trocar o banco ou conectar serviços externos sem colocar credenciais e regras sensíveis dentro do aplicativo.

Em desenvolvimento, o fluxo é:

```text
React Native/Expo -> API Express -> Prisma -> SQLite
```

O arquivo `backend/src/app.ts` define a API para ser reutilizada pelos testes. O arquivo `backend/src/server.ts` apenas inicia a porta `3000` e encerra a conexão com o banco quando o processo termina.