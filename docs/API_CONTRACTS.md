# WebJourney — Backend API Contracts & Boundary Specifications (WJ-105)

This document defines the schema and API contract specifications between the WebJourney Chrome Extension and the persistence backend (Fastify/Node or Laravel).

---

## 1. Authentication & Trust Boundaries
- All mutating endpoints require an authenticated author session (Bearer token or session cookie).
- Sharing and run progress endpoints operate via unguessable, expiring token hashes.
- **Privacy Rule**: The backend never receives, stores, or logs raw DOM innerHTML, sensitive input values, session cookies, or user browsing history.

---

## 2. API Endpoints

### 2.1 Create Journey Draft
- **Endpoint**: `POST /v1/journeys`
- **Auth**: Authenticated Author
- **Request Body**:
```json
{
  "name": "Acme Onboarding Tour",
  "description": "Guided walkthrough for new team members.",
  "startUrl": "https://app.example.com/dashboard",
  "allowedOrigins": ["https://app.example.com"]
}
```
- **Response**: `201 Created` with initialized Journey object (`schemaVersion: 1`).

---

### 2.2 Publish Immutable Journey Version
- **Endpoint**: `POST /v1/journeys/:id/publish`
- **Auth**: Owner / Editor
- **Request Body**:
```json
{
  "journeyId": "11111111-1111-4111-8111-111111111111",
  "snapshot": { /* Full validated Journey object */ }
}
```
- **Response**: `200 OK`
```json
{
  "versionId": "22222222-2222-4222-8222-222222222222",
  "versionNumber": 1,
  "publishedAt": "2026-09-19T18:00:00.000Z"
}
```

---

### 2.3 Create Expiring Invitation
- **Endpoint**: `POST /v1/versions/:id/invites`
- **Auth**: Authorized Publisher
- **Request Body**:
```json
{
  "versionId": "22222222-2222-4222-8222-222222222222",
  "expiresInDays": 30,
  "maxRedemptions": 100
}
```
- **Response**: `201 Created`
```json
{
  "inviteCode": "WJ-8F4A2C",
  "inviteUrl": "https://webjourney.app/join/WJ-8F4A2C",
  "expiresAt": "2026-10-19T18:00:00.000Z"
}
```

---

### 2.4 Redeem Invitation
- **Endpoint**: `POST /v1/invites/redeem`
- **Auth**: Public (Rate-limited)
- **Request Body**:
```json
{
  "inviteCode": "WJ-8F4A2C"
}
```
- **Response**: `200 OK`
```json
{
  "version": { /* Immutable Version Snapshot */ },
  "startUrl": "https://app.example.com/dashboard",
  "allowedOrigins": ["https://app.example.com"]
}
```

---

### 2.5 Report Step Issue
- **Endpoint**: `POST /v1/step-issues`
- **Auth**: Active Learner / Author
- **Request Body**:
```json
{
  "versionId": "22222222-2222-4222-8222-222222222222",
  "stepId": "33333333-3333-4333-8333-333333333333",
  "failureCode": "target_not_found",
  "targetUrl": "https://app.example.com/dashboard",
  "diagnosticSelector": "#btn-modal-confirm"
}
```
- **Response**: `200 OK`
