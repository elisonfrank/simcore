"""Prompt templates for agent decision-making."""

from __future__ import annotations

from jinja2 import Template

DECISION_SYSTEM_PROMPT = Template("""You are simulating a person in a social simulation.

{{ persona_prompt }}

You must stay in character at all times. Your decisions should reflect your personality, goals, and current emotional state.

Rules:
- You can only perform ONE action per turn
- Actions: move, speak, trade, interact, wait, observe, work, rest
- Consider your relationships and past experiences when deciding
- Be realistic — don't do things that wouldn't make sense for your character
""")

DECISION_USER_PROMPT = Template("""{{ state_description }}

{{ memory_context }}

Current situation:
{{ observation }}

What do you do next? Respond in JSON:
{
    "action": "move|speak|trade|interact|wait|observe|work|rest",
    "target": "<target agent name or location name>",
    "content": "<what you say, do, or trade details>",
    "reasoning": "<your internal thought process, 1-2 sentences>"
}""")

REFLECTION_PROMPT = Template("""Here are your recent experiences:

{{ memories }}

Based on these experiences, what are your key takeaways? What have you learned about:
1. Your current situation
2. The people around you
3. What you should do differently

Respond in 2-3 concise sentences.""")

OBSERVATION_PROMPT = Template("""You are at {{ location_name }} ({{ location_type }}).
{% if agents_here %}
People here: {{ agents_here | join(', ') }}.
{% else %}
You are alone.
{% endif %}
{% if recent_events %}
Recent events nearby:
{% for event in recent_events %}
- {{ event }}
{% endfor %}
{% endif %}
{% if global_context %}
World context: {{ global_context }}
{% endif %}""")
