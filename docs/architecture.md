# CardIO System Architecture Documentation

**System:** CardIO — Intelligent Credit Card Optimization Platform  
**Document:** System Architecture & Component Interaction Specification  
**Status:** Approved for Release  
**Version:** 2.0.0  

---

## 1. High-Level Architecture Overview

CardIO is engineered as a multi-tier, hybrid application designed for high-precision financial calculations, strict user isolation, and resilient failover. It decouples static credit card knowledge (catalogue, conversion ratios, airline award charts) from user financial data (cards, transactions, registrations, redemptions).

```mermaid
flowchart TD
    subgraph ClientLayer ["1. Client Application (Browser / React 19)"]
        UI["React 19 View Pages\n(Dashboard, MyCards, RewardsHub, BestCard, TravelGoals, Analytics)"]
        DataStore["In-Memory CSV Data Store\n(Zod Validated Indian Cards & Award Charts)"]
        Engines["Client-Side Engines\n(offerEngine, savingsCalculator, travelPlanner)"]
        AuthClient["Supabase JS Auth Client\n(JWT Session Management & Scoped RLS)"]
        APIClient["API Client\n(fetchWithRetry to Express REST API)"]
        
        UI --> Engines
        UI --> DataStore
        UI --> AuthClient
        UI --> APIClient
    end

    subgraph APILayer ["2. Application Backend (Node.js & Express 5)"]
        ExpressApp["Express.js Server (:5000)\nCORS, Helmet Security Headers, 1MB Payload Limit"]
        AuthMiddleware["JWT Verification Middleware\nsupabaseAdmin.auth.getUser(token)"]
        
        subgraph Controllers ["Resource Controllers & IDOR Defenses"]
            CardsCtrl["Cards Controller\n(Ownership checks & unlinking on delete)"]
            TxnCtrl["Transactions Controller\n(Card validation, ceiling caps & reward fallback)"]
            RegCtrl["Brand Registration Controller\n(Server-side PII masking & duplicate checks)"]
            RedempCtrl["Offer Redemptions Controller\n(7-Stage State Machine & Non-negative bounds)"]
            DashCtrl["Dashboard Controller\n(Concurrent Promise.all aggregations & MoM math)"]
        end
        
        NodeFallback["Node.js Resilient Aggregation Engine\n(In-memory Pandas parity aggregation)"]
        
        ExpressApp --> AuthMiddleware
        AuthMiddleware --> Controllers
    end

    subgraph AnalyticsLayer ["3. Python Analytics Microservice (FastAPI :8000)"]
        FastAPI["FastAPI Python Microservice"]
        PandasEngine["Pandas DataFrame Processing Engine\n(Groupby, Category Breakdown, Trend Time Series)"]
        FastAPI --> PandasEngine
    end

    subgraph DataLayer ["4. Persistence & Identity (Supabase PostgreSQL)"]
        AuthDB["auth.users\n(Managed OAuth & Email/Password Identity)"]
        ProfilesDB["public.profiles\n(Automatic profile trigger on signup)"]
        UserCardsDB["public.user_cards\n(Row Level Security: auth.uid = user_id)"]
        TxnDB["public.transactions\n(Row Level Security: auth.uid = user_id)"]
        RegDB["public.brand_registrations\n(Row Level Security: auth.uid = user_id)"]
        RedempDB["public.offer_redemptions\n(Row Level Security: auth.uid = user_id)"]
        TravelDB["public.travel_goals\n(Row Level Security: auth.uid = user_id)"]
        
        AuthDB --> ProfilesDB
        ProfilesDB --> UserCardsDB
        UserCardsDB --> TxnDB
        UserCardsDB --> RegDB
        TxnDB --> RedempDB
        UserCardsDB --> RedempDB
    end

    APIClient -->|Bearer Token & API Requests| ExpressApp
    AuthClient -->|Login & Token Refresh| AuthDB
    Controllers -->|Scoped User Queries| DataLayer
    Controllers -->|2.5s AbortController Timeout| FastAPI
    Controllers -.->|Timeout / Service Offline| NodeFallback
```

---

## 2. Component Interactions & Communication Patterns

### 2.1 Hybrid Data Model
1. **Static Financial Datasets**:
   - Reside in `client/public/data/` (`credit_cards.csv`, `card_program_ratios.csv`, `award_chart.csv`, `airports.csv`).
   - Validated on client startup using Zod schemas in `dataStore.ts`.
   - Indexed into high-speed in-memory Maps (`cardById`, `ratiosByCard`, `awardsByRoute`).
   - Advantage: Zero database round-trips for card catalogue searches, instant 3D card rendering, and deterministic offline offer calculations.

