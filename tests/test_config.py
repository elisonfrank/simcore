"""Tests for config loading and validation."""

from pathlib import Path

from simcore.config.loader import load_config
from simcore.config.schema import SimulationConfig

SCENARIOS_DIR = Path(__file__).parent.parent / "scenarios"


def test_load_marketplace_config():
    config = load_config(SCENARIOS_DIR / "marketplace" / "config.yaml")
    assert isinstance(config, SimulationConfig)
    assert config.name == "Local Marketplace"
    assert len(config.agents) == 5
    assert len(config.environment.locations) == 6


def test_agent_personality_bounds():
    config = load_config(SCENARIOS_DIR / "marketplace" / "config.yaml")
    for agent in config.agents:
        p = agent.personality
        for trait in [p.openness, p.conscientiousness, p.extraversion, p.agreeableness, p.neuroticism]:
            assert 0.0 <= trait <= 1.0


def test_config_defaults():
    config = SimulationConfig()
    assert config.name == "Untitled Simulation"
    assert config.seed == 42
    assert config.llm.model == "gpt-4o-mini"
