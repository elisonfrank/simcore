"""SQLite storage for simulation snapshots and replay."""

from __future__ import annotations

import json
import logging
from datetime import datetime
from pathlib import Path

import aiosqlite

logger = logging.getLogger("simcore.storage")


class SimulationDatabase:
    """Async SQLite database for persisting simulation state."""

    def __init__(self, path: str | Path | None = None):
        if path is None:
            timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
            path = Path(f"results/sim_{timestamp}.db")
        self.path = Path(path)
        self.path.parent.mkdir(parents=True, exist_ok=True)
        self._db: aiosqlite.Connection | None = None

    async def connect(self) -> None:
        self._db = await aiosqlite.connect(str(self.path))
        await self._db.execute("PRAGMA journal_mode=WAL")
        await self._create_tables()

    async def close(self) -> None:
        if self._db:
            await self._db.close()
            self._db = None

    async def _create_tables(self) -> None:
        assert self._db
        await self._db.executescript("""
            CREATE TABLE IF NOT EXISTS metadata (
                key TEXT PRIMARY KEY,
                value TEXT
            );
            CREATE TABLE IF NOT EXISTS snapshots (
                tick INTEGER PRIMARY KEY,
                state TEXT NOT NULL,
                timestamp TEXT DEFAULT CURRENT_TIMESTAMP
            );
            CREATE TABLE IF NOT EXISTS events (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                tick INTEGER NOT NULL,
                type TEXT NOT NULL,
                source TEXT DEFAULT '',
                data TEXT NOT NULL,
                timestamp TEXT DEFAULT CURRENT_TIMESTAMP
            );
            CREATE INDEX IF NOT EXISTS idx_events_tick ON events(tick);
            CREATE INDEX IF NOT EXISTS idx_events_type ON events(type);
        """)

    async def save_metadata(self, key: str, value: str) -> None:
        assert self._db
        await self._db.execute(
            "INSERT OR REPLACE INTO metadata (key, value) VALUES (?, ?)",
            (key, value),
        )
        await self._db.commit()

    async def save_snapshot(self, tick: int, state: dict) -> None:
        assert self._db
        await self._db.execute(
            "INSERT OR REPLACE INTO snapshots (tick, state) VALUES (?, ?)",
            (tick, json.dumps(state)),
        )
        await self._db.commit()

    async def save_event(self, tick: int, event_type: str, source: str, data: dict) -> None:
        assert self._db
        await self._db.execute(
            "INSERT INTO events (tick, type, source, data) VALUES (?, ?, ?, ?)",
            (tick, event_type, source, json.dumps(data)),
        )
        await self._db.commit()

    async def get_snapshot(self, tick: int) -> dict | None:
        assert self._db
        async with self._db.execute(
            "SELECT state FROM snapshots WHERE tick = ?", (tick,)
        ) as cursor:
            row = await cursor.fetchone()
            return json.loads(row[0]) if row else None

    async def get_all_ticks(self) -> list[int]:
        assert self._db
        async with self._db.execute(
            "SELECT tick FROM snapshots ORDER BY tick"
        ) as cursor:
            rows = await cursor.fetchall()
            return [r[0] for r in rows]

    async def get_events(self, tick: int | None = None, event_type: str | None = None,
                         limit: int = 100) -> list[dict]:
        assert self._db
        query = "SELECT tick, type, source, data FROM events"
        conditions = []
        params: list = []

        if tick is not None:
            conditions.append("tick = ?")
            params.append(tick)
        if event_type is not None:
            conditions.append("type = ?")
            params.append(event_type)

        if conditions:
            query += " WHERE " + " AND ".join(conditions)
        query += f" ORDER BY id DESC LIMIT {limit}"

        async with self._db.execute(query, params) as cursor:
            rows = await cursor.fetchall()
            return [
                {"tick": r[0], "type": r[1], "source": r[2], "data": json.loads(r[3])}
                for r in rows
            ]

    async def get_metadata(self, key: str) -> str | None:
        assert self._db
        async with self._db.execute(
            "SELECT value FROM metadata WHERE key = ?", (key,)
        ) as cursor:
            row = await cursor.fetchone()
            return row[0] if row else None
