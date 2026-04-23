"""Core Agent class — the autonomous entity in a simulation."""

from __future__ import annotations

from dataclasses import dataclass, field

from simcore.agents.actions import Action, ActionType
from simcore.agents.memory import MemorySystem
from simcore.agents.persona import Persona


@dataclass
class AgentState:
    """Mutable state of an agent that changes each tick."""

    location: str = ""
    mood: float = 0.0  # -1.0 to 1.0
    energy: float = 1.0  # 0.0 to 1.0
    resources: dict[str, float] = field(default_factory=dict)
    current_action: Action | None = None
    custom: dict[str, object] = field(default_factory=dict)


class Agent:
    """An autonomous agent in the simulation."""

    def __init__(self, persona: Persona, state: AgentState | None = None,
                 memory_config: dict | None = None):
        self.persona = persona
        self.state = state or AgentState()
        self.memory = MemorySystem(**(memory_config or {}))
        self.id = persona.name.lower().replace(" ", "_")
        self._action_history: list[Action] = []

    @property
    def name(self) -> str:
        return self.persona.name

    @property
    def location(self) -> str:
        return self.state.location

    @location.setter
    def location(self, value: str) -> None:
        self.state.location = value

    def record_action(self, action: Action, tick: int) -> None:
        """Record an action in history and memory."""
        self._action_history.append(action)
        if len(self._action_history) > 100:
            self._action_history.pop(0)
        self.memory.add(
            tick=tick,
            content=f"I {action.describe()}",
            importance=0.3 if action.type == ActionType.WAIT else 0.5,
        )

    def observe(self, observation: str, tick: int, importance: float = 0.5) -> None:
        """Record an observation in memory."""
        self.memory.add(tick=tick, content=observation, importance=importance)

    def build_prompt(self, observation: str) -> str:
        """Build the full prompt for LLM decision-making."""
        memory_context = self.memory.get_context()
        persona_prompt = self.persona.to_prompt()

        state_desc = (
            f"Current state: You are at {self.state.location}. "
            f"Mood: {'positive' if self.state.mood > 0.2 else 'negative' if self.state.mood < -0.2 else 'neutral'}. "
            f"Energy: {'high' if self.state.energy > 0.6 else 'low' if self.state.energy < 0.3 else 'moderate'}."
        )
        if self.state.resources:
            resources_str = ", ".join(f"{k}: {v}" for k, v in self.state.resources.items())
            state_desc += f" Resources: {resources_str}."

        return f"""{persona_prompt}

{state_desc}

{memory_context}

Current situation:
{observation}

Decide your next action. Respond in this exact JSON format:
{{
    "action": "move|speak|trade|interact|wait|observe|work|rest",
    "target": "<target agent or location>",
    "content": "<what you say or do>",
    "reasoning": "<brief internal thought>"
}}"""

    def apply_action(self, action: Action, tick: int) -> None:
        """Apply an action's effects on the agent's state."""
        self.state.current_action = action
        self.record_action(action, tick)

        match action.type:
            case ActionType.MOVE:
                self.state.location = action.target
            case ActionType.REST:
                self.state.energy = min(1.0, self.state.energy + 0.3)
            case ActionType.WORK:
                self.state.energy = max(0.0, self.state.energy - 0.2)

    def to_dict(self) -> dict:
        """Serialize agent state for storage/streaming."""
        return {
            "id": self.id,
            "name": self.name,
            "location": self.state.location,
            "mood": self.state.mood,
            "energy": self.state.energy,
            "resources": self.state.resources,
            "current_action": self.state.current_action.describe() if self.state.current_action else None,
            "personality": {
                "openness": self.persona.personality.openness,
                "conscientiousness": self.persona.personality.conscientiousness,
                "extraversion": self.persona.personality.extraversion,
                "agreeableness": self.persona.personality.agreeableness,
                "neuroticism": self.persona.personality.neuroticism,
            },
            "memory_summary": self.memory.get_context(max_entries=5),
        }