2. **Dynamic Transactional & User Data**:
   - Persisted in Supabase PostgreSQL tables.
   - Protected by Row Level Security (RLS) policies ensuring users can only read, insert, update, or delete their own rows.
   - Accessed via two distinct paths:
     - Direct Supabase Client: Used for user authentication sessions and scoped direct queries.
     - Express REST API: Used for complex cross-entity operations, IDOR verification, server-side PII masking, lifecycle state machine enforcement, and analytics proxying.

---

## 3. Authentication & Authorization Flow

```mermaid
sequenceDiagram
    autonumber
    actor User as User / Browser
    participant Client as React Client (api.ts)
    participant Express as Express API (:5000)
    participant SupabaseAuth as Supabase Auth (auth.users)
    participant Database as PostgreSQL (RLS Enforced)

    User->>Client: Enters credentials on Login page
    Client->>SupabaseAuth: supabase.auth.signInWithPassword()
    SupabaseAuth-->>Client: Returns Session (JWT access_token + refresh_token)
    
    Note over Client,Express: Every private REST API request includes Authorization: Bearer <JWT>
    
    Client->>Express: GET /api/dashboard (Header: Bearer <token>)
    Express->>Express: authMiddleware intercepts request
    Express->>SupabaseAuth: supabaseAdmin.auth.getUser(token)
    
    alt Token Invalid or Expired
        SupabaseAuth-->>Express: Error: invalid token
        Express-->>Client: HTTP 401 Unauthorized
    else Token Valid
        SupabaseAuth-->>Express: Returns authenticated user object (user.id)
        Express->>Express: Attaches (req as any).user = user
        Express->>Express: Initializes scoped user client with auth header
        Express->>Database: Queries user_cards, transactions, offer_redemptions (.eq('user_id', user.id))
        Database-->>Express: Returns scoped datasets
        Express-->>Client: Returns aggregated dashboard JSON
    end
```

### Authorization Rules & IDOR Defense
- **Token Source of Truth**: User ID is never accepted from the request body or URL parameters. It is extracted strictly from `(req as any).user.id` verified by Supabase Auth.
- **Resource Ownership Verification**: When mutating child entities that reference existing resources (`user_card_id`, `transaction_id`), the backend performs defensive database checks (`verifyUserCardOwnership`, `verifyTransactionOwnership`) to prevent Insecure Direct Object References (IDOR).
- **Graceful Token Refresh**: The frontend `api.ts` transparently catches 401 errors, invokes `supabase.auth.refreshSession()`, and replays the original request with the fresh token.

---

## 4. Intelligent Offer Eligibility & Recommendation Workflow

The offer engine (`client/src/lib/engine/offerEngine.ts`) implements variant-specific matching, spend threshold validation, discount capping, and registration verification.

```mermaid
flowchart TD
    Start["User Enters Transaction Details\n(Merchant, Amount, Category, Date)"] --> Normalize["Normalize Merchant Name\n(e.g., 'Amazon India' -> 'amazon')"]
    Normalize --> FilterOffers["Filter Active Merchant Offers\n(Date validity, Category match, Min Spend <= Amount)"]
    
    FilterOffers --> CardLoop{"For each active user card:"}
    
    CardLoop --> CheckVariant["Check Card Variant Eligibility\n(Match issuer and exact card_id)"]
    CheckVariant -- Not Eligible --> NextCard["Evaluate Next Card"]
    
    CheckVariant -- Eligible --> CalcBenefit["Calculate Potential Benefit\n(Discount %, Cashback %, Reward Rate)"]
    CalcBenefit --> ApplyCap["Apply Maximum Benefit Cap\n(netBenefit = min(rawBenefit, maxBenefitINR))"]
    
    ApplyCap --> CheckReg{"Offer requires platform registration?"}
    CheckReg -- Yes --> VerifyReg["Check Brand Registration Tracker\n(Status == REGISTERED)"]
    VerifyReg -- Registered --> AddEligible["Mark Card Eligible\n(Registration Verified)"]
    VerifyReg -- Not Registered --> AddWithWarning["Mark Card Eligible\n(Flag Warning: Registration Required)"]
    CheckReg -- No --> AddEligible
    
    AddEligible --> NextCard
    AddWithWarning --> NextCard
    
    NextCard --> SortCards["Sort Cards by Net Benefit (INR)\nand Effective Return Rate (%)"]
    SortCards --> Recommend["Identify Recommended Card\n(Highest Net Value) + Alternative Cards"]
```

### Offer Valuation Rules
1. **Instant Discounts vs. Cashback**: Instant discount is applied directly against the invoice amount; cashback is recorded as an expected post-settlement benefit.
2. **Cap Enforcement**: If a 10% discount on a ₹20,000 transaction yields ₹2,000, but the offer cap is ₹1,500:
   $$\text{netBenefitINR} = \min(2000, 1500) = 1500$$
   $$\text{isCapped} = \text{true}$$
