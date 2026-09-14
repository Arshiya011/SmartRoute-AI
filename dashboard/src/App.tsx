import { useCallback, useEffect, useState } from "react"
import { ReviewQueueTable } from "@/components/ReviewQueueTable"
import { DriftPanel } from "@/components/DriftPanel"
import {
  Activity,
  AlertTriangle,
  BellRing,
  BrainCircuit,
  CheckCircle2,
  ClipboardCheck,
  Gauge,
  LayoutDashboard,
  Menu,
  MessageSquareText,
  Radio,
  RefreshCw,
  Route,
  Send,
  ShieldAlert,
  X,
} from "lucide-react"
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip as ChartTooltip,
  XAxis,
  YAxis,
} from "recharts"

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Textarea } from "@/components/ui/textarea"
import { TooltipProvider } from "@/components/ui/tooltip"
import {
  analyseComplaint,
  fetchAlerts,
  fetchMetrics,
  fetchPredictions,
  fetchReviewQueue,
  type Metrics,
  type Prediction,
} from "@/lib/api"
import "@/components/watermelon/medesk-dashboard/dashboard.css"

type Page =
  | "overview"
  | "analyse"
  | "live"
  | "review"
  | "performance"
  | "drift"
  | "alerts"

const navigation = [
  { id: "overview", label: "Overview", icon: LayoutDashboard },
  { id: "analyse", label: "Analyse Complaint", icon: MessageSquareText },
  { id: "live", label: "Live Complaints", icon: Radio },
  { id: "review", label: "Human Review Queue", icon: ClipboardCheck },
  { id: "performance", label: "Model Performance", icon: BrainCircuit },
  { id: "drift", label: "Language & Data Drift", icon: Activity },
  { id: "alerts", label: "Alerts", icon: BellRing },
] satisfies Array<{ id: Page; label: string; icon: typeof LayoutDashboard }>

const emptyMetrics: Metrics = {
  total_complaints: 0,
  average_confidence: 0,
  average_latency_ms: 0,
  review_queue_size: 0,
  feedback_count: 0,
  category_distribution: {},
  language_distribution: {},
}

const chartColors = [
  "#10b981",
  "#3b82f6",
  "#f59e0b",
  "#8b5cf6",
  "#ef4444",
  "#06b6d4",
  "#ec4899",
  "#84cc16",
]

function percentage(value: number) {
  return `${(value * 100).toFixed(1)}%`
}

function priorityVariant(priority: string) {
  if (priority === "Critical") return "destructive"
  if (priority === "High") return "default"
  return "secondary"
}

