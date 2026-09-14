from contextlib import asynccontextmanager

from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from backend.drift_service import calculate_drift

from backend.database import (
    get_alerts,
    get_metrics,
    get_predictions,
    get_unresolved_review_queue,
    initialize_database,
    save_feedback,
    save_prediction
)

from backend.prediction_service import (
    DEPARTMENT_MAP,
    predict_complaint
)


@asynccontextmanager
async def lifespan(app: FastAPI):
    initialize_database()
    yield


app = FastAPI(
    title="SmartRoute AI API",
    description=(
        "Live multilingual e-commerce grievance "
        "classification and routing API"
    ),
    version="1.0.0",
    lifespan=lifespan
)


app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "http://localhost:5173",
        "http://127.0.0.1:5173"
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"]
)


class PredictionRequest(BaseModel):
    text: str = Field(
        min_length=3,
        max_length=2000,
        examples=[
            "Payment ho gaya but order place nahi hua"
        ]
    )


class FeedbackRequest(BaseModel):
    prediction_id: int = Field(gt=0)
    corrected_category: str
    notes: str | None = Field(
        default=None,
        max_length=1000
    )


@app.get("/")
def root():
    return {
        "name": "SmartRoute AI",
        "status": "running",
        "version": "1.0.0",
        "documentation": "/docs"
    }


@app.get("/health")
def health():
    return {
        "status": "healthy",
        "model": "TF-IDF + Logistic Regression",
        "supported_languages": [
            "English",
            "Hindi",
            "Hinglish"
        ],
        "categories": list(DEPARTMENT_MAP.keys())
    }


@app.post("/predict")
def predict(request: PredictionRequest):
    try:
        result = predict_complaint(request.text)

        prediction_id, created_at = save_prediction(
            result
        )

        return {
            "prediction_id": prediction_id,
            **result,
            "created_at": created_at
        }

    except ValueError as error:
        raise HTTPException(
            status_code=400,
            detail=str(error)
        ) from error

    except Exception as error:
        raise HTTPException(
            status_code=500,
            detail="Prediction failed."
        ) from error


@app.get("/predictions")
def predictions(
    limit: int = Query(
        default=100,
        ge=1,
        le=500
    )
):
    return {
        "count": limit,
        "predictions": get_predictions(limit)
    }


@app.get("/metrics")
def metrics():
    return get_metrics()


@app.post("/feedback")
def feedback(request: FeedbackRequest):
    if request.corrected_category not in DEPARTMENT_MAP:
        raise HTTPException(
            status_code=400,
            detail="Invalid corrected category."
        )

    saved_feedback = save_feedback(
        prediction_id=request.prediction_id,
        corrected_category=request.corrected_category,
        notes=request.notes
    )

    if saved_feedback is None:
        raise HTTPException(
            status_code=404,
            detail="Prediction ID not found."
        )

    feedback_id, created_at = saved_feedback

    return {
        "message": "Feedback saved successfully.",
        "feedback_id": feedback_id,
        "prediction_id": request.prediction_id,
        "corrected_category": (
            request.corrected_category
        ),
        "created_at": created_at
    }


@app.get("/alerts")
def alerts(
    limit: int = Query(
        default=50,
        ge=1,
        le=500
    )
):
    alert_records = get_alerts(limit)

    return {
        "count": len(alert_records),
        "alerts": alert_records
    }


@app.get("/review-queue")
def review_queue(
    limit: int = Query(
        default=100,
        ge=1,
        le=500
    )
):
    review_records = get_unresolved_review_queue(limit)

    return {
        "count": len(review_records),
        "predictions": review_records
    }


@app.get("/drift")
def drift():
    return calculate_drift()