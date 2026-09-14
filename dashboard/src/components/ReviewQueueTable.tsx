import { useState } from "react"
import { ClipboardCheck } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Textarea } from "@/components/ui/textarea"
import {
  submitFeedback,
  type Prediction,
} from "@/lib/api"

const categories = [
  "Payment Issue",
  "Delivery Issue",
  "Refund Issue",
  "Cancellation Issue",
  "Product Issue",
  "Return/Replacement",
  "Account Issue",
  "Fraud/Security",
]

interface ReviewQueueTableProps {
  records: Prediction[]
  onFeedbackSaved: () => Promise<void>
}

export function ReviewQueueTable({
  records,
  onFeedbackSaved,
}: ReviewQueueTableProps) {
  const [selected, setSelected] = useState<Prediction | null>(null)
  const [correctedCategory, setCorrectedCategory] = useState("")
  const [notes, setNotes] = useState("")
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState("")

  function openReview(record: Prediction) {
    setSelected(record)
    setCorrectedCategory(record.category)
    setNotes("")
    setMessage("")
  }

  async function saveCorrection() {
    if (!selected || !correctedCategory) return

    const predictionId = selected.id ?? selected.prediction_id

    if (!predictionId) {
      setMessage("Prediction ID is unavailable.")
      return
    }

    setSaving(true)

    try {
      await submitFeedback(
        predictionId,
        correctedCategory,
        notes
      )

      setSelected(null)
      setMessage("Feedback saved successfully.")
      await onFeedbackSaved()
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Unable to save feedback."
      )
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>Human Review Queue</CardTitle>
          <CardDescription>
            Correct low-confidence predictions and store feedback
            for future retraining.
          </CardDescription>
        </CardHeader>

        <CardContent>
          {message && (
            <p className="mb-4 text-sm text-emerald-500">
              {message}
            </p>
          )}

          {records.length ? (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Complaint</TableHead>
                    <TableHead>Predicted category</TableHead>
                    <TableHead>Confidence</TableHead>
                    <TableHead>Action</TableHead>
                  </TableRow>
                </TableHeader>

                <TableBody>
                  {records.map((record) => (
                    <TableRow
                      key={record.id ?? record.prediction_id}
                    >
                      <TableCell className="max-w-md">
                        {record.input_text}
                      </TableCell>

                      <TableCell>
                        <Badge variant="secondary">
                          {record.category}
                        </Badge>
                      </TableCell>

                      <TableCell>
                        {(record.confidence * 100).toFixed(1)}%
                      </TableCell>

                      <TableCell>
                        <Button
                          size="sm"
                          onClick={() => openReview(record)}
                        >
                          <ClipboardCheck className="mr-2 h-4 w-4" />
                          Review
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : (
            <div className="py-16 text-center text-sm text-muted-foreground">
              No unresolved complaints require human review.
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog
        open={selected !== null}
        onOpenChange={(open) => {
          if (!open) setSelected(null)
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Correct Model Prediction</DialogTitle>
            <DialogDescription>
              Review the complaint and select the correct category.
            </DialogDescription>
          </DialogHeader>

          {selected && (
            <div className="space-y-4">
              <div className="rounded-lg border p-3 text-sm">
                {selected.input_text}
              </div>

              <div>
                <p className="mb-2 text-sm font-medium">
                  Correct category
                </p>

                <Select
                  value={correctedCategory}
                  onValueChange={(value) => {
                    if (value) setCorrectedCategory(value)
                  }}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select category" />
                  </SelectTrigger>

                  <SelectContent>
                    {categories.map((category) => (
                      <SelectItem
                        key={category}
                        value={category}
                      >
                        {category}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <Textarea
                value={notes}
                onChange={(event) => setNotes(event.target.value)}
                placeholder="Optional reviewer notes"
                maxLength={1000}
              />
            </div>
          )}

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setSelected(null)}
            >
              Cancel
            </Button>

            <Button
              onClick={saveCorrection}
              disabled={saving || !correctedCategory}
            >
              {saving ? "Saving..." : "Submit Feedback"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
