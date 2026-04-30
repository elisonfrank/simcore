"""SimulationEngine — the main simulation loop."""

from __future__ import annotations

import asyncio
import logging
import random
from typing import Any

from simcore.agents.actions import Action, ActionType
from simcore.agents.agent import Agent, AgentState
from simcore.agents.persona import Persona, PersonalityTraits
from simcore.config.schema import SimulationConfig
from simcore.engine.clock import SimClock
from simcore.engine.events import EventBus, EventType, SimEvent
from simcore.llm.prompts import OBSERVATION_PROMPT
from simcore.llm.provider import LLMProvider
from simcore.world.environment import Environment
from simcore.world.interactions import InteractionResolver
from simcore.world.location import Location

logger = logging.getLogger("simcore")


class SimulationEngine:
    """Core simulation engine that orchestrates agents, environment, and time."""

    def __init__(self, config: SimulationConfig, demo_mode: bool = False,
                 tick_delay: float = 0.0):
        self.config = config
        self.clock = SimClock.from_config(config.time_step, config.duration)
        self.event_bus = EventBus()
        self.environment = self._build_environment()
        self.agents: dict[str, Agent] = {}
        self.tick_delay = tick_delay  # seconds between ticks for visualization

        if demo_mode:
            from simcore.llm.mock import MockLLMProvider
            self.llm = MockLLMProvider(seed=config.seed)
        else:
            self.llm = LLMProvider(
                model=config.llm.model,
                reflection_model=config.llm.reflection_model,
                temperature=config.llm.temperature,
                max_tokens=config.llm.max_tokens,
                cache_enabled=config.llm.cache,
                frequency_penalty=config.llm.frequency_penalty,
                presence_penalty=config.llm.presence_penalty,
            )
        self.interaction_resolver = InteractionResolver()
        self._running = False
        self._paused = False
        self._rng = random.Random(config.seed)
        # True when scenario has at least one virtual location (enables POST action)
        self._has_virtual = any(
            loc.virtual or loc.type == 'virtual'
            for loc in self.environment.locations.values()
        )

        self._build_agents()

        # Pass location names to mock provider if in demo mode
        if demo_mode and hasattr(self.llm, 'set_locations'):
            self.llm.set_locations(self.environment.get_location_names())

    def _build_environment(self) -> Environment:
        env = Environment(
            width=self.config.environment.size[0],
            height=self.config.environment.size[1],
            global_state=dict(self.config.environment.global_state),
        )
        for loc_cfg in self.config.environment.locations:
            env.add_location(Location(
                name=loc_cfg.name,
                type=loc_cfg.type,
                position=loc_cfg.position,
                capacity=loc_cfg.capacity,
                city=loc_cfg.city,
                virtual=loc_cfg.virtual,
                properties=dict(loc_cfg.properties),
            ))
        return env

    def _build_agents(self) -> None:
        for agent_cfg in self.config.agents:
            persona = Persona(
                name=agent_cfg.name,
                age=agent_cfg.age,
                profession=agent_cfg.profession,
                personality=PersonalityTraits(
                    openness=agent_cfg.personality.openness,
                    conscientiousness=agent_cfg.personality.conscientiousness,
                    extraversion=agent_cfg.personality.extraversion,
                    agreeableness=agent_cfg.personality.agreeableness,
                    neuroticism=agent_cfg.personality.neuroticism,
                ),
                goals=tuple(agent_cfg.goals),
                backstory=agent_cfg.backstory,
            )
            # Redirect to first physical location if starting_location is virtual
            start_loc = agent_cfg.starting_location
            loc_obj = self.environment.locations.get(start_loc)
            if loc_obj and (loc_obj.virtual or loc_obj.type == 'virtual'):
                physical = next((l.name for l in self.environment.locations.values() if not l.virtual and l.type != 'virtual'), start_loc)
                logger.warning(f"Agent {agent_cfg.name} starts at virtual '{start_loc}' → redirected to '{physical}'")
                start_loc = physical

            state = AgentState(
                location=start_loc,
                resources=dict(agent_cfg.resources),
            )
            agent = Agent(persona=persona, state=state)
            self.agents[agent.id] = agent
            self.environment.place_agent(agent.id, start_loc)

    async def run(self) -> None:
        """Run the simulation until completion or stop signal."""
        self._running = True
        logger.info(f"Starting simulation: {self.config.name}")
        logger.info(f"  Agents: {len(self.agents)}")
        logger.info(f"  Locations: {len(self.environment.locations)}")
        logger.info(f"  Duration: {self.clock.max_ticks} ticks")

        await self.event_bus.emit(SimEvent(
            type=EventType.SIMULATION_START,
            tick=0,
            data={"config": self.config.name, "agents": len(self.agents)},
        ))

        while self._running and self.clock.advance():
            if self._paused:
                await asyncio.sleep(0.1)
                self.clock.current_tick -= 1  # undo advance while paused
                continue

            await self._run_tick()

            # Delay between ticks for real-time visualization
            if self.tick_delay > 0:
                await asyncio.sleep(self.tick_delay)

        self._running = False
        await self.event_bus.emit(SimEvent(
            type=EventType.SIMULATION_END,
            tick=self.clock.current_tick,
            data={"llm_stats": self.llm.stats},
        ))
        logger.info(f"Simulation complete. LLM stats: {self.llm.stats}")

    async def _run_tick(self) -> None:
        """Execute one simulation tick."""
        tick = self.clock.current_tick

        await self.event_bus.emit(SimEvent(
            type=EventType.TICK_START, tick=tick,
            data={"time": self.clock.format_time(), "progress": self.clock.progress},
        ))

        # Process scheduled events
        await self._process_scheduled_events(tick)

        # Each agent observes, decides, acts
        agent_list = list(self.agents.values())
        self._rng.shuffle(agent_list)  # randomize order each tick

        # Gather decisions in parallel
        decisions = await asyncio.gather(*[
            self._agent_turn(agent, tick) for agent in agent_list
        ])

        # Resolve interactions
        for agent, action in zip(agent_list, decisions):
            if action and action.type in (ActionType.SPEAK, ActionType.TRADE, ActionType.INTERACT):
                target = self._find_agent_by_name(action.target)
                if target and target.location == agent.location:
                    result = self.interaction_resolver.resolve(agent, target, action, tick)
                    # Skip INTERACTION event for SPEAK — AGENT_SPEAK already
                    # emitted the same line, no need to duplicate.
                    if result and action.type != ActionType.SPEAK:
                        await self.event_bus.emit(SimEvent(
                            type=EventType.INTERACTION, tick=tick,
                            data={"result": result.description, "content": action.content},
                            source=agent.name,
                        ))

        # Per-tick passive decay for all agents
        for agent in self.agents.values():
            agent.apply_tick_decay()

        # Periodic reflection (every 12 ticks = ~12 hours at 1h/tick)
        if tick % 12 == 0 and tick > 0:
            await self._run_reflections(tick)

        await self.event_bus.emit(SimEvent(
            type=EventType.TICK_END, tick=tick,
            data=self.get_state(),
        ))

    async def _agent_turn(self, agent: Agent, tick: int) -> Any:
        """Run one agent's observation → decision → action cycle."""
        lang = getattr(self.config, "language", "en")
        observation = self._build_observation(agent, tick, lang)
        agent.observe(observation, tick, importance=0.3)
        prompt = agent.build_prompt(observation, language=lang)
        persona_prompt = agent.persona.to_prompt()
        if lang != "en":
            from simcore.llm.prompts import language_directive
            persona_prompt = f"{persona_prompt}\n\n{language_directive(lang)}"
        action = await self.llm.decide(persona_prompt, prompt)

        # Apply action
        if action.type == ActionType.MOVE:
            moved = self.environment.move_agent(
                agent.id, agent.location, action.target
            )
            if not moved:
                action.content = f"Tried to move to {action.target} but couldn't"
        elif action.type == ActionType.POST:
            if self._has_virtual and action.content:
                # Broadcast post as a global event — visible to all agents next tick
                description = f"{agent.name} postou nas redes sociais: {action.content}"
                self.environment.log_event(tick, "social_post", description, location="")
                for other in self.agents.values():
                    if other.id != agent.id:
                        other.observe(description, tick, importance=0.6)
            else:
                action = Action(type=ActionType.WAIT, reasoning="No social network available")
        elif action.type in (ActionType.SPEAK, ActionType.TRADE, ActionType.INTERACT):
            target = self._find_agent_by_name(action.target)
            if not target or target.id == agent.id or target.location != agent.location:
                action = Action(type=ActionType.WAIT, reasoning="Target not present at this location")

        agent.apply_action(action, tick)

        # Emit event
        event_type = {
            ActionType.SPEAK: EventType.AGENT_SPEAK,
            ActionType.MOVE: EventType.AGENT_MOVE,
            ActionType.POST: EventType.AGENT_POST,
        }.get(action.type, EventType.AGENT_ACTION)

        await self.event_bus.emit(SimEvent(
            type=event_type, tick=tick,
            data={"action": action.describe(), "reasoning": action.reasoning},
            source=agent.name,
        ))

        return action

    _SOCIAL_HINT = {
        "pt": 'Redes sociais ativas. Use a ação "post" para publicar publicamente a qualquer momento — sua mensagem chegará a todos imediatamente.',
        "es": 'Redes sociales activas. Usa la acción "post" para publicar públicamente en cualquier momento.',
        "en": 'Social networks are active. Use the "post" action to publish publicly at any time — your message reaches everyone immediately.',
    }

    def _build_observation(self, agent: Agent, tick: int, lang: str = "en") -> str:
        """Build what an agent currently observes."""
        location = self.environment.get_location(agent.location)
        if not location:
            return "You are in an unknown location."

        nearby = self.environment.get_nearby_agents(agent.location, agent.id)
        nearby_names = [
            self.agents[aid].name for aid in nearby if aid in self.agents
        ]
        recent_events = self.environment.get_recent_events(tick, window=3)
        event_descriptions = [
            e["description"] for e in recent_events
            if e.get("location") == agent.location or e.get("location") == ""
        ]

        available_locations = self.environment.get_location_names()
        known_agents = [a.name for a in self.agents.values() if a.id != agent.id]
        return OBSERVATION_PROMPT.render(
            location_name=location.name,
            location_type=location.type,
            agents_here=nearby_names,
            available_locations=available_locations,
            known_agents=known_agents,
            recent_events=event_descriptions[-5:],
            global_context=str(self.environment.global_state) if self.environment.global_state else "",
            social_network_hint=self._SOCIAL_HINT.get(lang, self._SOCIAL_HINT["en"]) if self._has_virtual else "",
        )

    async def _run_reflections(self, tick: int) -> None:
        """Run periodic reflection for all agents."""
        lang = getattr(self.config, "language", "en")
        for agent in self.agents.values():
            memories = agent.memory.get_context(max_entries=10)
            if memories:
                summary = await self.llm.reflect(memories, language=lang)
                if summary:
                    agent.memory.add_reflection(summary)
                    await self.event_bus.emit(SimEvent(
                        type=EventType.REFLECTION, tick=tick,
                        data={"summary": summary},
                        source=agent.name,
                    ))

    async def _process_scheduled_events(self, tick: int) -> None:
        """Process events scheduled for this tick."""
        lang = getattr(self.config, "language", "en")
        for event_cfg in self.config.events.scheduled:
            if event_cfg.tick == tick:
                description = event_cfg.translations.get(lang) or event_cfg.description
                if lang != "en" and not event_cfg.translations.get(lang):
                    description = await self.llm.translate(description, lang)
                logger.info(f"Scheduled event at tick {tick}: {description}")
                self.environment.log_event(tick, event_cfg.type, description)
                for agent in self.agents.values():
                    agent.observe(f"World event: {description}", tick, importance=0.8)
                await self.event_bus.emit(SimEvent(
                    type=EventType.SCHEDULED_EVENT, tick=tick,
                    data={"description": description, "effects": event_cfg.effects},
                ))

    async def inject_event(self, description: str, location: str = "") -> None:
        """Inject an event into the simulation at runtime."""
        tick = self.clock.current_tick
        self.environment.log_event(tick, "injected", description, location)

        for agent in self.agents.values():
            if not location or agent.location == location:
                agent.observe(f"Breaking event: {description}", tick, importance=0.9)

        await self.event_bus.emit(SimEvent(
            type=EventType.INJECTED_EVENT, tick=tick,
            data={"description": description, "location": location},
        ))

    def _find_agent_by_name(self, name: str) -> Agent | None:
        """Find an agent by name (case-insensitive)."""
        name_lower = name.lower().strip()
        for agent in self.agents.values():
            if agent.name.lower() == name_lower or agent.id == name_lower:
                return agent
        return None

    def pause(self) -> None:
        self._paused = True

    def resume(self) -> None:
        self._paused = False

    def stop(self) -> None:
        self._running = False

    def get_state(self) -> dict:
        """Get full simulation state snapshot."""
        return {
            "clock": self.clock.to_dict(),
            "agents": {aid: a.to_dict() for aid, a in self.agents.items()},
            "environment": self.environment.to_dict(),
            "llm_stats": self.llm.stats,
        }