3. **Reward Points Conversion**: Card reward points are converted to rupee equivalents using card-specific point values:
   $$\text{Reward Value (INR)} = \frac{\text{Points Earned} \times \text{Point Value (Paise)}}{100}$$

---

## 5. Brand Registration & Offer Redemption Lifecycles

### 5.1 Brand Registration Lifecycle
The Brand Registration Tracker (`client/src/lib/engine/brandRegistration.ts`) tracks platform promotional enrollments with strict PII masking.

```mermaid
stateDiagram-v2
    [*] --> PENDING: User submits registration request
    PENDING --> REGISTERED: User verifies registration on brand portal
    PENDING --> NOT_REGISTERED: User cancels or leaves unverified
    REGISTERED --> EXPIRED: Current date exceeds valid_until
    REGISTERED --> NOT_REGISTERED: User de-registers from platform
    EXPIRED --> REGISTERED: User re-enrolls in new campaign
    NOT_REGISTERED --> REGISTERED: User registers for upcoming promotion
```

- **Masking at Rest**: Raw identifiers (emails and phone numbers) are masked before persisting to the database.
- **Expiry Monitoring**: Registrations expiring within 7 days are automatically surfaced as alert badges on the My Cards page.

---

### 5.2 Offer Redemption Lifecycle State Machine
Offer redemptions follow a deterministic, non-regressive state machine defined in `client/src/lib/engine/savingsCalculator.ts`.

```mermaid
stateDiagram-v2
    [*] --> AVAILABLE: Offer active in catalogue
    AVAILABLE --> SAVED: User bookmarks offer for later
    AVAILABLE --> APPLIED: User links offer to new transaction
    SAVED --> APPLIED: Transaction executed with offer
    SAVED --> EXPIRED: Validity date passes without use
    
    APPLIED --> REDEEMED: Receipt verified (Instant Discount confirmed)
    APPLIED --> PENDING_CASHBACK: Transaction settled, awaiting bank credit
    APPLIED --> NOT_REDEEMED: User forgot promo code or cancelled order
    
    PENDING_CASHBACK --> REDEEMED: Cashback credited to credit card statement
    PENDING_CASHBACK --> NOT_REDEEMED: Bank rejected cashback claim
    
    REDEEMED --> REDEEMED: Immutable Confirmed State
    NOT_REDEEMED --> APPLIED: Transaction re-evaluated
    EXPIRED --> [*]
```

### Financial Segregation Principle
- **Confirmed Savings**:
  $$\text{Confirmed Savings} = \sum_{\text{REDEEMED}} (\text{Confirmed Discount} + \text{Confirmed Cashback} + \text{Confirmed Points Value})$$
- **Pending Cashback**:
  $$\text{Pending Cashback} = \sum_{\text{PENDING\_CASHBACK}} \text{Estimated Cashback}$$
- Under no circumstances is pending cashback credited to confirmed savings until settlement receipt confirmation.

---

## 6. Analytics Microservice & Failover Architecture

CardIO utilizes a dual-engine architecture for expense and savings analytics:
1. **Primary Engine**: Standalone Python 3.11 service utilizing **FastAPI + Pandas** running on `localhost:8000`. It provides high-performance group-by operations, category breakdowns, and time-series aggregations.
2. **Resilient Failover Engine**: Embedded **Node.js aggregation engine** inside the Express backend.

```mermaid
sequenceDiagram
    autonumber
    participant Client as React Client
    participant Express as Express Server (:5000)
    participant Python as FastAPI Service (:8000)
    participant DB as PostgreSQL

    Client->>Express: POST /api/analytics/summary
    alt Transactions omitted in request body
        Express->>DB: Fetches authenticated user's actual transactions
        DB-->>Express: Returns transactions array
    end
    
    Express->>Express: Creates AbortController with 2500ms timeout
    Express->>Python: POST /api/analytics/summary (with transactions)
    
    alt Python Service Responds within 2.5s
        Python-->>Express: Returns 200 OK + Aggregated JSON
        Express-->>Client: Returns JSON with source: 'fastapi'
    else Python Offline or Times Out (> 2500ms)
        Express->>Express: Catches timeout/connection error
        Express->>Express: Invokes Node.js Fallback Aggregation Engine
        Express->>Express: Computes spend, category, card, merchant & trend metrics
        Express-->>Client: Returns identical JSON structure with source: 'node_fallback'
    end
```

### Zero-State Resilience
Both Python and Node.js engines safely process empty transaction lists (`[]`), returning zeroed totals and empty maps rather than throwing `DivisionByZero` or `NaN` errors.
