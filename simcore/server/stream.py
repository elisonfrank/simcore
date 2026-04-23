"""WebSocket event streaming utilities."""

from __future__ import annotations

import json
import logging

from simcore.engine.events import EventType, SimEvent
from simcore.storage.database import SimulationDatabase

logger = logging.getLogger("simcore.stream")


class EventRecorder:
    """Records simulation events to the database."""

    def __init__(self, db: SimulationDatabase):
        self.db = db

    async def handle_event(self, event: SimEvent) -> None:
        """Record an event to the database."""
        await self.db.save_event(
            tick=event.tick,
            event_type=event.type.value,
            source=event.source,
            data=event.data,
        )

        # Save full state snapshot at end of each tick
        if event.type == EventType.TICK_END:
            await self.db.save_snapshot(event.tick, event.data)
