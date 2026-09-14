from datetime import datetime, timezone
from pathlib import Path
import sqlite3


PROJECT_ROOT = Path(__file__).resolve().parent.parent
DATABASE_PATH = PROJECT_ROOT / "data/smartroute.db"


def get_connection():
    DATABASE_PATH.parent.mkdir(parents=True, exist_ok=True)

    connection = sqlite3.connect(DATABASE_PATH)
    connection.row_factory = sqlite3.Row

    return connection


def initialize_database():
    with get_connection() as connection:
        connection.execute("""
            CREATE TABLE IF NOT EXISTS predictions (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                input_text TEXT NOT NULL,
                detected_language TEXT NOT NULL,
                category TEXT NOT NULL,
                department TEXT NOT NULL,
                priority TEXT NOT NULL,
                confidence REAL NOT NULL,
                processing_time_ms REAL NOT NULL,
                requires_human_review INTEGER NOT NULL,
                created_at TEXT NOT NULL
            )
        """)

        connection.execute("""
            CREATE TABLE IF NOT EXISTS feedback (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                prediction_id INTEGER NOT NULL,
                corrected_category TEXT NOT NULL,
                notes TEXT,
                created_at TEXT NOT NULL,
                FOREIGN KEY (prediction_id)
                    REFERENCES predictions(id)
            )
        """)


def save_prediction(result):
    created_at = datetime.now(timezone.utc).isoformat()

    with get_connection() as connection:
        cursor = connection.execute("""
            INSERT INTO predictions (
                input_text,
                detected_language,
                category,
                department,
                priority,
                confidence,
                processing_time_ms,
                requires_human_review,
                created_at
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (
            result["input_text"],
            result["detected_language"],
            result["category"],
            result["department"],
            result["priority"],
            result["confidence"],
            result["processing_time_ms"],
            int(result["requires_human_review"]),
            created_at
        ))

        prediction_id = cursor.lastrowid

    return prediction_id, created_at


def get_predictions(limit=100):
    with get_connection() as connection:
        rows = connection.execute("""
            SELECT *
            FROM predictions
            ORDER BY id DESC
            LIMIT ?
        """, (limit,)).fetchall()

    results = []

    for row in rows:
        item = dict(row)
        item["requires_human_review"] = bool(
            item["requires_human_review"]
        )
        results.append(item)

    return results


def save_feedback(prediction_id, corrected_category, notes=None):
    created_at = datetime.now(timezone.utc).isoformat()

    with get_connection() as connection:
        prediction = connection.execute(
            "SELECT id FROM predictions WHERE id = ?",
            (prediction_id,)
        ).fetchone()

        if prediction is None:
            return None

        cursor = connection.execute("""
            INSERT INTO feedback (
                prediction_id,
                corrected_category,
                notes,
                created_at
            )
            VALUES (?, ?, ?, ?)
        """, (
            prediction_id,
            corrected_category,
            notes,
            created_at
        ))

        feedback_id = cursor.lastrowid

    return feedback_id, created_at


def get_metrics():
    with get_connection() as connection:
        prediction_metrics = connection.execute("""
            SELECT
                COUNT(*) AS total_complaints,
                AVG(confidence) AS average_confidence,
                AVG(processing_time_ms) AS average_latency_ms,
                SUM(requires_human_review) AS review_queue_size
            FROM predictions
        """).fetchone()

        feedback_count = connection.execute("""
            SELECT COUNT(*) AS feedback_count
            FROM feedback
        """).fetchone()

        category_rows = connection.execute("""
            SELECT category, COUNT(*) AS count
            FROM predictions
            GROUP BY category
            ORDER BY count DESC
        """).fetchall()

        language_rows = connection.execute("""
            SELECT detected_language, COUNT(*) AS count
            FROM predictions
            GROUP BY detected_language
            ORDER BY count DESC
        """).fetchall()

    metrics = dict(prediction_metrics)

    metrics["average_confidence"] = round(
        metrics["average_confidence"] or 0,
        4
    )

    metrics["average_latency_ms"] = round(
        metrics["average_latency_ms"] or 0,
        2
    )

    metrics["review_queue_size"] = (
        metrics["review_queue_size"] or 0
    )

    metrics["feedback_count"] = (
        feedback_count["feedback_count"]
    )

    metrics["category_distribution"] = {
        row["category"]: row["count"]
        for row in category_rows
    }

    metrics["language_distribution"] = {
        row["detected_language"]: row["count"]
        for row in language_rows
    }

    return metrics


def get_alerts(limit=50):
    with get_connection() as connection:
        rows = connection.execute("""
            SELECT *
            FROM predictions
            WHERE requires_human_review = 1
               OR priority = 'Critical'
            ORDER BY id DESC
            LIMIT ?
        """, (limit,)).fetchall()

    alerts = []

    for row in rows:
        item = dict(row)
        item["requires_human_review"] = bool(
            item["requires_human_review"]
        )
        alerts.append(item)

    return alerts


def get_unresolved_review_queue(limit=100):
    with get_connection() as connection:
        rows = connection.execute("""
            SELECT p.*
            FROM predictions AS p
            LEFT JOIN feedback AS f
                ON f.prediction_id = p.id
            WHERE p.requires_human_review = 1
              AND f.id IS NULL
            ORDER BY p.id DESC
            LIMIT ?
        """, (limit,)).fetchall()

    results = []

    for row in rows:
        item = dict(row)
        item["requires_human_review"] = bool(
            item["requires_human_review"]
        )
        results.append(item)

    return results
