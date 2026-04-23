"""Tests for memory system."""

from simcore.agents.memory import MemorySystem


def test_memory_context():
    mem = MemorySystem()
    mem.add(tick=1, content="Met Bob at the market")
    mem.add(tick=2, content="Bob offered a trade", importance=0.8)
    mem.update_relationship("Bob", 0.3, tick=2, note="good trade")

    context = mem.get_context()
    assert "Met Bob" in context
    assert "Bob" in context
    assert "friendly" in context.lower() or "neutral" in context.lower()


def test_high_importance_promotion():
    mem = MemorySystem()
    mem.add(tick=1, content="Routine event", importance=0.3)
    mem.add(tick=2, content="Critical event!", importance=0.9)
    assert len(mem.long_term) == 1
    assert mem.long_term[0].content == "Critical event!"


def test_reflection():
    mem = MemorySystem()
    mem.add_reflection("I learned that trading with Bob is profitable.")
    context = mem.get_context()
    assert "profitable" in context


def test_relationship_bounds():
    mem = MemorySystem()
    # Sentiment should be clamped to [-1, 1]
    mem.update_relationship("Alice", 2.0, tick=1)
    assert mem.get_relationship("Alice").sentiment == 1.0
    mem.update_relationship("Alice", -3.0, tick=2)
    assert mem.get_relationship("Alice").sentiment == -1.0
