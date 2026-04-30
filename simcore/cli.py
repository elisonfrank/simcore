"""SimCore CLI — command-line interface."""

from __future__ import annotations

import asyncio
import logging
import shutil
import webbrowser
from pathlib import Path

import click
from rich.console import Console
from rich.live import Live
from rich.table import Table

from simcore import __version__

console = Console()


def setup_logging(verbose: bool = False) -> None:
    level = logging.DEBUG if verbose else logging.INFO
    logging.basicConfig(
        level=level,
        format="%(asctime)s [%(name)s] %(levelname)s: %(message)s",
        datefmt="%H:%M:%S",
    )


@click.group()
@click.version_option(version=__version__, prog_name="simcore")
def main():
    """SimCore — Social simulation engine powered by LLM agents."""
    pass


@main.command()
@click.argument("config_path", type=click.Path(exists=True))
@click.option("--dashboard", is_flag=True, help="Launch dashboard in browser")
@click.option("--headless", is_flag=True, help="Run without UI (faster)")
@click.option("--output", "-o", type=click.Path(), help="Output directory for results")
@click.option("--port", default=8420, help="Dashboard server port")
@click.option("--demo", is_flag=True, help="Run in demo mode (no LLM API key needed)")
@click.option("--speed", default=1.0, help="Seconds between ticks (lower = faster)")
@click.option("--verbose", "-v", is_flag=True, help="Verbose logging")
def run(config_path: str, dashboard: bool, headless: bool, output: str | None,
        port: int, demo: bool, speed: float, verbose: bool):
    """Run a simulation from a YAML config file."""
    setup_logging(verbose)

    from simcore.config.loader import load_config
    from simcore.engine.events import EventType, SimEvent
    from simcore.engine.simulation import SimulationEngine
    from simcore.server.stream import EventRecorder
    from simcore.storage.database import SimulationDatabase

    config = load_config(config_path)
    console.print(f"[bold green]SimCore v{__version__}[/bold green]")
    console.print(f"  Simulation: [bold]{config.name}[/bold]")
    console.print(f"  Agents: {len(config.agents)}")
    console.print(f"  Duration: {config.duration}")
    if demo:
        console.print(f"  Mode: [bold yellow]DEMO[/bold yellow] (no LLM)")
    else:
        console.print(f"  LLM: {config.llm.model}")
    console.print(f"  Speed: {speed}s/tick")
    console.print()

    engine = SimulationEngine(config, demo_mode=demo, tick_delay=speed)

    async def _run():
        # Setup database
        db_path = Path(output) / "simulation.db" if output else None
        db = SimulationDatabase(db_path)
        await db.connect()

        # Save config metadata
        import json
        await db.save_metadata("config", json.dumps(config.model_dump(), default=str))

        # Register event recorder
        recorder = EventRecorder(db)
        engine.event_bus.on_all(recorder.handle_event)

        # Console progress handler
        if not headless:
            async def on_tick_end(event: SimEvent):
                if event.type == EventType.TICK_END:
                    clock = event.data.get("clock", {})
                    progress = clock.get("progress", 0)
                    time_str = clock.get("time", "")
                    bar_len = 30
                    filled = int(bar_len * progress)
                    bar = "█" * filled + "░" * (bar_len - filled)
                    console.print(
                        f"\r  [{bar}] {progress:.0%} — {time_str}",
                        end="",
                    )

            engine.event_bus.on(EventType.TICK_END, on_tick_end)

            async def on_action(event: SimEvent):
                if event.type in (EventType.AGENT_ACTION, EventType.AGENT_SPEAK, EventType.AGENT_MOVE):
                    action = event.data.get("action", "")
                    console.print(f"\n    [dim]{event.source}[/dim]: {action}")

            engine.event_bus.on(EventType.AGENT_ACTION, on_action)
            engine.event_bus.on(EventType.AGENT_SPEAK, on_action)
            engine.event_bus.on(EventType.AGENT_MOVE, on_action)

        if dashboard:
            # Run server + simulation concurrently
            import uvicorn
            from simcore.server.api import create_app
            from simcore.server.scenarios import ScenarioStore

            app = create_app(engine, scenario_store=ScenarioStore())
            config_uvicorn = uvicorn.Config(app, host="0.0.0.0", port=port, log_level="warning")
            server = uvicorn.Server(config_uvicorn)

            console.print(f"  Dashboard: [link]http://localhost:{port}[/link]")
            console.print()
            # webbrowser.open(f"http://localhost:{port}")

            await asyncio.gather(
                server.serve(),
                engine.run(),
            )
        else:
            console.print("  Running simulation...\n")
            await engine.run()

        await db.close()
        console.print(f"\n\n[bold green]✓[/bold green] Simulation complete!")
        console.print(f"  Results saved to: {db.path}")
        console.print(f"  LLM calls: {engine.llm.stats['total_calls']}")
        console.print(f"  Cache hits: {engine.llm.stats['cache_hits']}")

    asyncio.run(_run())


@main.command()
@click.argument("name")
@click.option("--template", "-t", default="marketplace",
              type=click.Choice(["marketplace", "city", "epidemic", "school"]),
              help="Scenario template to use")
def init(name: str, template: str):
    """Create a new scenario from a template."""
    scenarios_dir = Path(__file__).parent.parent / "scenarios"
    template_dir = scenarios_dir / template

    target_dir = Path(name)
    if target_dir.exists():
        console.print(f"[red]Error:[/red] Directory '{name}' already exists")
        raise SystemExit(1)

    if template_dir.exists():
        shutil.copytree(template_dir, target_dir)
        console.print(f"[green]✓[/green] Created scenario '{name}' from template '{template}'")
        console.print(f"  Edit {target_dir / 'config.yaml'} to customize")
        console.print(f"  Run with: simcore run {target_dir / 'config.yaml'}")
    else:
        target_dir.mkdir(parents=True)
        console.print(f"[yellow]⚠[/yellow] Template '{template}' not found, created empty directory")
        console.print(f"  Create a config.yaml in {target_dir}")


@main.command()
@click.argument("db_path", type=click.Path(exists=True))
@click.option("--port", default=8420, help="Server port")
def serve(db_path: str, port: int):
    """Serve the dashboard for a completed simulation."""
    console.print(f"[bold green]SimCore Dashboard[/bold green]")
    console.print(f"  Database: {db_path}")
    console.print(f"  URL: [link]http://localhost:{port}[/link]")
    # TODO: implement replay server
    console.print("[yellow]Replay server coming soon[/yellow]")


@main.command()
@click.option("--port", default=8420, help="Dashboard server port")
@click.option("--verbose", "-v", is_flag=True, help="Verbose logging")
def manage(port: int, verbose: bool):
    """Start the scenario manager — browse and launch scenarios from the dashboard."""
    setup_logging(verbose)

    import uvicorn
    from simcore.server.api import create_app
    from simcore.server.scenarios import ScenarioStore

    app = create_app(scenario_store=ScenarioStore())

    async def _run():
        config_uvicorn = uvicorn.Config(app, host="0.0.0.0", port=port, log_level="warning")
        server = uvicorn.Server(config_uvicorn)
        console.print(f"[bold green]SimCore v{__version__}[/bold green]")
        console.print(f"  Mode: [bold cyan]Scenario Manager[/bold cyan]")
        console.print(f"  Dashboard: [link]http://localhost:{port}[/link]")
        console.print()
        webbrowser.open(f"http://localhost:{port}")
        await server.serve()

    asyncio.run(_run())


if __name__ == "__main__":
    main()
