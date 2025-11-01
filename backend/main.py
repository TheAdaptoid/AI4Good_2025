import uvicorn
from fastapi import FastAPI

from data_gen import generate_random_region, generate_random_scores
from schemas import (
    HAIRequest,
    HAIResponse,
    PrincipalComponent,
    SimilarityRequest,
    SimilarityResponse,
)

app = FastAPI()


@app.get("/")
async def root():
    return {"message": "Hello World from FastAPI!"}


@app.post("/score")
def get_hai_score(request: HAIRequest) -> HAIResponse:
    return HAIResponse(
        scores=generate_random_scores(),
        key_components=[
            PrincipalComponent(name="PC1", influence="positive", score=0.8),
            PrincipalComponent(name="PC2", influence="negative", score=-0.5),
        ],
    )


@app.post("/similar")
def get_similar_regions(request: SimilarityRequest) -> SimilarityResponse:
    return SimilarityResponse(
        similar_regions=[generate_random_region() for _ in range(request.n_regions)]
    )


def main():
    uvicorn.run(app, host="0.0.0.0", port=8000)


if __name__ == "__main__":
    main()
