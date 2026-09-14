export const API_BASE_URL = "http://127.0.0.1:8000"

export interface Prediction {
  id?: number
  prediction_id?: number
  input_text: string
  detected_language: string
  category: string
  department: string
  priority: string
  confidence: number
  processing_time_ms: number
  requires_human_review: boolean
  explanation?: Array<{
  term: string
  contribution: number
}>  
  created_at: string
}

export interface Metrics {
  total_complaints: number
  average_confidence: number
  average_latency_ms: number
  review_queue_size: number
  feedback_count: number
  category_distribution: Record<string, number>
  language_distribution: Record<string, number>
}

async function request<T>(
  endpoint: string,
  options?: RequestInit
): Promise<T> {
  const response = await fetch(
    `${API_BASE_URL}${endpoint}`,
    {
      ...options,
      headers: {
        "Content-Type": "application/json",
        ...options?.headers,
      },
    }
  )

  if (!response.ok) {
    const errorData = await response.json().catch(() => null)

    throw new Error(
      errorData?.detail ||
      `API request failed with status ${response.status}`
    )
  }

  return response.json()
}

export function analyseComplaint(
  text: string
): Promise<Prediction> {
  return request<Prediction>("/predict", {
    method: "POST",
    body: JSON.stringify({ text }),
  })
}

export async function fetchPredictions(
  limit = 100
): Promise<Prediction[]> {
  const data = await request<{
    predictions: Prediction[]
  }>(`/predictions?limit=${limit}`)

  return data.predictions
}

export function fetchMetrics(): Promise<Metrics> {
  return request<Metrics>("/metrics")
}

export async function fetchReviewQueue(
  limit = 100
): Promise<Prediction[]> {
  const data = await request<{
    predictions: Prediction[]
  }>(`/review-queue?limit=${limit}`)

  return data.predictions
}

export async function fetchAlerts(
  limit = 50
): Promise<Prediction[]> {
  const data = await request<{
    alerts: Prediction[]
  }>(`/alerts?limit=${limit}`)

  return data.alerts
}

export function submitFeedback(
  predictionId: number,
  correctedCategory: string,
  notes?: string
) {
  return request("/feedback", {
    method: "POST",
    body: JSON.stringify({
      prediction_id: predictionId,
      corrected_category: correctedCategory,
      notes: notes || null,
    }),
  })
}
