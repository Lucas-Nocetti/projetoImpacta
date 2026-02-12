# Task Manager

Sistema web para gerenciamento de tarefas em equipe, desenvolvido como projeto de faculdade.

## Visão geral

O projeto foi construído com foco em um fluxo simples de uso:

1. usuário cria conta e faz login;
2. cria ou acessa projetos em que participa;
3. organiza itens do projeto em um quadro Kanban (`A fazer`, `Fazendo`, `Concluído`);
4. comenta nos itens e no projeto;
5. finaliza itens e consulta histórico de concluídos.

Também existe controle de perfil por projeto:

- `admin`: gerencia configurações e membros;
- `member`: atua nas tarefas e comentários.

## Tecnologias utilizadas

- **Backend:** Node.js + Express
- **Banco de dados:** SQLite
- **Frontend:** HTML, CSS e JavaScript (vanilla)
- **Autenticação:** JWT

## Como executar

1. Instalar dependências:

```bash
npm install
```

2. (Opcional) criar arquivo de ambiente:

```bash
copy .env.example .env
```

3. Iniciar aplicação:

```bash
npm start
```

4. Acessar no navegador:

```text
http://localhost:3000/login
```

## Fluxo de telas

- `/login` - autenticação de usuário
- `/register` - cadastro de novo usuário
- `/app` - listagem de projetos vinculados ao usuário
- `/project?projectId=<id>` - quadro Kanban, comentários e gerenciamento do projeto
- `/project-create` - criação de novo projeto

## Regras de permissão

### Admin do projeto

- editar nome e descrição do projeto;
- adicionar/remover membros;
- alterar papel de membros (`admin` / `member`);
- realizar todas as ações de membro.

### Membro do projeto

- visualizar projeto e quadro Kanban;
- criar itens;
- mover status dos itens;
- comentar em itens e no projeto.

## Regras de negócio principais

- **Cadastro**
  - nome completo com mínimo de 15 caracteres;
  - e-mail em formato válido;
  - senha com ao menos 1 maiúscula, 1 número e 1 caractere especial;
  - bloqueio de e-mail e nome já cadastrados.

- **Projeto**
  - nome não pode ser duplicado;
  - descrição com mínimo de 30 caracteres.

- **Item**
  - título com mínimo de 15 caracteres;
  - descrição com mínimo de 30 caracteres.

- **Comentários**
  - mínimo de 20 caracteres.

- **Finalização**
  - ao clicar em `Concluir` em um item da coluna `Concluído`, ele sai do quadro;
  - o item aparece no histórico de concluídos;
  - somente itens com ação explícita de `Concluir` entram no histórico.

## Endpoints principais

### Auth

- `POST /api/auth/register`
- `POST /api/auth/login`

### Projetos

- `GET /api/projects`
- `POST /api/projects`
- `GET /api/projects/:projectId`
- `PATCH /api/projects/:projectId` (admin)
- `POST /api/projects/:projectId/members` (admin)
- `PATCH /api/projects/:projectId/members/:userId` (admin)
- `DELETE /api/projects/:projectId/members/:userId` (admin)
- `GET /api/projects/:projectId/comments`
- `POST /api/projects/:projectId/comments`

### Itens (tarefas)

- `GET /api/tasks?projectId=1`
- `GET /api/tasks/history?projectId=1`
- `POST /api/tasks`
- `PATCH /api/tasks/:taskId`
- `GET /api/tasks/:taskId/comments`
- `POST /api/tasks/:taskId/comments`

## Estrutura de pastas (resumo)

```text
.
├── public
│   ├── app.html / app.js
│   ├── project.html / project.js
│   ├── login.html / login.js
│   ├── register.html / register.js
│   ├── project-create.html / project-create.js
│   ├── styles.css
│   └── form-feedback.js
├── src
│   ├── server.js
│   ├── db.js
│   └── middleware/auth.js
└── database.sqlite
```
