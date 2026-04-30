import { createContext, useContext, useState, useEffect, useMemo } from 'react';

const DICTIONARIES = {
  en: {
    // Header
    'header.live': 'LIVE',
    'header.offline': 'OFFLINE',
    'header.locating': 'Locating...',
    'header.mapping': 'mapping...',
    'header.agents': 'Agents',
    'header.llm': 'LLM',
    'header.cache': 'Cache',
    'header.changeLocation': 'Change location',

    // Location input
    'location.placeholder': 'Type a city or address...',
    'location.hint': 'Press Enter to search',

    // Panels
    'panel.agents': 'Agents',
    'panel.activity': 'Activity',
    'panel.waitingActivity': 'Waiting for activity...',
    'panel.close': 'Close',

    // Agent inspector
    'inspector.vitals': 'Vitals',
    'inspector.mood': 'Mood',
    'inspector.energy': 'Energy',
    'inspector.personality': 'Personality',
    'inspector.personality.openness': 'Openness',
    'inspector.personality.conscientiousness': 'Conscientiousness',
    'inspector.personality.extraversion': 'Extraversion',
    'inspector.personality.agreeableness': 'Agreeableness',
    'inspector.personality.neuroticism': 'Neuroticism',
    'inspector.goals': 'Goals',
    'inspector.resources': 'Resources',
    'inspector.relationships': 'Relationships',
    'inspector.activity': 'Activity',

    // Event injector
    'injector.title': 'Inject Event',
    'injector.placeholder': 'A storm rolls in. An argument breaks out...',
    'injector.everywhere': 'Everywhere',
    'injector.button': 'Inject',

    // Loading
    'loading.waiting': 'Waiting for simulation...',

    // Timeline
    'timeline.pause': 'Pause',
    'timeline.resume': 'Resume',
    'timeline.stop': 'Stop',

    // Location types
    'locType.commercial': 'commercial',
    'locType.residential': 'residential',
    'locType.leisure': 'leisure',
    'locType.government': 'government',
    'locType.administrative': 'administrative',
    'locType.education': 'education',
    'locType.healthcare': 'healthcare',
    'locType.social': 'social',
    'locType.agricultural': 'agricultural',
    'locType.recreation': 'recreation',
    'locType.virtual': 'virtual',

    // Clock prefix (parsed from "Day N, HH:MM")
    'clock.day': 'Day',

    // Action patterns (from backend Action.describe())
    'action.rests': 'rests',
    'action.waits': 'waits',
    'action.interaction': 'interaction',
    'action.saysTo': 'says to {target}: "{content}"',
    'action.movesTo': 'moves to {target}',
    'action.tradesWith': 'trades with {target}: {content}',
    'action.interactsWith': 'interacts with {target}',
    'action.works': 'works: {content}',
    'action.worksGeneric': 'works',
    'action.observes': 'observes the surroundings',
    'action.does': 'does: {content}',
    'action.xSaysTo': '{source} says to {target}: "{content}"',
    'action.xTradesWith': '{source} trades with {target}: {content}',
    'action.xInteractsWith': '{source} interacts with {target}',

    // Location names (scenarios)
    'location.Town Square': 'Town Square',
    'location.Electronics District': 'Electronics District',
    'location.Food Market': 'Food Market',
    'location.Residential North': 'Residential North',
    'location.Residential South': 'Residential South',
    'location.Park': 'Park',
    'location.City Hall': 'City Hall',
    'location.Downtown Office': 'Downtown Office',
    'location.University Campus': 'University Campus',
    'location.Hospital': 'Hospital',
    'location.Central Park': 'Central Park',
    'location.Cafe District': 'Cafe District',
    'location.Suburbs East': 'Suburbs East',
    'location.Apartment Complex': 'Apartment Complex',
    'location.Town Clinic': 'Town Clinic',
    'location.General Store': 'General Store',
    'location.Community Church': 'Community Church',
    'location.Farm District': 'Farm District',
    'location.School': 'School',
    'location.Residential Quarter': 'Residential Quarter',
    'location.Town Hall': 'Town Hall',
    'location.Main Hallway': 'Main Hallway',
    'location.Cafeteria': 'Cafeteria',
    'location.Library': 'Library',
    'location.Sports Field': 'Sports Field',
    'location.Art Room': 'Art Room',
    'location.Principal\'s Office': "Principal's Office",

    // Breaking moment banner
    'banner.scheduledEvent': 'World event',
    'banner.injectedEvent': 'Injected event',
    'banner.interaction': 'Interaction',
    'banner.event': 'Event',

    // Scenario library
    'scenario.subtitle': 'Choose a scenario to run',
    'scenario.new': 'New Scenario',
    'scenario.builtin': 'Built-in scenarios',
    'scenario.mine': 'My scenarios',
    'scenario.run': 'Run',
    'scenario.runDemo': 'Demo',
    'scenario.runLLM': 'LLM',
    'scenario.delete': 'Delete',
    'scenario.agents': 'agents',
    'scenario.locations': 'locations',
    'scenario.empty': 'No scenarios found.',
    'scenario.browse': 'Scenarios',
    'duration.day': 'day',
    'duration.days': 'days',
    'duration.hour': 'hour',
    'duration.hours': 'hours',

    // Scenario wizard
    'wizard.title': 'New Scenario',
    'wizard.titleEdit': 'Edit Scenario',
    'wizard.step.info': 'Info',
    'wizard.step.locations': 'Locations',
    'wizard.step.agents': 'Agents',
    'wizard.step.events': 'Events',
    'wizard.back': 'Back',
    'wizard.next': 'Next',
    'wizard.cancel': 'Cancel',
    'wizard.create': 'Create',
    'wizard.save': 'Save',
    'wizard.addLocation': 'Add Location',
    'wizard.addAgent': 'Add Agent',
    'wizard.addEvent': 'Add Event',
    'wizard.addGoal': 'Add goal',
    'wizard.location.unnamed': 'Unnamed location',
    'wizard.agent.unnamed': 'Unnamed agent',
    'wizard.hint.locations': 'Add the places agents will inhabit — clinic, square, school, etc.',
    'wizard.hint.agents': 'Add the people who will interact in this simulation.',
    'wizard.hint.events': 'Optional: schedule world events at specific ticks to drive the story.',
    'wizard.field.name': 'Name',
    'wizard.field.description': 'Description',
    'wizard.field.language': 'Language',
    'wizard.field.duration': 'Duration',
    'wizard.field.seed': 'Seed',
    'wizard.field.temperature': 'Temperature',
    'wizard.field.age': 'Age',
    'wizard.field.profession': 'Profession',
    'wizard.field.startLocation': 'Starting location',
    'wizard.field.backstory': 'Backstory',
    'wizard.field.goals': 'Goals',
    'wizard.field.personality': 'Personality (OCEAN)',
    'wizard.field.tick': 'Tick',

    // Post-mortem
    'postmortem.title': 'Simulation complete',
    'postmortem.subtitle': 'What happened during these {ticks} ticks',
    'postmortem.arcs': 'Agent arcs',
    'postmortem.arcs.moodChange': 'Mood change',
    'postmortem.arcs.energyFinal': 'Final energy',
    'postmortem.relationships': 'Relationships formed',
    'postmortem.noRelationships': 'No relationships formed',
    'postmortem.keyMoments': 'Key moments',
    'postmortem.noMoments': 'No notable events',
    'postmortem.stats': 'Statistics',
    'postmortem.stats.totalActions': 'Total actions',
    'postmortem.stats.interactions': 'Interactions',
    'postmortem.stats.llmCalls': 'LLM calls',
    'postmortem.stats.cacheRate': 'Cache hit rate',
    'postmortem.narrative': 'The story',
    'postmortem.narrative.loading': 'Generating narrative...',
    'postmortem.narrative.unavailable': 'Narrative unavailable.',
    'postmortem.close': 'Close',
    'postmortem.replay': 'Replay',
  },
  pt: {
    // Header
    'header.live': 'AO VIVO',
    'header.offline': 'DESCONECTADO',
    'header.locating': 'Localizando...',
    'header.mapping': 'mapeando...',
    'header.agents': 'Agentes',
    'header.llm': 'LLM',
    'header.cache': 'Cache',
    'header.changeLocation': 'Alterar localização',

    // Location input
    'location.placeholder': 'Digite uma cidade ou endereço...',
    'location.hint': 'Pressione Enter para buscar',

    // Panels
    'panel.agents': 'Agentes',
    'panel.activity': 'Atividade',
    'panel.waitingActivity': 'Aguardando atividade...',
    'panel.close': 'Fechar',

    // Agent inspector
    'inspector.vitals': 'Sinais vitais',
    'inspector.mood': 'Humor',
    'inspector.energy': 'Energia',
    'inspector.personality': 'Personalidade',
    'inspector.personality.openness': 'Abertura',
    'inspector.personality.conscientiousness': 'Conscienciosidade',
    'inspector.personality.extraversion': 'Extroversão',
    'inspector.personality.agreeableness': 'Amabilidade',
    'inspector.personality.neuroticism': 'Neuroticismo',
    'inspector.goals': 'Objetivos',
    'inspector.resources': 'Recursos',
    'inspector.relationships': 'Relacionamentos',
    'inspector.activity': 'Atividade',

    // Event injector
    'injector.title': 'Injetar evento',
    'injector.placeholder': 'Uma tempestade se aproxima. Uma briga começa...',
    'injector.everywhere': 'Em todo lugar',
    'injector.button': 'Injetar',

    // Loading
    'loading.waiting': 'Aguardando simulação...',

    // Timeline
    'timeline.pause': 'Pausar',
    'timeline.resume': 'Retomar',
    'timeline.stop': 'Parar',

    // Location types
    'locType.commercial': 'comercial',
    'locType.residential': 'residencial',
    'locType.leisure': 'lazer',
    'locType.government': 'governo',
    'locType.administrative': 'administrativo',
    'locType.education': 'educação',
    'locType.healthcare': 'saúde',
    'locType.social': 'social',
    'locType.agricultural': 'agrícola',
    'locType.recreation': 'recreação',
    'locType.virtual': 'virtual',

    // Clock prefix
    'clock.day': 'Dia',

    // Action patterns
    'action.rests': 'descansa',
    'action.waits': 'aguarda',
    'action.interaction': 'interação',
    'action.saysTo': 'diz para {target}: "{content}"',
    'action.movesTo': 'vai para {target}',
    'action.tradesWith': 'negocia com {target}: {content}',
    'action.interactsWith': 'interage com {target}',
    'action.works': 'trabalha: {content}',
    'action.worksGeneric': 'trabalha',
    'action.observes': 'observa o entorno',
    'action.does': 'faz: {content}',
    'action.xSaysTo': '{source} diz para {target}: "{content}"',
    'action.xTradesWith': '{source} negocia com {target}: {content}',
    'action.xInteractsWith': '{source} interage com {target}',

    // Location names (scenarios) — translated
    'location.Town Square': 'Praça Central',
    'location.Electronics District': 'Distrito de Eletrônicos',
    'location.Food Market': 'Mercado de Alimentos',
    'location.Residential North': 'Residencial Norte',
    'location.Residential South': 'Residencial Sul',
    'location.Park': 'Parque',
    'location.City Hall': 'Prefeitura',
    'location.Downtown Office': 'Escritório no Centro',
    'location.University Campus': 'Campus Universitário',
    'location.Hospital': 'Hospital',
    'location.Central Park': 'Parque Central',
    'location.Cafe District': 'Distrito dos Cafés',
    'location.Suburbs East': 'Subúrbios Leste',
    'location.Apartment Complex': 'Complexo de Apartamentos',
    'location.Town Clinic': 'Clínica da Cidade',
    'location.General Store': 'Mercearia',
    'location.Community Church': 'Igreja Comunitária',
    'location.Farm District': 'Distrito Rural',
    'location.School': 'Escola',
    'location.Residential Quarter': 'Bairro Residencial',
    'location.Town Hall': 'Prefeitura',
    'location.Main Hallway': 'Corredor Principal',
    'location.Cafeteria': 'Cantina',
    'location.Library': 'Biblioteca',
    'location.Sports Field': 'Quadra Esportiva',
    'location.Art Room': 'Sala de Artes',
    'location.Principal\'s Office': 'Sala do Diretor',

    // Breaking moment banner
    'banner.scheduledEvent': 'Evento do mundo',
    'banner.injectedEvent': 'Evento injetado',
    'banner.interaction': 'Interação',
    'banner.event': 'Evento',

    // Scenario library
    'scenario.subtitle': 'Escolha um cenário para simular',
    'scenario.new': 'Novo Cenário',
    'scenario.builtin': 'Cenários prontos',
    'scenario.mine': 'Meus cenários',
    'scenario.run': 'Executar',
    'scenario.runDemo': 'Demo',
    'scenario.runLLM': 'LLM',
    'scenario.delete': 'Excluir',
    'scenario.agents': 'agentes',
    'scenario.locations': 'locais',
    'scenario.empty': 'Nenhum cenário encontrado.',
    'scenario.browse': 'Cenários',
    'duration.day': 'dia',
    'duration.days': 'dias',
    'duration.hour': 'hora',
    'duration.hours': 'horas',

    // Builtin scenario translations
    'scenario.builtin:epidemic.name': 'Surto',
    'scenario.builtin:epidemic.description': 'Uma doença misteriosa se espalha por uma pequena cidade — moradores precisam escolher entre se proteger ou proteger a comunidade.',
    'scenario.builtin:marketplace.name': 'Mercado Local',
    'scenario.builtin:marketplace.description': 'Lojas concorrentes enfrentam a chegada de um grande varejista. Quem se adapta, quem fecha?',
    'scenario.builtin:city.name': 'Vida Urbana',
    'scenario.builtin:city.description': 'Um dia numa cidade pequena — protestos, falhas de infraestrutura e manobras políticas.',
    'scenario.builtin:school.name': 'Ensino Médio',
    'scenario.builtin:school.description': 'Dinâmicas sociais, grupos e a pressão de se encaixar — um dia no colégio.',

    // Scenario wizard
    'wizard.title': 'Novo Cenário',
    'wizard.titleEdit': 'Editar Cenário',
    'wizard.step.info': 'Info',
    'wizard.step.locations': 'Locais',
    'wizard.step.agents': 'Agentes',
    'wizard.step.events': 'Eventos',
    'wizard.back': 'Voltar',
    'wizard.next': 'Próximo',
    'wizard.cancel': 'Cancelar',
    'wizard.create': 'Criar',
    'wizard.save': 'Salvar',
    'wizard.addLocation': 'Adicionar local',
    'wizard.addAgent': 'Adicionar agente',
    'wizard.addEvent': 'Adicionar evento',
    'wizard.addGoal': 'Adicionar objetivo',
    'wizard.location.unnamed': 'Local sem nome',
    'wizard.agent.unnamed': 'Agente sem nome',
    'wizard.hint.locations': 'Adicione os lugares que os agentes vão habitar — clínica, praça, escola, etc.',
    'wizard.hint.agents': 'Adicione as pessoas que vão interagir nesta simulação.',
    'wizard.hint.events': 'Opcional: agende eventos no mundo em ticks específicos para guiar a história.',
    'wizard.field.name': 'Nome',
    'wizard.field.description': 'Descrição',
    'wizard.field.language': 'Idioma',
    'wizard.field.duration': 'Duração',
    'wizard.field.seed': 'Seed',
    'wizard.field.temperature': 'Temperatura',
    'wizard.field.age': 'Idade',
    'wizard.field.profession': 'Profissão',
    'wizard.field.startLocation': 'Local inicial',
    'wizard.field.backstory': 'Backstory',
    'wizard.field.goals': 'Objetivos',
    'wizard.field.personality': 'Personalidade (OCEAN)',
    'wizard.field.tick': 'Tick',

    // Post-mortem
    'postmortem.title': 'Simulação concluída',
    'postmortem.subtitle': 'O que aconteceu durante estes {ticks} ticks',
    'postmortem.arcs': 'Jornadas dos agentes',
    'postmortem.arcs.moodChange': 'Mudança de humor',
    'postmortem.arcs.energyFinal': 'Energia final',
    'postmortem.relationships': 'Relacionamentos formados',
    'postmortem.noRelationships': 'Nenhum relacionamento formado',
    'postmortem.keyMoments': 'Momentos-chave',
    'postmortem.noMoments': 'Nenhum evento notável',
    'postmortem.stats': 'Estatísticas',
    'postmortem.stats.totalActions': 'Ações totais',
    'postmortem.stats.interactions': 'Interações',
    'postmortem.stats.llmCalls': 'Chamadas LLM',
    'postmortem.stats.cacheRate': 'Taxa de cache hit',
    'postmortem.narrative': 'A história',
    'postmortem.narrative.loading': 'Gerando narrativa...',
    'postmortem.narrative.unavailable': 'Narrativa indisponível.',
    'postmortem.close': 'Fechar',
    'postmortem.replay': 'Replay',
  },
};

