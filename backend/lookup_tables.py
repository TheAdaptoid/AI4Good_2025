import json

import pandas as pd

from schemas import Component, HAIScores


def retrieve_hai_scores(geoid: int) -> HAIScores:
    hai_lookup: pd.DataFrame = pd.read_csv("../testing/data/HAI-Lookup-Table.csv")
    hai_row = hai_lookup[hai_lookup["Geo ID"] == geoid]
    if hai_row.empty:
        raise ValueError(f"No HAI scores found for GEOID: {geoid}")
    return HAIScores(**hai_row.iloc[0].to_dict())


def retrieve_comp_description(comp_name: str) -> str:
    map_path = "../testing/data/name_desc_map.json"
    with open(map_path, "r") as f:
        name_desc_map = json.load(f)
    return name_desc_map.get(comp_name, "No description available.")


def retrieve_components(geoid: int) -> list[Component]:
    component_lookup: pd.DataFrame = pd.read_csv(
        "../testing/data/HAI-Partial-Outputs.csv"
    )
    component_row = component_lookup[component_lookup["Geo ID"] == geoid]
    component_json = json.loads(component_row.to_json(orient="records"))[0]
    if component_row.empty:
        raise ValueError(f"No components found for GEOID: {geoid}")
    components = []
    for comp_name, comp_value in component_json.items():
        if comp_name in ["Geo ID", "bias", "linear_hai"]:
            continue

        component = Component(
            name=comp_name,
            description=retrieve_comp_description(comp_name),
            influence="positive" if comp_value <= 0 else "negative",
            score=comp_value,
        )
        components.append(component)
    # print(component_json)
    return components


def convert_zip_to_geoid(zipcode: int) -> list[int]:
    conversion_table: pd.DataFrame = pd.read_csv("../testing/data/ZIP_TRACT_062025.csv")
    matching_rows = conversion_table[conversion_table["ZIP"] == zipcode]
    if matching_rows.empty:
        raise ValueError(f"No GEOID found for ZIP code: {zipcode}")
    return matching_rows["TRACT"].astype(int).tolist()


def retrieve_scores_for_zip(zipcode: int) -> tuple[HAIScores, list[Component]]:
    geoids = convert_zip_to_geoid(zipcode)
    all_scores = []
    all_components: list[list[Component]] = []

    for geoid in geoids:
        try:
            scores = retrieve_hai_scores(geoid)
            components = retrieve_components(geoid)
            all_scores.append(scores)
            all_components.append(components)
        except ValueError as e:
            print(e)
            continue

    if len(all_scores) == 0:
        return HAIScores(
            linear_hai=0.0,
            forest_hai=0.0,
            nn_hai=0.0,
            average_hai=-1,  # Negative to indicate no data
        ), []

    # Average the scores across all GEOIDs
    lin_score = sum(s.linear_hai for s in all_scores) / len(all_scores)
    forest_score = sum(s.forest_hai for s in all_scores) / len(all_scores)
    nn_score = sum(s.nn_hai for s in all_scores) / len(all_scores)
    score_obj = HAIScores(
        linear_hai=lin_score,
        forest_hai=forest_score,
        nn_hai=nn_score,
        average_hai=(lin_score + forest_score + nn_score) / 3,
    )

    # Combine components from all GEOIDs
    combined_components = all_components[0]
    for comp_list in all_components[1:]:
        for comp in comp_list:
            for existing_comp in combined_components:
                if existing_comp.name == comp.name:
                    existing_comp.score += comp.score
                    break
            else:
                combined_components.append(comp)
    # Average component scores
    for comp in combined_components:
        comp.score /= len(geoids)

    # Sort components by absolute score and take top 5
    combined_components.sort(key=lambda c: abs(c.score), reverse=True)
    top_components = combined_components[:5]

    return score_obj, top_components


def main():
    _, comps = retrieve_scores_for_zip(32246)
    print(json.dumps([c.model_dump() for c in comps], indent=4))
    pass


if __name__ == "__main__":
    main()
