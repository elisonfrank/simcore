# SimCore — Guia para Claude

Repo: https://github.com/elisonfrank/simcore — open-source social simulation engine com agentes LLM.

## Stack
Python 3.11+ (FastAPI+WebSocket, LiteLLM, Click CLI, SQLite, Pydantic, Jinja2) | React+Vite (Leaflet com CartoDB dark tiles) | YAML configs

## Estrutura
```
simcore/        engine, agents, world, llm, config, storage, server (Python package)
dashboard/      React+Vite frontend
scenarios/      YAMLs: marketplace, city, epidemic, school
tests/          21 tests, todos passando
```

## Como rodar
**Backend**: `python -m simcore.cli run scenarios/marketplace/config.yaml --dashboard --speed 5.0 --port 8420`
- Adicione `--demo` para usar `MockLLMProvider` (sem API key)
- Sem `--demo` usa LiteLLM (Ollama local com `ollama/llama3.2:3b` ou cloud com `OPENAI_API_KEY`)

**Frontend**: `cd dashboard && npm run dev` → http://localhost:5173

## Decisões de arquitetura importantes
- **Mapa real (não grid)**: cada local do cenário é resolvido a um POI real do OSM via Overpass API, ancorado na cidade do usuário (geolocation → Nominatim → Overpass). Cache em localStorage com versão (`simcore:osm:vN:...`) — bump quando mudar lógica.
- **i18n**: `dashboard/src/lib/i18n.jsx` com PT/EN. Backend tem `language_directive()` em `simcore/llm/prompts.py` que injeta no prompt da LLM. YAML aceita `simulation.language: pt`.
- **Parallel-tick**: todos os agentes decidem em paralelo via `asyncio.gather`. Resultado: agentes podem se cumprimentar mutuamente no mesmo tick (não bug, é feature).
- **Cache LLM**: `simcore/llm/cache.py` cache por hash de prompt. Pode causar repetição de respostas — para variedade, desabilitar com `cache: false` no YAML.

## Convenções
- **Não fazer push automaticamente** sem o user confirmar
- **Não rodar destrutivos** (rm -rf, force-push) sem confirmação
- **Conversação em PT** quando user fala PT
- **Frases curtas, ferramentas primeiro** — user prefere economia de palavras
- **Custo de tokens importa** — fazer edits focados, evitar Read desnecessário, preferir 1 tool call por turno quando possível

## Dívidas técnicas conhecidas
Ver `~/.claude/projects/d--Projetos-atlas/memory/project_simcore.md` (auto-memory) para lista completa.

Principais pendentes:
1. **Mood/energy estáticos**: `InteractionResolver` atualiza `relationships` mas não mexe em `state.mood/energy`. Post-mortem mostra 0.00 / 0% sempre.
2. **Tradução de eventos YAML**: hardcoded por idioma — devia traduzir on-the-fly via LLM se `config.language ≠ idioma do YAML`.
3. **Saudações repetitivas em modelos pequenos** (llama3.2:3b): limite do modelo, não fix de prompt resolve. Usar 7B+ para demos.

## Próximas features priorizadas
1. **Narrativa LLM no post-mortem** (`#5` no backlog): substituir lista de momentos por parágrafo gerado pela LLM resumindo a "história" da semana. Backend endpoint novo `POST /api/postmortem/narrative`. Frontend mostra como hero do PostMortem.jsx.
2. **Breaking moment banner**: durante a sim, banner aparece quando algo significativo rola.
3. **Avatares reais nos agentes** (deferred pelo user, "embelezamento").

## Testes
`pytest` na raiz. 21 tests, todos passando. Manter passando após mudanças.