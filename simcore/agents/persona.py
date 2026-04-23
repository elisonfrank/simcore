"""Agent persona — immutable identity and personality traits."""

from __future__ import annotations

from dataclasses import dataclass


@dataclass(frozen=True)
class PersonalityTraits:
    """Big Five personality model (OCEAN)."""

    openness: float = 0.5
    conscientiousness: float = 0.5
    extraversion: float = 0.5
    agreeableness: float = 0.5
    neuroticism: float = 0.5

    def describe(self) -> str:
        """Return a natural-language summary of personality traits."""
        descriptions = []
        trait_map = {
            "openness": ("curious and creative", "practical and conventional"),
            "conscientiousness": ("organized and disciplined", "flexible and spontaneous"),
            "extraversion": ("outgoing and energetic", "reserved and introspective"),
            "agreeableness": ("cooperative and trusting", "competitive and skeptical"),
            "neuroticism": ("sensitive and anxious", "calm and emotionally stable"),
        }
        for trait_name, (high_desc, low_desc) in trait_map.items():
            value = getattr(self, trait_name)
            if value >= 0.7:
                descriptions.append(high_desc)
            elif value <= 0.3:
                descriptions.append(low_desc)
        return ", ".join(descriptions) if descriptions else "balanced personality"


@dataclass(frozen=True)
class Persona:
    """Immutable agent identity."""

    name: str
    age: int = 30
    profession: str = "citizen"
    personality: PersonalityTraits = PersonalityTraits()
    goals: tuple[str, ...] = ()
    backstory: str = ""

    def to_prompt(self) -> str:
        """Generate a system prompt describing this persona."""
        lines = [
            f"You are {self.name}, a {self.age}-year-old {self.profession}.",
            f"Personality: {self.personality.describe()}.",
        ]
        if self.goals:
            goals_str = ", ".join(self.goals)
            lines.append(f"Your goals: {goals_str}.")
        if self.backstory:
            lines.append(f"Background: {self.backstory}")
        return "\n".join(lines)
