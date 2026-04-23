"""Environment — the world where agents live and interact."""

from __future__ import annotations

import logging
from dataclasses import dataclass, field

from simcore.world.location import Location

logger = logging.getLogger("simcore.world")


@dataclass
class Environment:
    """Grid-based environment with named locations."""

    width: int = 20
    height: int = 20
    locations: dict[str, Location] = field(default_factory=dict)
    global_state: dict[str, object] = field(default_factory=dict)
    _event_log: list[dict] = field(default_factory=list, repr=False)

    def add_location(self, location: Location) -> None:
        self.locations[location.name] = location

    def get_location(self, name: str) -> Location | None:
        return self.locations.get(name)

    def move_agent(self, agent_id: str, from_loc: str, to_loc: str) -> bool:
        """Move an agent from one location to another."""
        dest = self.locations.get(to_loc)
        if dest is None:
            logger.warning(f"Location '{to_loc}' does not exist")
            return False
        if dest.is_full:
            logger.info(f"Location '{to_loc}' is full, agent {agent_id} can't move there")
            return False

        source = self.locations.get(from_loc)
        if source:
            source.remove_occupant(agent_id)
        dest.add_occupant(agent_id)
        return True

    def place_agent(self, agent_id: str, location_name: str) -> bool:
        """Place an agent at a location (initial placement)."""
        loc = self.locations.get(location_name)
        if loc is None:
            # Place at first available location
            if self.locations:
                loc = next(iter(self.locations.values()))
                logger.info(f"Location '{location_name}' not found, placing {agent_id} at '{loc.name}'")
            else:
                logger.warning("No locations in environment")
                return False
        return loc.add_occupant(agent_id)

    def get_agents_at(self, location_name: str) -> list[str]:
        """Get all agent IDs at a given location."""
        loc = self.locations.get(location_name)
        return loc.get_occupants() if loc else []

    def get_nearby_agents(self, location_name: str, agent_id: str) -> list[str]:
        """Get other agents at the same location."""
        agents = self.get_agents_at(location_name)
        return [a for a in agents if a != agent_id]

    def log_event(self, tick: int, event_type: str, description: str,
                  location: str = "", agents: list[str] | None = None) -> None:
        """Log an event that happened in the environment."""
        self._event_log.append({
            "tick": tick,
            "type": event_type,
            "description": description,
            "location": location,
            "agents": agents or [],
        })

    def get_recent_events(self, tick: int, window: int = 5) -> list[dict]:
        """Get events from the last N ticks."""
        return [e for e in self._event_log if e["tick"] >= tick - window]

    def get_location_names(self) -> list[str]:
        return list(self.locations.keys())

    def to_dict(self) -> dict:
        return {
            "width": self.width,
            "height": self.height,
            "locations": {name: loc.to_dict() for name, loc in self.locations.items()},
            "global_state": self.global_state,
        }
