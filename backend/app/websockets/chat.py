from fastapi import WebSocket


class ConnectionManager:
    """
    Gère les connexions WebSocket actives.
    Chaque conversation a sa propre liste de connexions.
    """

    def __init__(self):
        self.active: dict[str, list[WebSocket]] = {}

    async def connect(self, conversation_id: str, websocket: WebSocket):
        await websocket.accept()
        if conversation_id not in self.active:
            self.active[conversation_id] = []
        self.active[conversation_id].append(websocket)

    def disconnect(self, conversation_id: str, websocket: WebSocket):
        if conversation_id in self.active:
            self.active[conversation_id].remove(websocket)

    async def broadcast(self, conversation_id: str, message: dict):
        """Envoie un message à tous les participants de la conversation."""
        for websocket in self.active.get(conversation_id, []):
            await websocket.send_json(message)


manager = ConnectionManager()
