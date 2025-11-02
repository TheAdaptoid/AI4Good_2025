import uvicorn
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from lookup_tables import retrieve_scores_for_zip
from schemas import (
    HAIRequest,
    HAIResponse,
)

app = FastAPI()

# Configure CORS for frontend integration
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",  # Vite dev server
        "http://localhost:5173",  # Alternative Vite port
        "http://127.0.0.1:3000",
        "http://127.0.0.1:5173",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/")
async def root():
    return {"message": "Hello World from FastAPI!"}


@app.post("/score")
def get_hai_score(request: HAIRequest) -> HAIResponse:
    scores, components = retrieve_scores_for_zip(request.zipcode)
    return HAIResponse(scores=scores, key_components=components)


def main():
    uvicorn.run(app, host="0.0.0.0", port=8000)


if __name__ == "__main__":
    main()
