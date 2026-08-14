from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

# Initialize FastAPI app
app = FastAPI(
    title="GST Reconciliation Platform API",
    description="3-Way reconciliation engine between SAP MM and GSTR-2B.",
    version="1.0.0"
)

# Configure CORS for frontend React app
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], # For dev. Restrict in prod.
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/health")
def health_check():
    return {"status": "ok", "message": "GST Reco Platform is running"}

from .database import engine, Base
Base.metadata.create_all(bind=engine)

# Include API routers
from .api import ingestion, reconciliation
app.include_router(ingestion.router, prefix="/api/v1")
app.include_router(reconciliation.router, prefix="/api/v1")

# Route aliases
app.post("/api/v1/ingest/gstr2b-json", tags=["ingestion"])(ingestion.upload_gstr2b_json)
app.post("/api/v1/ingest/sap-excel", tags=["ingestion"])(ingestion.ingest_sap_excel)
app.get("/api/v1/data/sap", tags=["data"])(reconciliation.get_raw_sap_data)
app.get("/api/v1/data/gstr2b", tags=["data"])(reconciliation.get_raw_gstr2b_data)
app.get("/api/v1/reconcile/results", tags=["reconciliation"])(reconciliation.get_reconciliation_results)
app.post("/api/v1/reconcile/run", tags=["reconciliation"])(reconciliation.run_reconciliation)
app.post("/api/v1/reconcile/manual-match", tags=["reconciliation"])(reconciliation.force_manual_match)



