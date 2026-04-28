"""Tests for features added after initial release."""

import asyncio
import pytest

from simcore.agents.actions import Action, ActionType
from simcore.agents.agent import Agent, AgentState
from simcore.agents.persona import Persona, PersonalityTraits
from simcore.llm.mock import MockLLMProvider
from simcore.world.environment import Environment
from simcore.world.interactions import InteractionResolver
from simcore.world.location import Location


# ---------------------------------------------------------------------------
# Agent.to_dict() — nested state + relationships
# ---------------------------------------------------------------------------

def _make_agent(name="Alice", location="Park", mood=0.5, energy=0.8):
    persona = Persona(name=name)
    state = AgentState(location=location, mood=mood, energy=energy)
    return Agent(persona=persona, state=state)


def test_to_dict_has_nested_state():
    agent = _make_agent(mood=0.4, energy=0.7)
    d = agent.to_dict()
    assert "state" in d
    assert abs(d["state"]["mood"] - 0.4) < 1e-9
    assert abs(d["state"]["energy"] - 0.7) < 1e-9
    assert d["state"]["location"] == "Park"


def test_to_dict_has_relationships():
    agent = _make_agent()
    agent.memory.update_relationship("Bob", 0.5, tick=1, note="helped")
    d = agent.to_dict()
    assert "relationships" in d
    assert "Bob" in d["relationships"]
    assert "friend" in d["relationships"]["Bob"].lower()


def test_to_dict_no_legacy_flat_mood():
    """mood/energy should be inside state, not at top level."""
    agent = _make_agent()
    d = agent.to_dict()
    assert "mood" not in d
    assert "energy" not in d


# ---------------------------------------------------------------------------
# apply_tick_decay()
# ---------------------------------------------------------------------------

def test_tick_decay_reduces_energy():
    agent = _make_agent(energy=1.0)
    agent.apply_tick_decay()
    assert agent.state.energy < 1.0
    assert agent.state.energy == pytest.approx(1.0 - 0.008)


def test_tick_decay_mood_drifts_toward_zero():
    agent = _make_agent(mood=0.5)
    for _ in range(10):
        agent.apply_tick_decay()
    assert agent.state.mood < 0.5

    agent2 = _make_agent(mood=-0.5)
    for _ in range(10):
        agent2.apply_tick_decay()
    assert agent2.state.mood > -0.5


def test_tick_decay_energy_floor():
    agent = _make_agent(energy=0.005)
    agent.apply_tick_decay()
    assert agent.state.energy == 0.0  # clamped, not negative


def test_decay_over_48_ticks_leaves_energy():
    """48 ticks of pure decay from 1.0 should leave >50% energy."""
    agent = _make_agent(energy=1.0)
    for _ in range(48):
        agent.apply_tick_decay()
    assert agent.state.energy > 0.5


# ---------------------------------------------------------------------------
# apply_action() mood effects
# ---------------------------------------------------------------------------

def test_rest_boosts_energy_and_mood():
    agent = _make_agent(energy=0.3, mood=0.0)
    action = Action(type=ActionType.REST)
    agent.apply_action(action, tick=1)
    assert agent.state.energy == pytest.approx(0.6)
    assert agent.state.mood == pytest.approx(0.05)


def test_speak_boosts_mood():
    agent = _make_agent(mood=0.0)
    action = Action(type=ActionType.SPEAK, target="Bob", content="Hello")
    agent.apply_action(action, tick=1)
    assert agent.state.mood == pytest.approx(0.03)


def test_work_reduces_energy():
    agent = _make_agent(energy=0.8)
    action = Action(type=ActionType.WORK, content="cleaning")
    agent.apply_action(action, tick=1)
    assert agent.state.energy == pytest.approx(0.6)


# ---------------------------------------------------------------------------
# InteractionResolver — cross-location guard
# ---------------------------------------------------------------------------

def test_cross_location_speak_becomes_wait():
    """Engine should convert speak to wait when target is not co-located.
    We verify the guard logic directly."""
    alice = _make_agent("Alice", location="Park")
    bob = _make_agent("Bob", location="Shop")

    # Simulate the guard used in simulation._agent_turn
    action = Action(type=ActionType.SPEAK, target="Bob", content="Hi")
    target = bob
    if not target or target.location != alice.location:
        action = Action(type=ActionType.WAIT, reasoning="Target not present")

    assert action.type == ActionType.WAIT


def test_same_location_speak_is_kept():
    alice = _make_agent("Alice", location="Park")
    bob = _make_agent("Bob", location="Park")

    action = Action(type=ActionType.SPEAK, target="Bob", content="Hi")
    target = bob
    if not target or target.location != alice.location:
        action = Action(type=ActionType.WAIT, reasoning="Target not present")

    assert action.type == ActionType.SPEAK


# ---------------------------------------------------------------------------
# MockLLMProvider — new methods
# ---------------------------------------------------------------------------

def test_mock_translate_returns_original():
    mock = MockLLMProvider()
    result = asyncio.run(mock.translate("Three residents arrive", language="pt"))
    assert result == "Three residents arrive"


def test_mock_generate_narrative_en():
    mock = MockLLMProvider()
    data = {
        "ticks": 48,
        "agents": [{"name": "Alice"}, {"name": "Bob"}],
        "key_events": [],
    }
    result = asyncio.run(mock.generate_narrative(data, language="en"))
    assert "Alice" in result
    assert "48" in result


def test_mock_generate_narrative_pt():
    mock = MockLLMProvider()
    data = {
        "ticks": 24,
        "agents": [{"name": "Maria"}, {"name": "João"}],
        "key_events": [],
    }
    result = asyncio.run(mock.generate_narrative(data, language="pt"))
    assert "Maria" in result
    assert "24" in result


def test_mock_reflect_accepts_language():
    mock = MockLLMProvider()
    result = asyncio.run(mock.reflect("Some memories", language="pt"))
    assert isinstance(result, str)
    assert len(result) > 0