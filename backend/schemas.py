from typing import Literal

from pydantic import BaseModel, Field


class Component(BaseModel):
    """Represents a single predictor contributing to the HAI score."""

    name: str = Field(..., description="The name of the predictor.")
    description: str = Field(..., description="A brief description of the predictor.")
    influence: Literal["positive", "negative"] = Field(
        ...,
        description="Indicates whether the predictor "
        "has a positive or negative influence on the HAI score.",
    )
    score: float = Field(
        ...,
        description="The influence score of the predictor. Higher "
        "is more influential. Ranges from negative infinity to positive infinity.",
    )
    true_value: float = Field(
        ...,
        description="The true input feature value."
    )


class HAIScores(BaseModel):
    """
    Data model representing Health Access Index (HAI) scores produced by multiple predictive models.

    Attributes:
        linear_hai (float): HAI score predicted by the linear regression model.
        forest_hai (float): HAI score predicted by the random forest model.
        nn_hai (float): HAI score predicted by the neural network model.
        average_hai (float): Aggregate HAI score across the models (typically the arithmetic mean).

    """

    linear_hai: float = Field(
        ..., description="HAI score from the linear regression model."
    )
    forest_hai: float = Field(
        ..., description="HAI score from the random forest model."
    )
    nn_hai: float = Field(..., description="HAI score from the neural network model.")
    average_hai: float = Field(..., description="Average HAI score across all models.")


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
    key_components: list[Component] = Field(
        ...,
        description="A list of the top 5 components contributing to the PCA score.",
    )
