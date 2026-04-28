"""FastAPI server for simulation dashboard."""

from __future__ import annotations

import asyncio
import json
import logging
from pathlib import Path

from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from simcore.engine.events import SimEvent
from simcore.engine.simulation import SimulationEngine

logger = logging.getLogger("simcore.server")


class SimulationServer:
    """Wraps the simulation engine with a FastAPI server."""

    def __init__(self, engine: SimulationEngine):
        self.engine = engine
        self.app = create_app(engine)
        self._websockets: list[WebSocket] = []

        # Register event handler to broadcast to WebSocket clients
        engine.event_bus.on_all(self._broadcast_event)

    async def _broadcast_event(self, event: SimEvent) -> None:
        """Send events to all connected WebSocket clients."""
        if not self._websockets:
            return
        data = json.dumps(event.to_dict())
        disconnected = []
        for ws in self._websockets:
            try:
                await ws.send_text(data)
            except Exception:
                disconnected.append(ws)
        for ws in disconnected:
            self._websockets.remove(ws)

    def add_websocket(self, ws: WebSocket) -> None:
        self._websockets.append(ws)

    def remove_websocket(self, ws: WebSocket) -> None:
        if ws in self._websockets:
            self._websockets.remove(ws)


def create_app(engine: SimulationEngine | None = None) -> FastAPI:
    """Create the FastAPI application."""
    app = FastAPI(title="SimCore Dashboard", version="0.1.0")

    app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    server_state: dict = {"engine": engine, "server": None}

    @app.on_event("startup")
    async def startup():
        if engine:
            server_state["server"] = SimulationServer(engine)

    @app.get("/api/state")
    async def get_state():
        if not server_state["engine"]:
            return {"error": "No simulation loaded"}
        return server_state["engine"].get_state()

    @app.get("/api/agents")
    async def get_agents():
        if not server_state["engine"]:
            return {"error": "No simulation loaded"}
        return {
            aid: a.to_dict()
            for aid, a in server_state["engine"].agents.items()
        }

    @app.get("/api/agents/{agent_id}")
    async def get_agent(agent_id: str):
        if not server_state["engine"]:
            return {"error": "No simulation loaded"}
        agent = server_state["engine"].agents.get(agent_id)
        if not agent:
            return {"error": f"Agent '{agent_id}' not found"}
        return agent.to_dict()

    @app.get("/api/environment")
    async def get_environment():
        if not server_state["engine"]:
            return {"error": "No simulation loaded"}
        return server_state["engine"].environment.to_dict()

    @app.get("/api/clock")
    async def get_clock():
        if not server_state["engine"]:
            return {"error": "No simulation loaded"}
        return server_state["engine"].clock.to_dict()

    @app.get("/api/events")
    async def get_events(last_n: int = 50):
        if not server_state["engine"]:
            return {"error": "No simulation loaded"}
        return server_state["engine"].event_bus.get_log(last_n)

    @app.post("/api/inject")
    async def inject_event(payload: dict):
        if not server_state["engine"]:
            return {"error": "No simulation loaded"}
        description = payload.get("description", "")
        location = payload.get("location", "")
        await server_state["engine"].inject_event(description, location)
        return {"status": "ok", "description": description}

    @app.post("/api/language")
    async def set_language(payload: dict):
        """Set the simulation's content language (e.g. 'en', 'pt')."""
        if not server_state["engine"]:
            return {"error": "No simulation loaded"}
        lang = payload.get("language", "en")
        server_state["engine"].config.language = lang
        return {"status": "ok", "language": lang}

    @app.post("/api/postmortem/narrative")
    async def postmortem_narrative():
        engine = server_state["engine"]
        if not engine:
            return {"error": "No simulation loaded"}

        lang = getattr(engine.config, "language", "en")
        state = engine.get_state()
        ticks = state.get("clock", {}).get("tick", 0)

        agents_data = []
        for agent in engine.agents.values():
            rels = sorted(
                agent.memory.relationships.values(),
                key=lambda r: r.interactions,
                reverse=True,
            )[:3]
            reflections = (agent.memory._reflection_summaries or [])[-2:]
            agents_data.append({
                "name": agent.name,
                "mood": round(agent.state.mood, 2),
                "energy": round(agent.state.energy, 2),
                "reflections": reflections,
                "relationships": [r.describe() for r in rels],
            })

        all_events = engine.event_bus.get_log(500)
        key_events = [
            {
                "tick": e.get("tick", 0),
                "type": e.get("type", ""),
                "source": e.get("source", ""),
                "summary": (
                    e.get("data", {}).get("description")
                    or e.get("data", {}).get("summary")
                    or e.get("data", {}).get("result")
                    or e.get("data", {}).get("action")
                    or ""
                )[:120],
            }
            for e in all_events
            if e.get("type") in ("interaction", "scheduled_event", "injected_event", "reflection")
        ][-15:]

        data = {"ticks": ticks, "agents": agents_data, "key_events": key_events}

        try:
            narrative = await engine.llm.generate_narrative(data, lang)
            return {"narrative": narrative}
        except Exception as e:
            logger.warning(f"Narrative generation failed: {e}")
            return {"error": str(e)}

    @app.post("/api/control/{action}")
    async def control(action: str):
        if not server_state["engine"]:
            return {"error": "No simulation loaded"}
        match action:
            case "pause":
                server_state["engine"].pause()
            case "resume":
                server_state["engine"].resume()
            case "stop":
                server_state["engine"].stop()
            case _:
                return {"error": f"Unknown action: {action}"}
        return {"status": "ok", "action": action}

    @app.websocket("/ws")
    async def websocket_endpoint(websocket: WebSocket):
        await websocket.accept()
        srv = server_state.get("server")
        if srv:
            srv.add_websocket(websocket)
        try:
            while True:
                data = await websocket.receive_text()
                # Handle commands from dashboard
                try:
                    cmd = json.loads(data)
                    if cmd.get("type") == "inject":
                        await server_state["engine"].inject_event(
                            cmd.get("description", ""),
                            cmd.get("location", ""),
                        )
                except json.JSONDecodeError:
                    pass
        except WebSocketDisconnect:
            if srv:
                srv.remove_websocket(websocket)

    # Serve dashboard static files if they exist
    dashboard_dist = Path(__file__).parent.parent.parent / "dashboard" / "dist"
    if dashboard_dist.exists():
        app.mount("/", StaticFiles(directory=str(dashboard_dist), html=True))

    return app
