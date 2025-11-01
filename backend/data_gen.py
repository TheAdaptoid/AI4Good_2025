from random import randint

from schemas import HAIScores, Region


def generate_random_scores() -> HAIScores:
    pca = round(randint(0, 100) / 100, 2)
    lin = round(randint(0, 100) / 100, 2)
    ann = round(randint(0, 100) / 100, 2)
    avg = round((pca + lin + ann) / 3, 2)
    return HAIScores(pca_score=pca, lin_score=lin, ann_score=ann, avg_score=avg)


def generate_random_region() -> Region:
    return Region(zipcode=randint(10000, 99999), scores=generate_random_scores())
