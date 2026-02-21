# Task Manager

Sistema web de gerenciamento de tarefas em equipe, feito para trabalho de faculdade.

## O que o sistema faz

O Task Manager organiza o trabalho por projetos, com quadro Kanban e controle de permissoes.

Fluxo principal:

1. usuario cria conta e faz login;
2. entra na tela de projetos vinculados;
3. abre um projeto e acompanha os itens em colunas;
4. comenta no projeto e nos itens;
5. move itens de status e conclui definitivamente quando necessario.

## Tecnologias

- Backend: Node.js + Express
- Banco: SQLite
- Frontend: HTML + CSS + JavaScript (vanilla)
- Autenticacao: JWT

## Como executar

1. Instalar dependencias:

```bash
npm install
```

2. Copiar variaveis de ambiente (opcional):

```bash
copy .env.example .env
```

3. Iniciar servidor:

```bash
npm start
```

4. Acessar:

```text
http://localhost:3000/login
```

## Rotas de tela

- `/login` - login
- `/register` - cadastro
- `/app` - dashboard de projetos
- `/project?projectId=<id>` - quadro do projeto (kanban, comentarios e configuracoes)
- `/project-create` - criacao de projeto

## Perfis e permissoes

### Admin do projeto

- editar nome e descricao do projeto;
- adicionar, remover e alterar papel de membros;
- criar, editar e remover itens;
- alterar responsavel dos itens;
- comentar e moderar comentarios (pode remover comentarios de outros usuarios).

### Membro do projeto

- visualizar projeto e itens;
- criar e mover itens;
- comentar no projeto e nos itens;
- editar/remover apenas os proprios comentarios.

## Regras de validacao

### Cadastro

- nome completo com minimo de 15 caracteres;
- e-mail em formato valido;
- senha com pelo menos 1 letra maiuscula, 1 numero e 1 caractere especial;
- bloqueio de e-mail e nome duplicados.

### Projeto

- nome nao pode ser duplicado;
- descricao com minimo de 30 caracteres.

### Item

- titulo com minimo de 15 caracteres;
- descricao com minimo de 30 caracteres.

### Comentario

- minimo de 20 caracteres;
- tipos: `anotacao`, `melhoria`, `bug`, `bloqueado`.

## Funcionalidades implementadas

- login e cadastro em telas separadas;
- dashboard com cards de projetos vinculados;
- menu de 3 pontos no card do projeto (configuracoes e excluir);
- configuracoes do projeto direto no dashboard, sem redirecionar para dentro do projeto;
- modal de confirmacao para excluir projeto;
- modal de confirmacao para remover membro do projeto (dashboard e tela interna do projeto);
- quadro Kanban com drag and drop;
- criacao de item por coluna;
- menu de 3 pontos no card do item (editar e excluir);
- modal de confirmacao para excluir item;
- edicao de item (titulo, descricao, responsavel e status);
- modal de confirmacao ao mover para `Concluido` ou concluir definitivamente itens com flags `bug` e/ou `bloqueado`;
- finalizacao definitiva de item com envio para historico;
- comentarios no projeto e no item com tipo e horario;
- edicao inline de comentarios (sem prompt nativo do navegador);
- marcacao visual no card quando existe comentario de `bug` ou `bloqueado`;
- acoes com `aria-label` e `title` para acessibilidade.

## Endpoints principais

### Auth

- `POST /api/auth/register`
- `POST /api/auth/login`

### Projetos

- `GET /api/projects`
- `POST /api/projects`
- `GET /api/projects/:projectId`
- `PATCH /api/projects/:projectId`
- `DELETE /api/projects/:projectId`
- `POST /api/projects/:projectId/members`
- `PATCH /api/projects/:projectId/members/:userId`
- `DELETE /api/projects/:projectId/members/:userId`
- `GET /api/projects/:projectId/comments`
- `POST /api/projects/:projectId/comments`
- `PATCH /api/projects/:projectId/comments/:commentId`
- `DELETE /api/projects/:projectId/comments/:commentId`

### Itens

- `GET /api/tasks?projectId=1`
- `GET /api/tasks/history?projectId=1`
- `POST /api/tasks`
- `PATCH /api/tasks/:taskId`
- `DELETE /api/tasks/:taskId`
- `GET /api/tasks/:taskId/comments`
- `POST /api/tasks/:taskId/comments`
- `PATCH /api/tasks/:taskId/comments/:commentId`
- `DELETE /api/tasks/:taskId/comments/:commentId`

## Estrutura de pastas

```text
.
|-- public
|   |-- app.html / app.js
|   |-- project.html / project.js
|   |-- login.html / login.js
|   |-- register.html / register.js
|   |-- project-create.html / project-create.js
|   |-- styles.css
|   `-- form-feedback.js
|-- src
|   |-- server.js
|   |-- db.js
|   `-- middleware/auth.js
`-- database.sqlite
```
