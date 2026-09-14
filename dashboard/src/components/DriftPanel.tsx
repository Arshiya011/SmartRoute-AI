import { useCallback, useEffect, useState } from "react"
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  Languages,
} from "lucide-react"

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
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
import { API_BASE_URL } from "@/lib/api"

interface DriftResult {
  status: string
  sample_size: number
  minimum_sample_size: number
  language_psi: number | null
  language_drift_level: string
  category_psi: number | null
  category_drift_level: string
  language_distribution: Record<string, number>
  category_distribution: Record<string, number>
  new_vocabulary: Array<{
    term: string
    count: number
  }>
  alerts: string[]
  generated_at: string
}

export function DriftPanel() {
  const [drift, setDrift] = useState<DriftResult | null>(null)
  const [error, setError] = useState("")

  const loadDrift = useCallback(async () => {
    try {
      const response = await fetch(
        `${API_BASE_URL}/drift`
      )

      if (!response.ok) {
        throw new Error("Unable to load drift metrics.")
      }

      setDrift(await response.json())
      setError("")
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Drift monitoring failed."
      )
    }
  }, [])

  useEffect(() => {
    void loadDrift()

    const timer = window.setInterval(() => {
      void loadDrift()
    }, 15000)

    return () => window.clearInterval(timer)
  }, [loadDrift])

  if (error) {
    return (
      <Alert variant="destructive">
        <AlertTriangle className="h-4 w-4" />
        <AlertTitle>Drift service unavailable</AlertTitle>
        <AlertDescription>{error}</AlertDescription>
      </Alert>
    )
  }

  if (!drift) {
    return (
      <Card>
        <CardContent className="py-16 text-center">
          Loading drift metrics...
        </CardContent>
      </Card>
    )
  }

  const enoughData =
    drift.sample_size >= drift.minimum_sample_size

  return (
    <div className="space-y-6">
      <Alert>
        {drift.status === "Drift Detected" ? (
          <AlertTriangle className="h-4 w-4" />
        ) : enoughData ? (
          <CheckCircle2 className="h-4 w-4" />
        ) : (
          <Activity className="h-4 w-4" />
        )}

        <AlertTitle>{drift.status}</AlertTitle>

        <AlertDescription>
          Production sample: {drift.sample_size} of{" "}
          {drift.minimum_sample_size} required complaints.
        </AlertDescription>
      </Alert>

      <div className="grid gap-4 md:grid-cols-2">
        <DriftMetricCard
          title="Language Drift"
          value={
            drift.language_psi === null
              ? "Pending"
              : `PSI ${drift.language_psi.toFixed(4)}`
          }
          level={drift.language_drift_level}
        />

        <DriftMetricCard
          title="Category Drift"
          value={
            drift.category_psi === null
              ? "Pending"
              : `PSI ${drift.category_psi.toFixed(4)}`
          }
          level={drift.category_drift_level}
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Language Distribution</CardTitle>
            <CardDescription>
              Live production-language shares
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-5">
            {Object.entries(
              drift.language_distribution
            ).map(([language, share]) => (
              <div key={language}>
                <div className="mb-2 flex justify-between text-sm">
                  <span>{language}</span>
                  <span>{(share * 100).toFixed(1)}%</span>
                </div>

                <Progress value={share * 100} />
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Monitoring Alerts</CardTitle>
            <CardDescription>
              PSI-based distribution findings
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-3">
            {drift.alerts.map((alert) => (
              <Alert key={alert}>
                <Languages className="h-4 w-4" />
                <AlertDescription>{alert}</AlertDescription>
              </Alert>
            ))}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>New Vocabulary</CardTitle>
          <CardDescription>
            Frequent production terms absent from the training vocabulary
          </CardDescription>
        </CardHeader>

        <CardContent>
          {drift.new_vocabulary.length ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>New term</TableHead>
                  <TableHead>Occurrences</TableHead>
                </TableRow>
              </TableHeader>

              <TableBody>
                {drift.new_vocabulary.map((item) => (
                  <TableRow key={item.term}>
                    <TableCell>{item.term}</TableCell>
                    <TableCell>{item.count}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <p className="py-10 text-center text-sm text-muted-foreground">
              No unseen vocabulary detected.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

function DriftMetricCard({
  title,
  value,
  level,
}: {
  title: string
  value: string
  level: string
}) {
  return (
    <Card>
      <CardHeader>
        <CardDescription>{title}</CardDescription>
        <CardTitle>{value}</CardTitle>
      </CardHeader>

      <CardContent>
        <Badge
          variant={
            level === "Significant"
              ? "destructive"
              : "secondary"
          }
        >
          {level}
        </Badge>
      </CardContent>
    </Card>
  )
}
