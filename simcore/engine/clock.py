"""Simulation clock — manages time progression."""

from __future__ import annotations

import re
from dataclasses import dataclass


def parse_duration(duration_str: str) -> int:
    """Parse a human-readable duration string to number of ticks.

    Examples: "1 hour", "30 minutes", "7 days", "2 weeks"
    """
    match = re.match(r"(\d+)\s*(minute|hour|day|week)s?", duration_str.strip().lower())
    if not match:
        raise ValueError(f"Cannot parse duration: '{duration_str}'")

    value = int(match.group(1))
    unit = match.group(2)

    multipliers = {"minute": 1, "hour": 60, "day": 1440, "week": 10080}
    return value * multipliers[unit]


@dataclass
class SimClock:
    """Manages simulation time."""

    current_tick: int = 0
    tick_duration_minutes: int = 60  # default: 1 tick = 1 hour
    max_ticks: int = 168  # default: 7 days at 1h/tick

    @classmethod
    def from_config(cls, time_step: str, duration: str) -> SimClock:
        tick_minutes = parse_duration(time_step)
        total_minutes = parse_duration(duration)
        max_ticks = total_minutes // tick_minutes
        return cls(tick_duration_minutes=tick_minutes, max_ticks=max_ticks)

    def advance(self) -> bool:
        """Advance one tick. Returns False if simulation should end."""
        if self.current_tick >= self.max_ticks:
            return False
        self.current_tick += 1
        return True

    @property
    def is_finished(self) -> bool:
        return self.current_tick >= self.max_ticks

    @property
    def progress(self) -> float:
        return self.current_tick / max(1, self.max_ticks)

    @property
    def elapsed_hours(self) -> float:
        return (self.current_tick * self.tick_duration_minutes) / 60

    @property
    def elapsed_days(self) -> float:
        return self.elapsed_hours / 24

    def format_time(self) -> str:
        """Format current time as human-readable string."""
        total_minutes = self.current_tick * self.tick_duration_minutes
        days = total_minutes // 1440
        hours = (total_minutes % 1440) // 60
        minutes = total_minutes % 60
        return f"Day {days + 1}, {hours:02d}:{minutes:02d}"

    def to_dict(self) -> dict:
        return {
            "tick": self.current_tick,
            "max_ticks": self.max_ticks,
            "time": self.format_time(),
            "progress": self.progress,
            "elapsed_hours": self.elapsed_hours,
        }
