import uvicorn
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Dict, Any

from lookup_tables import retrieve_scores_for_zip
from schemas import (
    HAIRequest,
    HAIResponse,
)

from sk import StatelessSKBot, BotConfig

app = FastAPI()

# Configure CORS for frontend integration
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",  # Vite dev server
        "http://localhost:3001",  # Alternative Vite port
        "http://localhost:5173",  # Alternative Vite port
        "http://127.0.0.1:3000",
        "http://127.0.0.1:3001",
        "http://127.0.0.1:5173",
    ],
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS", "HEAD"],
    allow_headers=["*"],
    expose_headers=["*"],
)

bot_cfg = BotConfig()
bot = StatelessSKBot(bot_cfg)

class ChatRequest(BaseModel):
    prompts: List[str]
    data: Dict[str, Any] = {}

class ChatResponse(BaseModel):
    answer: str

@app.get("/")
async def root():
    return {"message": "Hello World from FastAPI!"}

@app.post("/score")
def get_hai_score(request: HAIRequest) -> HAIResponse:
    scores, components = retrieve_scores_for_zip(request.zipcode)
    return HAIResponse(scores=scores, key_components=components)

@app.post("/ask", response_model=ChatResponse)
async def ask_bot(req: ChatRequest):
    answer = await bot.handle_request(req.prompts, req.data)
    return ChatResponse(answer=answer)

@app.get("/sk/health")
async def sk_health():
    return {"status": "ok", "model": bot_cfg.model}

# ---------------- Entrypoint ----------------
def main():
    uvicorn.run(app, host="0.0.0.0", port=8000)

if __name__ == "__main__":
    main()