function App() {
  const [page, setPage] = useState<Page>("overview")
  const [mobileMenu, setMobileMenu] = useState(false)
  const [metrics, setMetrics] = useState<Metrics>(emptyMetrics)
  const [predictions, setPredictions] = useState<Prediction[]>([])
  const [reviewQueue, setReviewQueue] = useState<Prediction[]>([])
  const [alerts, setAlerts] = useState<Prediction[]>([])
  const [complaint, setComplaint] = useState("")
  const [result, setResult] = useState<Prediction | null>(null)
  const [loading, setLoading] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState("")

  const loadData = useCallback(async () => {
    setRefreshing(true)

    try {
      const [metricsData, predictionData, reviewData, alertData] =
        await Promise.all([
          fetchMetrics(),
          fetchPredictions(100),
          fetchReviewQueue(100),
          fetchAlerts(50),
        ])

      setMetrics(metricsData)
      setPredictions(predictionData)
      setReviewQueue(reviewData)
      setAlerts(alertData)
      setError("")
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Unable to connect to SmartRoute API."
      )
    } finally {
      setRefreshing(false)
    }
  }, [])

  useEffect(() => {
    void loadData()

    const timer = window.setInterval(() => {
      void loadData()
    }, 15000)

    return () => window.clearInterval(timer)
  }, [loadData])

  async function handleAnalyse() {
    if (complaint.trim().length < 3) {
      setError("Enter a complaint containing at least three characters.")
      return
    }

    setLoading(true)
    setError("")

    try {
      const prediction = await analyseComplaint(complaint)
      setResult(prediction)
      await loadData()
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Complaint analysis failed."
      )
    } finally {
      setLoading(false)
    }
  }

  const categoryData = Object.entries(
    metrics.category_distribution
  ).map(([name, value]) => ({ name, value }))

  const languageData = Object.entries(
    metrics.language_distribution
  ).map(([name, value]) => ({ name, value }))

  const modelData = [
    { model: "TF-IDF", accuracy: 82.78, f1: 83.05 },
    { model: "DistilBERT", accuracy: 71.81, f1: 72.71 },
  ]

  function overviewPage() {
    const cards = [
      {
        title: "Total Complaints",
        value: metrics.total_complaints,
        icon: MessageSquareText,
        note: "Logged predictions",
      },
      {
        title: "Average Confidence",
        value: percentage(metrics.average_confidence),
        icon: Gauge,
        note: "Selected model confidence",
      },
      {
        title: "Average Latency",
        value: `${metrics.average_latency_ms.toFixed(2)} ms`,
        icon: Activity,
        note: "End-to-end classification",
      },
      {
        title: "Human Review",
        value: metrics.review_queue_size,
        icon: ClipboardCheck,
        note: "Low-confidence cases",
      },
    ]

    return (
      <>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {cards.map(({ title, value, icon: Icon, note }) => (
            <Card key={title}>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">{title}</CardTitle>
                <Icon className="h-4 w-4 text-emerald-500" />
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">{value}</div>
                <p className="mt-1 text-xs text-muted-foreground">{note}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Category Distribution</CardTitle>
              <CardDescription>Live routed complaints</CardDescription>
            </CardHeader>
            <CardContent className="h-80">
              {categoryData.length ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={categoryData} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                    <XAxis type="number" allowDecimals={false} />
                    <YAxis
                      dataKey="name"
                      type="category"
                      width={120}
                      tick={{ fontSize: 11 }}
                    />
                    <ChartTooltip />
                    <Bar dataKey="value" fill="#10b981" radius={4} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <EmptyState text="Submit complaints to populate this chart." />
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Language Distribution</CardTitle>
              <CardDescription>English, Hindi and Hinglish</CardDescription>
            </CardHeader>
            <CardContent className="h-80">
              {languageData.length ? (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={languageData}
                      dataKey="value"
                      nameKey="name"
                      innerRadius={55}
                      outerRadius={95}
                      label
                    >
                      {languageData.map((entry, index) => (
                        <Cell
                          key={entry.name}
                          fill={chartColors[index % chartColors.length]}
                        />
                      ))}
                    </Pie>
                    <ChartTooltip />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <EmptyState text="No language activity recorded yet." />
              )}
            </CardContent>
          </Card>
        </div>
      </>
    )
  }

  function analysePage() {
    return (
      <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <Card>
          <CardHeader>
            <CardTitle>Analyse a Customer Complaint</CardTitle>
            <CardDescription>
              Enter English, Hindi or Hinglish grievance text.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Textarea
              value={complaint}
              onChange={(event) => setComplaint(event.target.value)}
              placeholder="Example: Payment ho gaya but order confirm nahi hua"
              className="min-h-48 resize-none"
              maxLength={2000}
            />

            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">
                {complaint.length}/2000 characters
              </span>

              <Button onClick={handleAnalyse} disabled={loading}>
                <Send className="mr-2 h-4 w-4" />
                {loading ? "Analysing..." : "Analyse & Route"}
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Routing Result</CardTitle>
            <CardDescription>Live model prediction</CardDescription>
          </CardHeader>
          <CardContent>
            {result ? (
              <div className="space-y-5">
                <ResultRow label="Language" value={result.detected_language} />
                <ResultRow label="Category" value={result.category} />
                <ResultRow label="Department" value={result.department} />
                <ResultRow label="Priority" value={result.priority} />

                <div>
                  <div className="mb-2 flex justify-between text-sm">
                    <span>Confidence</span>
                    <strong>{percentage(result.confidence)}</strong>
                  </div>
                  <Progress value={result.confidence * 100} />
                </div>
                  {result.explanation && result.explanation.length > 0 && (
                <div>
                <p className="mb-2 text-sm text-muted-foreground">
                Influential terms
                </p>

                <div className="flex flex-wrap gap-2">
                {result.explanation.map((item) => (
                <Badge key={item.term} variant="secondary">
                {item.term}
            </Badge>
      ))}
    </div>
  </div>
)}
                <Alert>
                  {result.requires_human_review ? (
                    <AlertTriangle className="h-4 w-4" />
                  ) : (
                    <CheckCircle2 className="h-4 w-4" />
                  )}
                  <AlertTitle>
                    {result.requires_human_review
                      ? "Human review required"
                      : "Automatically routed"}
                  </AlertTitle>
                  <AlertDescription>
                    Processed in {result.processing_time_ms.toFixed(2)} ms
                  </AlertDescription>
                </Alert>
              </div>
            ) : (
              <EmptyState text="The prediction will appear here." />
            )}
          </CardContent>
        </Card>
      </div>
    )
  }

  function livePage() {
    return (
      <DataTable
        title="Live Complaints"
        description="Latest grievances processed by SmartRoute"
        records={predictions}
      />
    )
  }

    function reviewPage() {
  return (
    <ReviewQueueTable
      records={reviewQueue}
      onFeedbackSaved={loadData}
    />
  )
}

  function performancePage() {
    return (
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Model Comparison</CardTitle>
            <CardDescription>Untouched group-aware test set</CardDescription>
          </CardHeader>
          <CardContent className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={modelData}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                <XAxis dataKey="model" />
                <YAxis domain={[0, 100]} />
                <ChartTooltip />
                <Bar dataKey="accuracy" fill="#10b981" radius={4} />
                <Bar dataKey="f1" fill="#3b82f6" radius={4} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <div className="grid gap-4">
          <MetricCard
            title="Selected Production Model"
            value="TF-IDF + Logistic Regression"
            note="Higher accuracy, higher F1 and lower latency"
          />
          <MetricCard
            title="Baseline Test Performance"
            value="82.78% accuracy · 83.05% F1"
            note="Average latency: 0.4291 ms during batch evaluation"
          />
          <MetricCard
            title="Transformer Test Performance"
            value="71.81% accuracy · 72.71% F1"
            note="Multilingual DistilBERT best checkpoint: Epoch 3"
          />
        </div>
      </div>
    )
  }
      function driftPage() {
  return <DriftPanel />
}
    

  function alertsPage() {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Operational Alerts</CardTitle>
          <CardDescription>
            Critical complaints and low-confidence predictions
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {alerts.length ? (
            alerts.map((item) => (
              <Alert key={item.id ?? item.prediction_id}>
                <ShieldAlert className="h-4 w-4" />
                <AlertTitle>
                  {item.priority} · {item.category}
                </AlertTitle>
                <AlertDescription>
                  {item.input_text} — confidence {percentage(item.confidence)}
                </AlertDescription>
              </Alert>
            ))
          ) : (
            <EmptyState text="No active alerts." />
          )}
        </CardContent>
      </Card>
    )
  }

  const pages: Record<Page, () => React.ReactNode> = {
    overview: overviewPage,
    analyse: analysePage,
    live: livePage,
    review: reviewPage,
    performance: performancePage,
    drift: driftPage,
    alerts: alertsPage,
  }

  const currentLabel =
    navigation.find((item) => item.id === page)?.label || "Overview"

  return (
    <TooltipProvider>
      <div className="dark min-h-screen bg-background text-foreground">
        <div className="flex min-h-screen">
          <aside
            className={`fixed inset-y-0 left-0 z-40 w-72 border-r bg-card p-5 transition-transform lg:static lg:translate-x-0 ${
              mobileMenu ? "translate-x-0" : "-translate-x-full"
            }`}
          >
            <div className="mb-8 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="rounded-xl bg-emerald-500 p-2 text-black">
                  <Route className="h-6 w-6" />
                </div>
                <div>
                  <h1 className="font-bold">SmartRoute AI</h1>
                  <p className="text-xs text-muted-foreground">
                    Grievance Intelligence
                  </p>
                </div>
              </div>

              <Button
                variant="ghost"
                size="icon"
                className="lg:hidden"
                onClick={() => setMobileMenu(false)}
              >
                <X className="h-5 w-5" />
              </Button>
            </div>

            <nav className="space-y-2">
              {navigation.map(({ id, label, icon: Icon }) => (
                <button
                  key={id}
                  onClick={() => {
                    setPage(id)
                    setMobileMenu(false)
                  }}
                  className={`flex w-full items-center gap-3 rounded-xl px-4 py-3 text-left text-sm transition ${
                    page === id
                      ? "bg-emerald-500 font-medium text-black"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground"
                  }`}
                >
                  <Icon className="h-4 w-4" />
                  {label}
                </button>
              ))}
            </nav>

            <div className="absolute bottom-5 left-5 right-5 rounded-xl border p-4">
              <div className="flex items-center gap-2 text-sm">
                <span className="h-2 w-2 rounded-full bg-emerald-500" />
                FastAPI connected
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                TF-IDF production model
              </p>
            </div>
          </aside>

          <main className="min-w-0 flex-1">
            <header className="sticky top-0 z-30 flex h-20 items-center justify-between border-b bg-background/90 px-5 backdrop-blur lg:px-8">
              <div className="flex items-center gap-3">
                <Button
                  variant="outline"
                  size="icon"
                  className="lg:hidden"
                  onClick={() => setMobileMenu(true)}
                >
                  <Menu className="h-5 w-5" />
                </Button>

                <div>
                  <h2 className="text-xl font-semibold">{currentLabel}</h2>
                  <p className="text-xs text-muted-foreground">
                    Live multilingual e-commerce routing
                  </p>
                </div>
              </div>

              <Button
                variant="outline"
                onClick={() => void loadData()}
                disabled={refreshing}
              >
                <RefreshCw
                  className={`mr-2 h-4 w-4 ${
                    refreshing ? "animate-spin" : ""
                  }`}
                />
                Refresh
              </Button>
            </header>

            <div className="space-y-6 p-5 lg:p-8">
              {error && (
                <Alert variant="destructive">
                  <AlertTriangle className="h-4 w-4" />
                  <AlertTitle>Connection error</AlertTitle>
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}

              {pages[page]()}
            </div>
          </main>
        </div>
      </div>
    </TooltipProvider>
  )
}

function EmptyState({ text }: { text: string }) {
  return (
    <div className="flex h-full min-h-40 items-center justify-center text-center text-sm text-muted-foreground">
      {text}
    </div>
  )
}

function ResultRow({
  label,
  value,
}: {
  label: string
  value: string
}) {
  return (
    <div className="flex items-center justify-between border-b pb-3">
      <span className="text-sm text-muted-foreground">{label}</span>
      <strong className="text-sm">{value}</strong>
    </div>
  )
}

function MetricCard({
  title,
  value,
  note,
}: {
  title: string
  value: string
  note: string
}) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardDescription>{title}</CardDescription>
        <CardTitle className="text-lg">{value}</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-xs text-muted-foreground">{note}</p>
      </CardContent>
    </Card>
  )
}

function DataTable({
  title,
  description,
  records,
}: {
  title: string
  description: string
  records: Prediction[]
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>
        {records.length ? (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Complaint</TableHead>
                  <TableHead>Language</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Priority</TableHead>
                  <TableHead>Confidence</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {records.map((item) => (
                  <TableRow key={item.id ?? item.prediction_id}>
                    <TableCell className="max-w-md truncate">
                      {item.input_text}
                    </TableCell>
                    <TableCell>{item.detected_language}</TableCell>
                    <TableCell>{item.category}</TableCell>
                    <TableCell>
                      <Badge variant={priorityVariant(item.priority)}>
                        {item.priority}
                      </Badge>
                    </TableCell>
                    <TableCell>{percentage(item.confidence)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        ) : (
          <EmptyState text="No matching complaints found." />
        )}
      </CardContent>
    </Card>
  )
}

export default App