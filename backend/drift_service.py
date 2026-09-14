from collections import Counter
from datetime import datetime, timezone
import math
import re

from backend.database import get_connection
from backend.prediction_service import model


EXPECTED_LANGUAGES = {
    "English": 1 / 3,
    "Hindi": 1 / 3,
    "Hinglish": 1 / 3
}

EXPECTED_CATEGORIES = {
    "Payment Issue": 1 / 8,
    "Delivery Issue": 1 / 8,
    "Refund Issue": 1 / 8,
    "Cancellation Issue": 1 / 8,
    "Product Issue": 1 / 8,
    "Return/Replacement": 1 / 8,
    "Account Issue": 1 / 8,
    "Fraud/Security": 1 / 8
}

MINIMUM_SAMPLE_SIZE = 30

word_vectorizer = (
    model.named_steps["features"]
    .transformer_list[0][1]
)

training_vocabulary = set(
    word_vectorizer.vocabulary_.keys()
)


def calculate_psi(expected, actual):
    epsilon = 1e-6
    psi = 0.0

    for key, expected_share in expected.items():
        actual_share = actual.get(key, 0.0)

        expected_value = max(expected_share, epsilon)
        actual_value = max(actual_share, epsilon)

        psi += (
            actual_value - expected_value
        ) * math.log(
            actual_value / expected_value
        )

    return round(psi, 4)


def drift_level(psi):
    if psi < 0.10:
        return "Stable"

    if psi < 0.25:
        return "Moderate"

    return "Significant"


def distribution(rows, key, expected_keys):
    counts = Counter(row[key] for row in rows)
    total = len(rows)

    return {
        expected_key: (
            counts.get(expected_key, 0) / total
            if total
            else 0.0
        )
        for expected_key in expected_keys
    }


def find_new_vocabulary(rows, limit=20):
    vocabulary_counter = Counter()

    for row in rows:
        tokens = re.findall(
            r"\b\w+\b",
            row["input_text"].lower(),
            flags=re.UNICODE
        )

        for token in tokens:
            if (
                len(token) > 2
                and token not in training_vocabulary
            ):
                vocabulary_counter[token] += 1

    return [
        {
            "term": term,
            "count": count
        }
        for term, count
        in vocabulary_counter.most_common(limit)
    ]


def calculate_drift():
    with get_connection() as connection:
        rows = connection.execute("""
            SELECT
                input_text,
                detected_language,
                category
            FROM predictions
            ORDER BY id DESC
            LIMIT 1000
        """).fetchall()

    production_rows = [dict(row) for row in rows]
    sample_size = len(production_rows)

    language_distribution = distribution(
        production_rows,
        "detected_language",
        EXPECTED_LANGUAGES.keys()
    )

    category_distribution = distribution(
        production_rows,
        "category",
        EXPECTED_CATEGORIES.keys()
    )

    if sample_size < MINIMUM_SAMPLE_SIZE:
        status = "Insufficient Data"
        language_psi = None
        category_psi = None
        language_level = "Pending"
        category_level = "Pending"
        alerts = [
            (
                f"Collect {MINIMUM_SAMPLE_SIZE - sample_size} "
                "more complaints before drift evaluation."
            )
        ]
    else:
        language_psi = calculate_psi(
            EXPECTED_LANGUAGES,
            language_distribution
        )

        category_psi = calculate_psi(
            EXPECTED_CATEGORIES,
            category_distribution
        )

        language_level = drift_level(language_psi)
        category_level = drift_level(category_psi)

        status = (
            "Drift Detected"
            if "Significant" in {
                language_level,
                category_level
            }
            else "Monitoring"
        )

        alerts = []

        if language_level == "Significant":
            alerts.append(
                "Significant language-distribution drift detected."
            )

        if category_level == "Significant":
            alerts.append(
                "Significant category-distribution drift detected."
            )

        if not alerts:
            alerts.append(
                "No significant distribution drift detected."
            )

    return {
        "status": status,
        "sample_size": sample_size,
        "minimum_sample_size": MINIMUM_SAMPLE_SIZE,
        "language_psi": language_psi,
        "language_drift_level": language_level,
        "category_psi": category_psi,
        "category_drift_level": category_level,
        "language_distribution": language_distribution,
        "category_distribution": category_distribution,
        "new_vocabulary": find_new_vocabulary(
            production_rows
        ),
        "alerts": alerts,
        "generated_at": datetime.now(
            timezone.utc
        ).isoformat()
    }
