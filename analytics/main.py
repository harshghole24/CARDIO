from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
import pandas as pd
from typing import List, Optional, Dict, Any

app = FastAPI(title="CardIO Analytics API", version="2.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class Transaction(BaseModel):
    amount: float
    category: Optional[str] = "General"
    date: Optional[str] = ""
    card: Optional[str] = "Unspecified"
    merchant: Optional[str] = "Other"
    reward_earned: Optional[float] = 0.0
    cashback_earned: Optional[float] = 0.0

class AnalyticsRequest(BaseModel):
    transactions: List[Transaction] = Field(default_factory=list)

@app.get("/api/health")
def health_check():
    return {"status": "ok", "service": "analytics", "engine": "fastapi_pandas"}

@app.post("/api/analytics/summary")
def get_analytics_summary(request: AnalyticsRequest):
    if not request.transactions:
        return {
            "total_spend": 0.0,
            "transaction_count": 0,
            "average_spend": 0.0,
            "category_breakdown": {},
            "card_breakdown": {},
            "merchant_breakdown": [],
            "monthly_trend": [],
            "weekly_trend": [],
            "day_of_week_breakdown": {},
            "source": "fastapi"
        }
        
    df = pd.DataFrame([t.dict() for t in request.transactions])
    
    # Safe numerical and string sanitization
    df['amount'] = pd.to_numeric(df['amount'], errors='coerce').fillna(0.0)
    df['category'] = df['category'].fillna('General').astype(str)
    df['card'] = df['card'].fillna('Unspecified').astype(str)
    df['merchant'] = df['merchant'].fillna('Other').astype(str)
    
    total_spend = round(float(df['amount'].sum()), 2)
    transaction_count = int(len(df))
    average_spend = round(float(df['amount'].mean()), 2) if transaction_count > 0 else 0.0

    # Category breakdown (dict of category: sum amount)
    category_series = df.groupby('category')['amount'].sum().round(2)
    category_breakdown = category_series.to_dict()
    
    # Card breakdown (dict of card: sum amount)
    card_series = df.groupby('card')['amount'].sum().round(2)
    card_breakdown = card_series.to_dict()

    # Top Merchants breakdown
    merchant_grouped = df.groupby('merchant').agg(
        total_amount=('amount', 'sum'),
        count=('amount', 'count'),
        avg_amount=('amount', 'mean')
    ).reset_index()
    merchant_grouped = merchant_grouped.sort_values(by='total_amount', ascending=False).head(10)
    merchant_breakdown = [
        {
            "merchant": str(row['merchant']),
            "total_amount": round(float(row['total_amount']), 2),
            "count": int(row['count']),
            "avg_amount": round(float(row['avg_amount']), 2)
        }
        for _, row in merchant_grouped.iterrows()
    ]

    # Time series trends
    monthly_trend = []
    weekly_trend = []
    day_of_week_breakdown = {}
    
    try:
        df['datetime'] = pd.to_datetime(df['date'], errors='coerce')
        valid_dates = df.dropna(subset=['datetime']).copy()
        
        if not valid_dates.empty:
            # Monthly trend: YYYY-MM
            valid_dates['month'] = valid_dates['datetime'].dt.strftime('%Y-%m')
            month_grouped = valid_dates.groupby('month').agg(
                amount=('amount', 'sum'),
                count=('amount', 'count')
            ).reset_index().sort_values('month')
            monthly_trend = [
                {"month": str(row['month']), "amount": round(float(row['amount']), 2), "count": int(row['count'])}
                for _, row in month_grouped.iterrows()
            ]

            # Weekly trend: YYYY-Www
            valid_dates['week'] = valid_dates['datetime'].dt.strftime('%Y-W%U')
            week_grouped = valid_dates.groupby('week').agg(
                amount=('amount', 'sum'),
                count=('amount', 'count')
            ).reset_index().sort_values('week').tail(12)
            weekly_trend = [
                {"week": str(row['week']), "amount": round(float(row['amount']), 2), "count": int(row['count'])}
                for _, row in week_grouped.iterrows()
            ]

            # Day of week
            valid_dates['day_name'] = valid_dates['datetime'].dt.day_name()
            day_order = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']
            day_grouped = valid_dates.groupby('day_name')['amount'].sum().round(2).to_dict()
            day_of_week_breakdown = {day: round(float(day_grouped[day]), 2) for day in day_order if day in day_grouped}
    except Exception:
        pass

    return {
        "total_spend": total_spend,
        "transaction_count": transaction_count,
        "average_spend": average_spend,
        "category_breakdown": category_breakdown,
        "card_breakdown": card_breakdown,
        "merchant_breakdown": merchant_breakdown,
        "monthly_trend": monthly_trend,
        "weekly_trend": weekly_trend,
        "day_of_week_breakdown": day_of_week_breakdown,
        "source": "fastapi"
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
