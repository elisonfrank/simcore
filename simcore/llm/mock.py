"""Mock LLM provider — rule-based decisions for demo mode (no API key needed)."""

from __future__ import annotations

import random

from simcore.agents.actions import Action, ActionType


class MockLLMProvider:
    """Generates agent decisions without calling any LLM API."""

    def __init__(self, seed: int = 42):
        self._rng = random.Random(seed)
        self._call_count = 0
        self._cache_hits = 0
        self._known_locations: list[str] = []

    async def decide(self, system_prompt: str, user_prompt: str) -> Action:
        self._call_count += 1

        # Extract context clues from prompts
        is_alone = "You are alone" in user_prompt
        has_people = "People here:" in user_prompt
        location = self._extract_location(user_prompt)
        nearby = self._extract_nearby(user_prompt)
        available_locations = self._extract_locations_from_system(system_prompt)

        # Personality-driven weights
        extraversion = self._extract_trait(system_prompt, "outgoing")
        is_creative = "curious" in system_prompt.lower()
        is_hardworker = "organized" in system_prompt.lower() or "disciplined" in system_prompt.lower()

        # Decision logic
        roll = self._rng.random()

        # Extraverts seek people
        if is_alone and extraversion and roll < 0.6:
            targets = [l for l in available_locations if l != location]
            if targets:
                dest = self._rng.choice(targets)
                return Action(
                    type=ActionType.MOVE,
                    target=dest,
                    reasoning=f"It's quiet here, I should go somewhere with more people",
                )

        # Talk to nearby people
        if has_people and nearby and roll < 0.5:
            target = self._rng.choice(nearby)
            phrases = [
                f"Hey {target}, how's business today?",
                f"What do you think about the market lately?",
                f"Nice to see you here, {target}!",
                f"Have you heard any news?",
                f"Want to grab something to eat?",
                f"I think prices are going to change soon.",
                f"The weather's been interesting lately.",
                f"What are you working on?",
            ]
            return Action(
                type=ActionType.SPEAK,
                target=target,
                content=self._rng.choice(phrases),
                reasoning=f"I want to socialize with {target}",
            )

        # Trade with nearby people
        if has_people and nearby and roll < 0.65:
            target = self._rng.choice(nearby)
            trades = [
                "offering a small discount on my products",
                "looking to buy some supplies",
                "proposing a collaboration",
                "sharing some market insights for a favor",
            ]
            return Action(
                type=ActionType.TRADE,
                target=target,
                content=self._rng.choice(trades),
                reasoning=f"Good opportunity to do business with {target}",
            )

        # Work if hardworking personality
        if is_hardworker and roll < 0.4:
            tasks = [
                "organizing inventory",
                "updating price lists",
                "cleaning up the shop",
                "analyzing today's sales",
                "preparing for tomorrow",
            ]
            return Action(
                type=ActionType.WORK,
                content=self._rng.choice(tasks),
                reasoning="I should stay productive",
            )

        # Move to a new location
        if roll < 0.5:
            targets = [l for l in available_locations if l != location]
            if targets:
                dest = self._rng.choice(targets)
                reasons = [
                    f"I feel like checking out {dest}",
                    f"Maybe something interesting is happening at {dest}",
                    f"Time for a change of scenery",
                ]
                return Action(
                    type=ActionType.MOVE,
                    target=dest,
                    reasoning=self._rng.choice(reasons),
                )

        # Observe
        if roll < 0.7:
            return Action(
                type=ActionType.OBSERVE,
                target="surroundings",
                content="looking around carefully",
                reasoning="I want to see what's going on",
            )

        # Rest
        if roll < 0.85:
            return Action(
                type=ActionType.REST,
                reasoning="I need to recharge",
            )

        # Default: wait
        return Action(
            type=ActionType.WAIT,
            reasoning="Nothing interesting to do right now",
        )

    async def reflect(self, memories: str) -> str:
        self._call_count += 1
        reflections = [
            "I've been socializing more lately. Building relationships is key to success here.",
            "The market seems competitive. I need to find my niche and focus on what I do best.",
            "I should pay more attention to what others are doing — there might be opportunities I'm missing.",
            "Today was productive. Keeping this momentum will help me reach my goals.",
            "I notice the market dynamics are shifting. I need to adapt my strategy.",
        ]
        return self._rng.choice(reflections)

    def _extract_location(self, prompt: str) -> str:
        if "You are at " in prompt:
            start = prompt.index("You are at ") + 11
            end = prompt.index(" (", start) if " (" in prompt[start:] else prompt.index(".", start)
            return prompt[start:end]
        return ""

    def _extract_nearby(self, prompt: str) -> list[str]:
        if "People here: " in prompt:
            start = prompt.index("People here: ") + 13
            end = prompt.index(".", start)
            names = prompt[start:end].split(", ")
            return [n.strip() for n in names if n.strip()]
        return []

    def _extract_trait(self, prompt: str, keyword: str) -> bool:
        return keyword.lower() in prompt.lower()

    def _extract_locations_from_system(self, prompt: str) -> list[str]:
        # Try to get locations from the environment (set by engine)
        if self._known_locations:
            return list(self._known_locations)
        return ["Town Square", "Park"]

    def set_locations(self, locations: list[str]) -> None:
        """Set known locations from the simulation engine."""
        self._known_locations = locations

    @property
    def stats(self):
        return {
            "total_calls": self._call_count,
            "cache_hits": self._cache_hits,
            "cache_hit_rate": 0.0,
            "mode": "demo",
        }
