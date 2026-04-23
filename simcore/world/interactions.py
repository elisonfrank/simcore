"""Interaction resolver — processes agent-to-agent interactions."""

from __future__ import annotations

import logging
from dataclasses import dataclass

from simcore.agents.actions import Action, ActionType
from simcore.agents.agent import Agent

logger = logging.getLogger("simcore.interactions")


@dataclass
class InteractionResult:
    """Result of an interaction between agents."""

    initiator: str
    target: str
    type: str
    description: str
    sentiment_delta_initiator: float = 0.0
    sentiment_delta_target: float = 0.0


class InteractionResolver:
    """Resolves interactions between agents in the same location."""

    def resolve(self, initiator: Agent, target: Agent, action: Action,
                tick: int) -> InteractionResult | None:
        """Process an interaction between two agents."""
        if action.type == ActionType.SPEAK:
            return self._resolve_speech(initiator, target, action, tick)
        elif action.type == ActionType.TRADE:
            return self._resolve_trade(initiator, target, action, tick)
        elif action.type == ActionType.INTERACT:
            return self._resolve_general(initiator, target, action, tick)
        return None

    def _resolve_speech(self, initiator: Agent, target: Agent,
                        action: Action, tick: int) -> InteractionResult:
        """Process a speech interaction."""
        description = f"{initiator.name} says to {target.name}: \"{action.content}\""

        # Target observes the speech
        target.observe(description, tick, importance=0.6)

        # Update relationships
        base_delta = 0.05  # speaking generally improves relations
        if initiator.persona.personality.agreeableness > 0.6:
            base_delta += 0.03
        if target.persona.personality.agreeableness > 0.6:
            base_delta += 0.02

        initiator.memory.update_relationship(target.name, base_delta, tick, action.content)
        target.memory.update_relationship(initiator.name, base_delta, tick, action.content)

        return InteractionResult(
            initiator=initiator.name,
            target=target.name,
            type="speech",
            description=description,
            sentiment_delta_initiator=base_delta,
            sentiment_delta_target=base_delta,
        )

    def _resolve_trade(self, initiator: Agent, target: Agent,
                       action: Action, tick: int) -> InteractionResult:
        """Process a trade interaction."""
        description = f"{initiator.name} trades with {target.name}: {action.content}"

        initiator.observe(f"Traded with {target.name}", tick, importance=0.7)
        target.observe(f"{initiator.name} proposed a trade: {action.content}", tick, importance=0.7)

        initiator.memory.update_relationship(target.name, 0.1, tick, f"traded: {action.content}")
        target.memory.update_relationship(initiator.name, 0.05, tick, f"trade proposed: {action.content}")

        return InteractionResult(
            initiator=initiator.name,
            target=target.name,
            type="trade",
            description=description,
            sentiment_delta_initiator=0.1,
            sentiment_delta_target=0.05,
        )

    def _resolve_general(self, initiator: Agent, target: Agent,
                         action: Action, tick: int) -> InteractionResult:
        """Process a general interaction."""
        description = f"{initiator.name} interacts with {target.name}: {action.content}"

        initiator.observe(description, tick, importance=0.5)
        target.observe(description, tick, importance=0.5)

        initiator.memory.update_relationship(target.name, 0.03, tick)
        target.memory.update_relationship(initiator.name, 0.03, tick)

        return InteractionResult(
            initiator=initiator.name,
            target=target.name,
            type="interaction",
            description=description,
        )
