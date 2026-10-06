from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import pandas as pd
from typing import List

app = FastAPI(title="CardIO Analytics API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class Transaction(BaseModel):
    amount: float
    category: str
    date: str
    card: str

class AnalyticsRequest(BaseModel):
    transactions: List[Transaction]

@app.get("/api/health")
def health_check():
    return {"status": "ok", "service": "analytics"}

@app.post("/api/analytics/summary")
def get_analytics_summary(request: AnalyticsRequest):
    if not request.transactions:
        return {"total_spend": 0, "category_breakdown": {}}
        
    df = pd.DataFrame([t.dict() for t in request.transactions])
    
    total_spend = float(df['amount'].sum())
    
    # Category breakdown
    category_breakdown = df.groupby('category')['amount'].sum().to_dict()
    
    # Card breakdown
    card_breakdown = df.groupby('card')['amount'].sum().to_dict()
    
    return {
        "total_spend": total_spend,
        "category_breakdown": category_breakdown,
        "card_breakdown": card_breakdown
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
