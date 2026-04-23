"""Simple in-memory response cache with TTL."""

from __future__ import annotations

import hashlib
import time
from dataclasses import dataclass


@dataclass
class CacheEntry:
    value: str
    timestamp: float


class ResponseCache:
    """In-memory LLM response cache."""

    def __init__(self, ttl_seconds: int = 300, max_size: int = 1000):
        self._store: dict[str, CacheEntry] = {}
        self.ttl = ttl_seconds
        self.max_size = max_size

    def _hash_key(self, key: str) -> str:
        return hashlib.sha256(key.encode()).hexdigest()[:32]

    def get(self, key: str) -> str | None:
        hashed = self._hash_key(key)
        entry = self._store.get(hashed)
        if entry is None:
            return None
        if time.time() - entry.timestamp > self.ttl:
            del self._store[hashed]
            return None
        return entry.value

    def set(self, key: str, value: str) -> None:
        if len(self._store) >= self.max_size:
            # Evict oldest entry
            oldest_key = min(self._store, key=lambda k: self._store[k].timestamp)
            del self._store[oldest_key]
        hashed = self._hash_key(key)
        self._store[hashed] = CacheEntry(value=value, timestamp=time.time())

    def clear(self) -> None:
        self._store.clear()