const I18nContext = createContext({ lang: 'en', t: (k) => k, setLang: () => {} });

function detectInitialLang() {
  try {
    const saved = localStorage.getItem('simcore:lang');
    if (saved && DICTIONARIES[saved]) return saved;
  } catch {}
  const nav = (typeof navigator !== 'undefined' && (navigator.language || navigator.userLanguage)) || 'en';
  if (nav.toLowerCase().startsWith('pt')) return 'pt';
  return 'en';
}

export function I18nProvider({ children }) {
  const [lang, setLangState] = useState(detectInitialLang);

  const setLang = (next) => {
    setLangState(next);
    try { localStorage.setItem('simcore:lang', next); } catch {}
  };

  // Inform backend so LLM-generated content (agent dialogue, reflections)
  // is produced in the chosen language. Runs on mount + every lang change.
  useEffect(() => {
    document.documentElement.lang = lang;
    try {
      fetch('/api/language', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ language: lang }),
      }).catch(() => {});
    } catch {}
  }, [lang]);

  const value = useMemo(() => {
    const dict = DICTIONARIES[lang] || DICTIONARIES.en;
    const t = (key, vars) => {
      let str = dict[key] ?? DICTIONARIES.en[key] ?? key;
      if (vars) {
        for (const k in vars) {
          str = str.replace(new RegExp(`\\{${k}\\}`, 'g'), String(vars[k]));
        }
      }
      return str;
    };
    return { lang, t, setLang };
  }, [lang]);

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useT() {
  return useContext(I18nContext);
}

