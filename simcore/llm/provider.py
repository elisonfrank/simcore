"""LLM provider — unified interface via LiteLLM."""

from __future__ import annotations

import json
import logging
from typing import Any

import litellm

from simcore.agents.actions import Action, ActionType
from simcore.llm.cache import ResponseCache

logger = logging.getLogger("simcore.llm")


def _strip_json_artifacts(text: str) -> str:
    """Salvage plain prose from a response that leaked JSON structure.

    Small local models sometimes ignore 'prose only' instructions and return
    { "summary": "..." } or similar. We pull the longest string value out.
    """
    stripped = text.strip()
    if not (stripped.startswith("{") or stripped.startswith("[")):
        return stripped
    try:
        data = json.loads(stripped)
    except json.JSONDecodeError:
        return stripped  # not valid JSON; return as-is

    # Flatten and collect all string values
    def collect(node):
        found = []
        if isinstance(node, str):
            found.append(node)
        elif isinstance(node, dict):
            for v in node.values():
                found.extend(collect(v))
        elif isinstance(node, list):
            for v in node:
                found.extend(collect(v))
        return found

    strings = [s for s in collect(data) if len(s) > 10]
    if not strings:
        return stripped
    # Prefer concatenating all insight/summary sentences
    return " ".join(strings)

# Suppress litellm verbose logging
litellm.suppress_debug_info = True

# Drop params that aren't supported by the active provider
# (e.g. Ollama doesn't accept presence_penalty/frequency_penalty/response_format).
# Without this, requests fail instead of degrading gracefully.
litellm.drop_params = True


class LLMProvider:
    """Wrapper around LiteLLM for agent decision-making."""

    def __init__(
        self,
        model: str = "gpt-4o-mini",
        reflection_model: str | None = None,
        temperature: float = 0.7,
        max_tokens: int = 500,
        cache_enabled: bool = True,
        frequency_penalty: float = 0.0,
        presence_penalty: float = 0.0,
    ):
        self.model = model
        self.reflection_model = reflection_model or model
        self.temperature = temperature
        self.max_tokens = max_tokens
        self.frequency_penalty = frequency_penalty
        self.presence_penalty = presence_penalty
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
                frequency_penalty=self.frequency_penalty,
                presence_penalty=self.presence_penalty,
                response_format={"type": "json_object"},
            )
            content = response.choices[0].message.content
            if self.cache and cache_key:
                self.cache.set(cache_key, content)
            return self._parse_action(content)

        except Exception as e:
            logger.warning(f"LLM call failed: {e}. Returning WAIT action.")
            return Action(type=ActionType.WAIT, reasoning=f"LLM error: {e}")

    async def reflect(self, memories: str, language: str = "en") -> str:
        """Generate a reflection summary from recent memories."""
        from simcore.llm.prompts import language_directive
        self._call_count += 1
        try:
            response = await litellm.acompletion(
                model=self.reflection_model,
                messages=[
                    {
                        "role": "system",
                        "content": (
                            "You write a short personal reflection from the agent's first-person point of view. "
                            "Output ONLY 2 to 3 plain sentences as prose. "
                            "NO JSON, NO braces, NO quotes, NO bullet points, NO keys like 'summary' or 'insight', "
                            "NO markdown, NO headers. Just plain natural sentences starting with 'I...' or equivalent.\n\n"
                            f"{language_directive(language)}"
                        ),
                    },
                    {
                        "role": "user",
                        "content": (
                            f"These are my recent experiences:\n\n{memories}\n\n"
                            "Write 2-3 plain sentences from my point of view about what I learned or noticed. "
                            "Plain prose only, no structured data.\n\n"
                            f"{language_directive(language)}"
                        ),
                    },
                ],
                temperature=0.5,
                max_tokens=180,
            )
            text = response.choices[0].message.content.strip()
            return _strip_json_artifacts(text)
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
