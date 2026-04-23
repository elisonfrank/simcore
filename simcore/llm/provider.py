"""LLM provider — unified interface via LiteLLM."""

from __future__ import annotations

import json
import logging
from typing import Any

import litellm

from simcore.agents.actions import Action, ActionType
from simcore.llm.cache import ResponseCache

logger = logging.getLogger("simcore.llm")

# Suppress litellm verbose logging
litellm.suppress_debug_info = True


class LLMProvider:
    """Wrapper around LiteLLM for agent decision-making."""

    def __init__(
        self,
        model: str = "gpt-4o-mini",
        reflection_model: str | None = None,
        temperature: float = 0.7,
        max_tokens: int = 500,
        cache_enabled: bool = True,
    ):
        self.model = model
        self.reflection_model = reflection_model or model
        self.temperature = temperature
        self.max_tokens = max_tokens
        self.cache = ResponseCache() if cache_enabled else None
        self._call_count = 0
        self._cache_hits = 0

    async def decide(self, system_prompt: str, user_prompt: str) -> Action:
        """Ask the LLM to decide an agent's next action."""
        cache_key = f"{system_prompt}|||{user_prompt}" if self.cache else None

        if self.cache and cache_key:
            cached = self.cache.get(cache_key)
            if cached:
                self._cache_hits += 1
                return self._parse_action(cached)

        self._call_count += 1
        try:
            response = await litellm.acompletion(
                model=self.model,
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": user_prompt},
                ],
                temperature=self.temperature,
                max_tokens=self.max_tokens,
                response_format={"type": "json_object"},
            )
            content = response.choices[0].message.content
            if self.cache and cache_key:
                self.cache.set(cache_key, content)
            return self._parse_action(content)

        except Exception as e:
            logger.warning(f"LLM call failed: {e}. Returning WAIT action.")
            return Action(type=ActionType.WAIT, reasoning=f"LLM error: {e}")

    async def reflect(self, memories: str) -> str:
        """Generate a reflection summary from recent memories."""
        self._call_count += 1
        try:
            response = await litellm.acompletion(
                model=self.reflection_model,
                messages=[
                    {
                        "role": "system",
                        "content": (
                            "You are summarizing an agent's recent experiences into key insights. "
                            "Be concise — 2-3 sentences max."
                        ),
                    },
                    {
                        "role": "user",
                        "content": f"Summarize these recent experiences into key insights:\n\n{memories}",
                    },
                ],
                temperature=0.3,
                max_tokens=200,
            )
            return response.choices[0].message.content.strip()
        except Exception as e:
            logger.warning(f"Reflection failed: {e}")
            return ""

    def _parse_action(self, content: str) -> Action:
        """Parse LLM JSON response into an Action."""
        try:
            data = json.loads(content)
            action_type = ActionType(data.get("action", "wait"))
            return Action(
                type=action_type,
                target=data.get("target", ""),
                content=data.get("content", ""),
                reasoning=data.get("reasoning", ""),
                parameters=data.get("parameters", {}),
            )
        except (json.JSONDecodeError, ValueError) as e:
            logger.warning(f"Failed to parse action: {e}. Content: {content[:200]}")
            return Action(type=ActionType.WAIT, reasoning=f"Parse error: {e}")

    @property
    def stats(self) -> dict[str, Any]:
        return {
            "total_calls": self._call_count,
            "cache_hits": self._cache_hits,
            "cache_hit_rate": (
                self._cache_hits / max(1, self._call_count + self._cache_hits)
            ),
        }
