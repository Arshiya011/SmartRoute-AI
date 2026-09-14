# SmartRoute AI

## Live Multilingual E-Commerce Grievance Routing and Model Monitoring System

SmartRoute AI is an AI-powered multilingual e-commerce grievance routing system designed to automatically understand customer complaints, classify them, assign the appropriate department and priority, and monitor changes in incoming production data.

The system supports:

- English
- Hindi
- Hinglish

It classifies complaints into 8 categories and automatically maps them to the responsible department.

The project also includes confidence-based human review, prediction storage, feedback collection, and production data drift monitoring.

---

## 🎯 Ultimate Goal

The ultimate goal of SmartRoute AI is to reduce the manual effort involved in handling large volumes of e-commerce customer complaints.

Instead of manually reading and forwarding every complaint, the system aims to:

1. Understand the customer's complaint.
2. Detect the language.
3. Identify the complaint category.
4. Route it to the correct department.
5. Assign an appropriate priority.
6. Provide a confidence score.
7. Send uncertain predictions for human review.
8. Store predictions and feedback.
9. Monitor production data for distribution drift.
10. Alert the organization when incoming customer behavior changes significantly.

The long-term vision is a continuously monitored AI routing system that can operate as part of an e-commerce customer-support platform.

---

# 🚀 Features

### Multilingual Complaint Classification

Supports:

- English
- Hindi
- Hinglish

### 8 Complaint Categories

| Category | Department |
|---|---|
| Payment Issue | Payments Team |
| Delivery Issue | Logistics Team |
| Refund Issue | Refund Team |
| Cancellation Issue | Order Management |
| Product Issue | Product Support |
| Return/Replacement | Returns Team |
| Account Issue | Account Support |
| Fraud/Security | Security Team |

### Priority Assignment

Complaints are assigned a priority based on the classification system:

- High
- Medium
- Low

### Confidence-Based Human Review

The system uses a confidence threshold of **0.60**.

```text
Confidence >= 0.60
        ↓
Automatic Routing

Confidence < 0.60
        ↓
Human Review Queue

