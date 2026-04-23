"""Action types that agents can perform."""

from __future__ import annotations

from dataclasses import dataclass, field
from enum import Enum


class ActionType(Enum):
    MOVE = "move"
    SPEAK = "speak"
    TRADE = "trade"
    INTERACT = "interact"
    WAIT = "wait"
    OBSERVE = "observe"
    WORK = "work"
    REST = "rest"
    CUSTOM = "custom"


@dataclass
class Action:
    """An action decided by an agent."""

    type: ActionType
    target: str = ""  # target agent name, location, or item
    content: str = ""  # speech content, trade details, etc.
    parameters: dict[str, object] = field(default_factory=dict)
    reasoning: str = ""  # why the agent chose this action

    def describe(self) -> str:
        """Human-readable description of the action."""
        match self.type:
            case ActionType.MOVE:
                return f"moves to {self.target}"
            case ActionType.SPEAK:
                return f'says to {self.target}: "{self.content}"'
            case ActionType.TRADE:
                return f"trades with {self.target}: {self.content}"
            case ActionType.INTERACT:
                return f"interacts with {self.target}: {self.content}"
            case ActionType.WORK:
                return f"works: {self.content}"
            case ActionType.REST:
                return "rests"
            case ActionType.OBSERVE:
                return f"observes {self.target or 'surroundings'}"
            case ActionType.WAIT:
                return "waits"
            case ActionType.CUSTOM:
                return f"{self.content}"
