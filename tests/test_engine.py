"""Tests for simulation engine components."""

from simcore.engine.clock import SimClock, parse_duration
from simcore.engine.events import EventBus, EventType, SimEvent
from simcore.world.environment import Environment
from simcore.world.location import Location


def test_parse_duration():
    assert parse_duration("1 hour") == 60
    assert parse_duration("30 minutes") == 30
    assert parse_duration("7 days") == 10080
    assert parse_duration("2 weeks") == 20160


def test_clock_from_config():
    clock = SimClock.from_config("1 hour", "3 days")
    assert clock.tick_duration_minutes == 60
    assert clock.max_ticks == 72  # 3 days * 24 hours


def test_clock_advance():
    clock = SimClock(max_ticks=3)
    assert clock.advance()  # tick 1
    assert clock.advance()  # tick 2
    assert clock.advance()  # tick 3
    assert not clock.advance()  # done


def test_clock_format_time():
    clock = SimClock(tick_duration_minutes=60)
    clock.current_tick = 25
    assert "Day 2" in clock.format_time()


def test_environment_locations():
    env = Environment()
    env.add_location(Location(name="Park", position=(5, 5)))
    env.add_location(Location(name="Shop", position=(10, 10)))
    assert len(env.locations) == 2
    assert env.get_location("Park") is not None


def test_environment_move_agent():
    env = Environment()
    env.add_location(Location(name="A", capacity=10))
    env.add_location(Location(name="B", capacity=10))
    env.place_agent("agent1", "A")
    assert "agent1" in env.get_agents_at("A")

    env.move_agent("agent1", "A", "B")
    assert "agent1" not in env.get_agents_at("A")
    assert "agent1" in env.get_agents_at("B")


def test_location_capacity():
    loc = Location(name="Small Room", capacity=1)
    assert loc.add_occupant("agent1")
    assert not loc.add_occupant("agent2")  # full
    assert loc.is_full


async def test_event_bus():
    bus = EventBus()
    received = []

    async def handler(event: SimEvent):
        received.append(event)

    bus.on(EventType.AGENT_ACTION, handler)
    await bus.emit(SimEvent(type=EventType.AGENT_ACTION, tick=1, data={"test": True}))
    assert len(received) == 1
    assert received[0].data["test"] is True
