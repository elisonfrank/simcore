"""Tests for agent system."""

from simcore.agents.actions import Action, ActionType
from simcore.agents.agent import Agent, AgentState
from simcore.agents.memory import MemorySystem
from simcore.agents.persona import Persona, PersonalityTraits


def test_persona_description():
    traits = PersonalityTraits(openness=0.9, conscientiousness=0.2, extraversion=0.8)
    desc = traits.describe()
    assert "curious" in desc
    assert "flexible" in desc
    assert "outgoing" in desc


def test_persona_prompt():
    persona = Persona(
        name="Alice",
        age=30,
        profession="teacher",
        goals=("educate students", "write a book"),
    )
    prompt = persona.to_prompt()
    assert "Alice" in prompt
    assert "teacher" in prompt
    assert "educate students" in prompt


def test_agent_memory():
    memory = MemorySystem(short_term_limit=5)
    for i in range(10):
        memory.add(tick=i, content=f"Event {i}")
    # Only last 5 should remain in short-term
    assert len(memory.short_term) == 5
    assert memory.short_term[0].content == "Event 5"


def test_agent_relationships():
    memory = MemorySystem()
    memory.update_relationship("Bob", 0.3, tick=1, note="helped me")
    memory.update_relationship("Bob", 0.2, tick=2, note="shared food")
    rel = memory.get_relationship("Bob")
    assert rel is not None
    assert rel.sentiment == 0.5
    assert rel.interactions == 2


def test_agent_action_apply():
    persona = Persona(name="Test")
    agent = Agent(persona=persona, state=AgentState(location="Park", energy=0.8))
    action = Action(type=ActionType.WORK, content="cleaning")
    agent.apply_action(action, tick=1)
    assert abs(agent.state.energy - 0.6) < 1e-9  # -0.2
    assert agent.state.current_action == action


def test_action_describe():
    action = Action(type=ActionType.SPEAK, target="Bob", content="Hello!")
    assert 'says to Bob: "Hello!"' in action.describe()

    action = Action(type=ActionType.MOVE, target="Park")
    assert "moves to Park" in action.describe()