// Parse backend Action.describe() strings and translate them.
// Falls back to the original string if no pattern matches.
export function translateAction(str, t, translateName = (n) => n) {
  if (!str || typeof str !== 'string') return str;
  const n = (name) => translateName(name);

  if (str === 'rests') return t('action.rests');
  if (str === 'waits') return t('action.waits');
  if (str === 'interaction') return t('action.interaction');

  let m;
  if ((m = str.match(/^says to (.+?): "(.+)"$/))) return t('action.saysTo', { target: n(m[1]), content: m[2] });
  if ((m = str.match(/^moves to (.+)$/))) return t('action.movesTo', { target: n(m[1]) });
  if ((m = str.match(/^trades with (.+?): (.+)$/))) return t('action.tradesWith', { target: n(m[1]), content: m[2] });
  if ((m = str.match(/^interacts with (.+)$/))) return t('action.interactsWith', { target: n(m[1]) });
  if ((m = str.match(/^works[:\s]+(.+)$/i))) return t('action.works', { content: m[1] });
  if (/^works[:\s]*$/i.test(str)) return t('action.worksGeneric');
  if (/^observes\b/i.test(str)) return t('action.observes');
  if ((m = str.match(/^does[:\s]+(.+)$/i))) return t('action.does', { content: m[1] });
  // Source-prefixed variants (from interaction descriptions)
  if ((m = str.match(/^(.+?) says to (.+?): "(.+)"$/))) return t('action.xSaysTo', { source: m[1], target: n(m[2]), content: m[3] });
  if ((m = str.match(/^(.+?) trades with (.+?): (.+)$/))) return t('action.xTradesWith', { source: m[1], target: n(m[2]), content: m[3] });
  if ((m = str.match(/^(.+?) interacts with (.+)$/))) return t('action.xInteractsWith', { source: m[1], target: n(m[2]) });

  return str;
}

export function translateLocation(name, t) {
  if (!name) return name;
  const key = `location.${name}`;
  const translated = t(key);
  // If translation fell through to the key itself, return original name
  return translated === key ? name : translated;
}
