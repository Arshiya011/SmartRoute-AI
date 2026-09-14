from pathlib import Path
import re
import time

import joblib
import numpy as np


PROJECT_ROOT = Path(__file__).resolve().parent.parent

MODEL_PATH = (
    PROJECT_ROOT
    / "models/baseline/tfidf_logistic_regression.joblib"
)

model = joblib.load(MODEL_PATH)

feature_extractor = model.named_steps["features"]
classifier = model.named_steps["classifier"]
feature_names = feature_extractor.get_feature_names_out()


DEPARTMENT_MAP = {
    "Payment Issue": "Payments Team",
    "Delivery Issue": "Logistics Team",
    "Refund Issue": "Refund Team",
    "Cancellation Issue": "Order Management",
    "Product Issue": "Product Support",
    "Return/Replacement": "Returns Team",
    "Account Issue": "Account Support",
    "Fraud/Security": "Security Team"
}


HINGLISH_MARKERS = {
    "mera", "meri", "mere", "maine", "mujhe",
    "nahi", "abhi", "tak", "gaya", "gayi",
    "hua", "hui", "hai", "hoon", "paise",
    "karna", "karo", "chahiye", "kyunki"
}


CRITICAL_TERMS = [
    "fraud",
    "hacked",
    "hack",
    "unauthorised",
    "unauthorized",
    "unknown transaction",
    "without permission",
    "suspicious transaction",
    "अनजान लेन-देन",
    "हैक",
    "बिना अनुमति"
]


HIGH_TERMS = [
    "deducted",
    "debited",
    "charged twice",
    "refund",
    "damaged",
    "defective",
    "payment failed",
    "पैसे कट",
    "रिफंड",
    "खराब",
    "deduct",
    "debit"
]


def detect_language(text):
    if re.search(r"[\u0900-\u097F]", text):
        return "Hindi"

    words = set(re.findall(r"[a-zA-Z]+", text.lower()))

    if words.intersection(HINGLISH_MARKERS):
        return "Hinglish"

    return "English"


def assign_priority(text, category):
    normalized_text = text.lower()

    if category == "Fraud/Security":
        return "Critical"

    if any(
        term in normalized_text
        for term in CRITICAL_TERMS
    ):
        return "Critical"

    if any(
        term in normalized_text
        for term in HIGH_TERMS
    ):
        return "High"

    if category in {
        "Payment Issue",
        "Refund Issue",
        "Product Issue"
    }:
        return "High"

    return "Medium"


def explain_prediction(text, predicted_category, top_n=6):
    transformed_text = feature_extractor.transform([text])

    class_index = np.where(
        classifier.classes_ == predicted_category
    )[0][0]

    coefficients = classifier.coef_[class_index]

    contributions = (
        transformed_text.multiply(coefficients)
        .toarray()[0]
    )

    # Prefer understandable word features over character fragments.
    word_indexes = np.array([
        index
        for index, name in enumerate(feature_names)
        if name.startswith("word_tfidf__")
        and contributions[index] > 0
    ])

    if len(word_indexes) == 0:
        return []

    ranked_indexes = word_indexes[
        np.argsort(contributions[word_indexes])[::-1]
    ][:top_n]

    explanations = []

    for index in ranked_indexes:
        term = feature_names[index].replace(
            "word_tfidf__",
            ""
        )

        explanations.append({
            "term": term,
            "contribution": round(
                float(contributions[index]),
                4
            )
        })

    return explanations


def predict_complaint(text, review_threshold=0.60):
    if not isinstance(text, str) or not text.strip():
        raise ValueError("Complaint text cannot be empty.")

    clean_text = " ".join(text.strip().split())
    start_time = time.perf_counter()

    probabilities = model.predict_proba([clean_text])[0]

    predicted_category = model.classes_[
        probabilities.argmax()
    ]

    confidence = float(probabilities.max())

    explanation = explain_prediction(
        clean_text,
        predicted_category
    )

    processing_time_ms = (
        time.perf_counter() - start_time
    ) * 1000

    return {
        "input_text": clean_text,
        "detected_language": detect_language(clean_text),
        "category": predicted_category,
        "department": DEPARTMENT_MAP[predicted_category],
        "priority": assign_priority(
            clean_text,
            predicted_category
        ),
        "confidence": round(confidence, 4),
        "processing_time_ms": round(
            processing_time_ms,
            2
        ),
        "requires_human_review": (
            confidence < review_threshold
        ),
        "explanation": explanation
    }
