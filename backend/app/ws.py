"""WebSocket connection manager — broadcasts real events to connected dashboards."""
import asyncio, json
from datetime import datetime
from typing import Set
from fastapi import WebSocket


class ConnectionManager:
    def __init__(self):
        self.active: Set[WebSocket] = set()

    async def connect(self, ws: WebSocket):
        await ws.accept()
        self.active.add(ws)

    def disconnect(self, ws: WebSocket):
        self.active.discard(ws)

    async def broadcast(self, event: str, payload: dict):
        msg = {"type": event, "ts": datetime.utcnow().isoformat() + "Z", **(payload or {})}
        data = json.dumps(msg, default=str)
        stale = []
        for ws in list(self.active):
            try:
                await ws.send_text(data)
            except Exception:
                stale.append(ws)
        for ws in stale:
            self.disconnect(ws)


manager = ConnectionManager()


def make_broadcast(loop: asyncio.AbstractEventLoop):
    """Return a thread-safe sync broadcast callable for the simulation engine."""
    def broadcast(event: str, payload: dict):
        try:
            asyncio.run_coroutine_threadsafe(manager.broadcast(event, payload), loop)
        except Exception:
            pass
    return broadcast
