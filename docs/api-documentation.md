# CardIO REST API Specification

**System:** CardIO — Intelligent Credit Card Optimization Platform  
**Base URL:** `http://localhost:5000` (or `process.env.PORT`)  
**Security Headers:** `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `Strict-Transport-Security`  
**Payload Limit:** 1 Megabyte (`1mb`) JSON  
**Authentication:** HTTP Bearer Token (`Authorization: Bearer <supabase_jwt>`)  
**Status:** Approved for Release  
**Version:** 2.0.0  

---

## 1. Authentication & Common Conventions

### 1.1 Authorization Header
All private routes require an `Authorization` header containing the verified session token issued by Supabase Auth:
```http
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```
Requests lacking this header or carrying expired/invalid tokens receive:
```json
{
  "error": "Unauthorized — invalid or expired session token"
}
```
HTTP Status: `401 Unauthorized`

### 1.2 IDOR & Parameter Tampering Defenses
Client payloads containing foreign key references (such as `user_card_id` or `transaction_id`) are defensively verified on the server before database mutation. If a user references a card or transaction owned by a different user, the server rejects the request with:
```json
{
  "error": "Card not found or does not belong to the authenticated user"
}
```
HTTP Status: `403 Forbidden`

### 1.3 Common Error Response Codes
- `400 Bad Request`: Validation failure (missing required fields, negative amount, out-of-range calendar day).
- `401 Unauthorized`: Missing or invalid Bearer token.
- `403 Forbidden`: Resource ownership check failure (IDOR defense).
- `404 Not Found`: Target entity not found or not owned by user.
- `409 Conflict`: Unique constraint violation (duplicate card addition, duplicate brand registration).
- `413 Payload Too Large`: Request body exceeds 1MB limit.
- `500 Internal Server Error`: Sanitized server error.

---

## 2. Public Endpoints

### 2.1 Health Check
- **Route:** `GET /api/health`
- **Auth Required:** No
- **Description:** Verifies that the Express API is live.
- **Response (200 OK):**
```json
{
  "status": "ok",
  "message": "CardIO API is running"
}
```

### 2.2 Credit Card Catalogue
- **Route:** `GET /api/catalogue/cards`
- **Auth Required:** No
- **Description:** Fetches credit cards from the database if populated, or returns an empty array fallback.
- **Response (200 OK):**
```json
[
  {
    "id": "hdfc-infinia",
    "name": "HDFC Infinia Metal Edition",
    "bank": "HDFC",
    "network": "VISA",
    "annual_fee": 12500
  }
]
```

### 2.3 Airline Loyalty Catalogue
- **Route:** `GET /api/catalogue/airlines`
- **Auth Required:** No
- **Description:** Fetches airline programs from the database if populated.
- **Response (200 OK):**
```json
[]
```

---

## 3. Dashboard Analytics Endpoints

### 3.1 Get Aggregated Dashboard Analytics
- **Route:** `GET /api/dashboard`
- **Auth Required:** Yes
- **Description:** Concurrently fetches user cards, transactions, offer redemptions, and travel goals. Computes MoM spend growth, confirmed savings, pending cashback, and points totals.
- **Response (200 OK):**
```json
{
  "cardsCount": 2,
  "currentMonthSpend": 15000,
  "prevMonthSpend": 10000,
  "spendChangeMoM": 50.0,
  "currentYearSpend": 15000,
  "totalAllTimeSpend": 25000,
  "totalTransactionsCount": 2,
  "confirmedSavings": 1500,
  "confirmedDiscount": 1500,
  "confirmedCashback": 0,
  "pendingCashback": 0,
  "confirmedPoints": 450,
  "redeemedOffersCount": 1,
  "savedOffersCount": 0,
  "appliedOffersCount": 0,
  "activeGoalsCount": 1,
  "travelGoal": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "departure": "DEL",
    "destination": "SIN",
    "cabin": "ECONOMY",
    "target_points": 20000
  },
  "travelGoals": [ ... ],
  "recentTransactions": [ ... ],
  "totalCards": 2,
  "monthlySpends": 15000,
  "totalRewards": 450,
  "totalCashback": 0,
  "totalMiles": 450
}
```

---

## 4. User Credit Cards Endpoints

### 4.1 List User Cards
- **Route:** `GET /api/cards`
- **Auth Required:** Yes
- **Response (200 OK):**
```json
[
  {
    "id": "c1f7b8a1-529a-4c20-a8d2-43bbd51e737c",
    "user_id": "993a776c-3729-4592-b062-8566b7bb7357",
    "card_id": "hdfc-infinia",
    "custom_bank": "HDFC",
    "custom_card_name": "Infinia Metal",
    "custom_network": "VISA",
    "last_four_digits": "4321",
    "credit_limit": 1000000,
    "billing_cycle_day": 15,
    "payment_due_day": 5,
    "is_active": true,
    "created_at": "2026-10-31T09:00:00.000Z"
  }
]
```

### 4.2 Add Credit Card to Wallet
- **Route:** `POST /api/cards`
- **Auth Required:** Yes
- **Request Body:**
```json
{
  "card_id": "hdfc-infinia",
  "custom_bank": "HDFC",
  "custom_card_name": "Infinia Metal",
  "custom_network": "VISA",
  "last_four_digits": "4321",
  "credit_limit": 1000000,
  "billing_cycle_day": 15,
  "payment_due_day": 5
}
```
- **Validation Rules:**
  - Either `card_id` or `custom_card_name` is required.
  - `credit_limit` must be a non-negative number up to `1,000,000,000`.
  - `billing_cycle_day` and `payment_due_day` must be integers between 1 and 31.
- **Response (201 Created):**
```json
{
  "id": "c1f7b8a1-529a-4c20-a8d2-43bbd51e737c",
  "user_id": "993a776c-3729-4592-b062-8566b7bb7357",
  "card_id": "hdfc-infinia",
  "credit_limit": 1000000,
  "created_at": "2026-10-31T09:00:00.000Z"
}
```
- **Error (409 Conflict):** Returned if this catalogue card is already added to the user's wallet.

### 4.3 Delete Credit Card
- **Route:** `DELETE /api/cards/:id`
- **Auth Required:** Yes
- **Behavior:** Safely unlinks associated transactions, brand registrations, and redemptions by setting `user_card_id: null` before deleting the card record.
- **Response (200 OK):**
```json
{
  "success": true,
  "count": 1
}
```
- **Error (404 Not Found):** Returned if the card does not exist or does not belong to the user.

---

## 5. Transactions Endpoints

### 5.1 List Transactions
- **Route:** `GET /api/transactions`
- **Auth Required:** Yes
- **Response (200 OK):**
```json
[
  {
    "id": "e441c090-3331-419b-a3f5-79a8e0cb703e",
    "user_id": "993a776c-3729-4592-b062-8566b7bb7357",
    "user_card_id": "c1f7b8a1-529a-4c20-a8d2-43bbd51e737c",
    "merchant": "Amazon",
    "amount": 15000,
    "date": "2026-10-31",
    "category_id": "Shopping",
    "reward_earned": 450,
    "cashback_earned": 0,
    "created_at": "2026-10-31T09:30:00.000Z",
    "user_cards": { ... }
  }
]
```

### 5.2 Add Transaction
- **Route:** `POST /api/transactions`
- **Auth Required:** Yes
- **Request Body:**
```json
{
  "user_card_id": "c1f7b8a1-529a-4c20-a8d2-43bbd51e737c",
  "merchant": "Amazon",
  "amount": 15000,
  "date": "2026-10-31",
  "category_id": "Shopping",
  "reward_earned": 450,
  "cashback_earned": 0
}
```
- **Validation Rules:**
  - `merchant` must be a non-empty string.
  - `amount` must be a positive number up to `₹100,000,000`.
  - If `user_card_id` is supplied, it must belong to the authenticated user (IDOR verification).
- **Response (201 Created):** Returns created transaction record.

### 5.3 Update Transaction
- **Route:** `PATCH /api/transactions/:id`
- **Auth Required:** Yes
- **Request Body:** Optional fields (`merchant`, `amount`, `date`, `category_id`, `reward_earned`, `cashback_earned`, `user_card_id`).
- **Response (200 OK):** Returns updated transaction record.

### 5.4 Delete Transaction
- **Route:** `DELETE /api/transactions/:id`
- **Auth Required:** Yes
- **Behavior:** Unlinks any associated offer redemptions, setting `transaction_id: null` and `status: NOT_REDEEMED`.
- **Response (200 OK):**
```json
{
  "success": true,
  "count": 1
}
```

---

## 6. Brand Registration Tracker Endpoints

### 6.1 List Brand Registrations
- **Route:** `GET /api/brand-registrations`
- **Auth Required:** Yes
- **Response (200 OK):**
```json
[
  {
    "id": "7662fa9c-9bc7-4933-bf91-4cf1f7053e1a",
    "user_id": "993a776c-3729-4592-b062-8566b7bb7357",
    "user_card_id": "c1f7b8a1-529a-4c20-a8d2-43bbd51e737c",
    "brand_name": "Amazon Pay",
    "campaign_name": "Festive Multiplier",
    "identifier_type": "EMAIL",
    "masked_identifier": "j***e@gmail.com",
    "status": "REGISTERED",
    "registration_date": "2026-10-31",
    "portal_url": "https://amazon.in/pay",
    "multiplier_benefit": "5X Rewards",
    "valid_until": "2026-12-31",
    "notes": "Verified primary email account",
    "created_at": "2026-10-31T09:15:00.000Z",
    "updated_at": "2026-10-31T09:15:00.000Z",
    "user_cards": { ... }
  }
]
```

### 6.2 Create Brand Registration
- **Route:** `POST /api/brand-registrations`
- **Auth Required:** Yes
- **Request Body:**
```json
{
  "user_card_id": "c1f7b8a1-529a-4c20-a8d2-43bbd51e737c",
  "brand_name": "Amazon Pay",
  "campaign_name": "Festive Multiplier",
  "identifier_type": "EMAIL",
  "raw_identifier": "john.doe@gmail.com",
  "status": "REGISTERED",
  "portal_url": "https://amazon.in/pay",
  "multiplier_benefit": "5X Rewards",
  "valid_until": "2026-12-31",
  "notes": "Verified primary email account"
}
```
- **Validation Rules:**
  - `brand_name` must be a non-empty string.
  - `status` must be one of: `REGISTERED`, `PENDING`, `NOT_REGISTERED`, `EXPIRED`.
  - `identifier_type` must be one of: `EMAIL`, `PHONE`, `OTHER`.
  - Server automatically masks `raw_identifier` before storage (`j***e@gmail.com`).
  - Duplicate check: Rejects if user already has an active entry for the same brand (409 Conflict).
- **Response (201 Created):** Returns created registration record.

### 6.3 Update Brand Registration
- **Route:** `PATCH /api/brand-registrations/:id`
- **Auth Required:** Yes
- **Request Body:** Optional fields (`brand_name`, `status`, `identifier_type`, `raw_identifier`, `valid_until`, `notes`, etc.).
- **Response (200 OK):** Returns updated registration record.

### 6.4 Delete Brand Registration
- **Route:** `DELETE /api/brand-registrations/:id`
- **Auth Required:** Yes
- **Response (200 OK):**
```json
{
  "success": true,
  "count": 1
}
```

---

## 7. Offer Redemptions & Savings Endpoints

### 7.1 List Offer Redemptions
- **Route:** `GET /api/offer-redemptions`
- **Auth Required:** Yes
- **Query Parameters:** `status` (optional), `offer_id` (optional), `transaction_id` (optional).
- **Response (200 OK):**
```json
[
  {
    "id": "59cb37bc-7d92-498c-90b1-4d3f545a98d3",
    "user_id": "993a776c-3729-4592-b062-8566b7bb7357",
    "offer_id": "OFF_AMAZON_HDFC",
    "transaction_id": "e441c090-3331-419b-a3f5-79a8e0cb703e",
    "user_card_id": "c1f7b8a1-529a-4c20-a8d2-43bbd51e737c",
    "card_id": "hdfc-infinia",
    "merchant_name": "Amazon",
    "transaction_amount": 15000,
    "status": "REDEEMED",
    "estimated_discount": 1500,
    "confirmed_discount": 1500,
    "estimated_cashback": 0,
    "confirmed_cashback": 0,
    "estimated_reward_points": 0,
    "confirmed_reward_points": 0,
    "cashback_status": "NOT_APPLICABLE",
    "redemption_date": "2026-10-31",
    "confirmation_date": "2026-10-31",
    "notes": "Applied instant discount at checkout",
    "created_at": "2026-10-31T09:35:00.000Z",
    "updated_at": "2026-10-31T09:35:00.000Z"
  }
]
```

### 7.2 Create Offer Redemption
- **Route:** `POST /api/offer-redemptions`
- **Auth Required:** Yes
- **Request Body:**
```json
{
  "offer_id": "OFF_AMAZON_HDFC",
  "transaction_id": "e441c090-3331-419b-a3f5-79a8e0cb703e",
  "user_card_id": "c1f7b8a1-529a-4c20-a8d2-43bbd51e737c",
  "card_id": "hdfc-infinia",
  "merchant_name": "Amazon",
  "transaction_amount": 15000,
  "status": "APPLIED",
  "estimated_discount": 1500,
  "confirmed_discount": 0,
  "estimated_cashback": 0,
  "confirmed_cashback": 0,
  "estimated_reward_points": 0,
  "confirmed_reward_points": 0,
  "cashback_status": "NOT_APPLICABLE"
}
```
- **Validation Rules:**
  - `status` must be one of: `AVAILABLE`, `SAVED`, `APPLIED`, `REDEEMED`, `PENDING_CASHBACK`, `EXPIRED`, `NOT_REDEEMED`.
  - `cashback_status` must be one of: `NOT_APPLICABLE`, `PENDING`, `RECEIVED`, `FAILED`.
  - All monetary values must be non-negative (`Math.max(0, ...)`).
  - Rejects duplicate redemptions for the same transaction + offer (409 Conflict).
  - Rejects duplicate bookmarks for the same user + offer when status is `SAVED` (409 Conflict).
  - Ownership check: Validates that `user_card_id` and `transaction_id` belong to the user.
- **Response (201 Created):** Returns created redemption record.

### 7.3 Update Offer Redemption (State Machine Enforcement)
- **Route:** `PATCH /api/offer-redemptions/:id`
- **Auth Required:** Yes
- **Request Body:** Optional fields to update (`status`, `confirmed_discount`, `confirmed_cashback`, `cashback_status`, `confirmation_date`, etc.).
- **State Transition Enforcement:** The server enforces valid state transitions:
  - Allowed from `SAVED`: `AVAILABLE`, `APPLIED`, `NOT_REDEEMED`, `EXPIRED`
  - Allowed from `APPLIED`: `REDEEMED`, `PENDING_CASHBACK`, `NOT_REDEEMED`, `EXPIRED`
  - Allowed from `PENDING_CASHBACK`: `REDEEMED`, `NOT_REDEEMED`, `EXPIRED`
  - Allowed from `REDEEMED`: `REDEEMED` (Terminal confirmed state; cannot revert)
- **Response (200 OK):** Returns updated redemption record.
- **Error (400 Bad Request):** If an invalid state jump is attempted (e.g., `REDEEMED` $\rightarrow$ `SAVED`).

### 7.4 Delete Offer Redemption
- **Route:** `DELETE /api/offer-redemptions/:id`
- **Auth Required:** Yes
- **Response (200 OK):**
```json
{
  "success": true,
  "count": 1
}
```

---

## 8. Travel Goals Endpoints

### 8.1 List Travel Goals
- **Route:** `GET /api/travel-goals`
- **Auth Required:** Yes
- **Response (200 OK):** Array of travel goals for the user.

### 8.2 Create Travel Goal
- **Route:** `POST /api/travel-goals`
- **Auth Required:** Yes
- **Request Body:**
```json
{
  "departure": "DEL",
  "destination": "SIN",
  "cabin": "ECONOMY",
  "trip_type": "ONE_WAY",
  "departure_date": "2026-11-15",
  "return_date": null,
  "program_id": "SINGAPORE_KRISFLYER",
  "target_points": 20000,
  "estimated_cash_fare": 25000
}
```
- **Validation Rules:**
  - `departure` and `destination` must be non-empty IATA airport codes.
  - `target_points` must be between 0 and 100,000,000.
  - `estimated_cash_fare` must be a valid positive amount.
- **Response (201 Created):** Returns created travel goal record.

### 8.3 Delete Travel Goal
- **Route:** `DELETE /api/travel-goals/:id`
- **Auth Required:** Yes
- **Response (200 OK):**
```json
{
  "success": true,
  "count": 1
}
```

---

## 9. Analytics Microservice Proxy Endpoint

### 9.1 Spending Summary (Python Proxy with Node Fallback)
- **Route:** `POST /api/analytics/summary`
- **Auth Required:** Yes
- **Request Body:**
```json
{
  "transactions": [
    {
      "amount": 15000,
      "category": "Shopping",
      "date": "2026-10-31",
      "card": "Infinia Metal",
      "merchant": "Amazon"
    }
  ]
}
```
*Note: If `transactions` is omitted, the backend automatically fetches the authenticated user's actual database transactions.*
- **Behavior:**
  - Proxies to the Python FastAPI microservice at `http://localhost:8000/api/analytics/summary` with a 2.5s `AbortController` timeout.
  - If Python is online and responds within 2.5s, returns response with `"source": "fastapi"`.
  - If Python times out or is offline, invokes the internal Node.js aggregation engine and returns identical response with `"source": "node_fallback"`.
- **Response (200 OK):**
```json
{
  "total_spend": 15000.0,
  "transaction_count": 1,
  "average_spend": 15000.0,
  "category_breakdown": {
    "Shopping": 15000.0
  },
  "card_breakdown": {
    "Infinia Metal": 15000.0
  },
  "merchant_breakdown": [
    {
      "merchant": "Amazon",
      "total_amount": 15000.0,
      "count": 1,
      "avg_amount": 15000.0
    }
  ],
  "monthly_trend": [
    {
      "month": "2026-10",
      "amount": 15000.0,
      "count": 1
    }
  ],
  "weekly_trend": [],
  "day_of_week_breakdown": {
    "Saturday": 15000.0
  },
  "source": "fastapi"
}
```
