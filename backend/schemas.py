from typing import Literal

from pydantic import BaseModel, Field


class PrincipalComponent(BaseModel):
    """
    Represents a single principal component contributing to a PCA-derived score.

    Attributes:
        name: The name or identifier of the principal component.
        influence: Whether the component's contribution is "positive" or "negative".
        score: A numeric influence score. Higher magnitude indicates greater
            influence; sign indicates direction if relevant.

    """

    name: str = Field(..., description="The name of the principal component.")
    influence: Literal["positive", "negative"] = Field(
        ...,
        description="Indicates whether the principal component "
        "has a positive or negative influence.",
    )
    score: float = Field(
        ...,
        description="The influence score of the principal component. Higher "
        "is more influential. Ranges from negative infinity to positive infinity.",
    )


class HAIScores(BaseModel):
    """
    Aggregated model scores describing a region's HAI (Humanitarian AI) risk.

    This model groups individual model outputs and their combined average.

    Attributes:
        pca_score: Score produced by a PCA-based model.
        lin_score: Score produced by a linear model.
        ann_score: Score produced by an artificial neural network model.
        avg_score: The average of the above model scores.

    """

    pca_score: float = Field(
        ..., description="The PCA score indicating the risk level."
    )
    lin_score: float = Field(
        ..., description="The LIN score indicating the risk level."
    )
    ann_score: float = Field(
        ..., description="The ANN score indicating the risk level."
    )
    avg_score: float = Field(..., description="The average score from all models.")


class HAIRequest(BaseModel):
    """
    Request payload for querying HAI scores for a single region.

    Attributes:
        zipcode: The postal code identifying the target region.

    """

    zipcode: int = Field(..., description="The postal code for the location.")


class HAIResponse(BaseModel):
    """
    Response containing HAI model scores and the main PCA components.

    Attributes:
        scores: An instance of `HAIScores` with model outputs.
        key_components: Top principal components (usually top 5) that most
            contributed to the `pca_score`.

    """

    scores: HAIScores = Field(..., description="The HAI scores from different models.")
    key_components: list[PrincipalComponent] = Field(
        ...,
        description="A list of the top 5 components contributing to the PCA score.",
    )


class Region(BaseModel):
    """
    Represents a geographic region together with its HAI scores.

    Attributes:
        zipcode: Postal code for the region.
        scores: The HAI scores associated with the region.

    """

    zipcode: int = Field(..., description="The postal code for the region.")
    scores: HAIScores = Field(..., description="The HAI scores for the region.")


class SimilarityRequest(BaseModel):
    """
    Request model for retrieving regions similar to a given zipcode.

    Attributes:
        zipcode: The postal code for which to find similar regions.
        n_regions: Number of similar regions to return (default: 5).

    """

    zipcode: int = Field(..., description="The postal code for the location.")
    n_regions: int = Field(
        5,
        description="The number of similar regions to retrieve. Default is 5.",
    )


class SimilarityResponse(BaseModel):
    """
    Response payload listing regions similar to the requested zipcode.

    Attributes:
        similar_regions: A list of `Region` objects ordered by similarity (most
            similar first).

    """

    similar_regions: list[Region] = Field(
        ..., description="A list of regions similar to the requested region."
    )
