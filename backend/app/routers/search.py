"""Legal source search + reference metadata (jurisdictions, topics, modes)."""
from fastapi import APIRouter, Query

from ..schemas import SearchResult
from ..services import legal_data

router = APIRouter(prefix="/api", tags=["search"])


@router.get("/search", response_model=list[SearchResult])
def search(
    q: str = Query("", description="Free-text query"),
    jurisdiction: str = Query("India"),
    topic: str | None = Query(None),
):
    if q:
        results = legal_data.search(q, jurisdiction, limit=20)
    else:
        # No query: show the full curated corpus as a browsable index.
        results = [
            {**{k: v for k, v in s.items() if k != "keywords"}, "relevance": 0.0}
            for s in legal_data.SOURCES
            if s["jurisdiction"].lower() == jurisdiction.lower()
        ]
    if topic:
        results = [r for r in results if r["topic"] == topic]
    return results


@router.get("/reference/meta")
def reference_meta():
    """Static reference data used to populate selectors in the UI."""
    return {
        "jurisdictions": {
            "India": {
                "states": [
                    "Andhra Pradesh", "Assam", "Bihar", "Delhi", "Gujarat",
                    "Karnataka", "Kerala", "Madhya Pradesh", "Maharashtra",
                    "Punjab", "Rajasthan", "Tamil Nadu", "Telangana",
                    "Uttar Pradesh", "West Bengal",
                ]
            },
            "Generic / International": {"states": []},
        },
        "topics": legal_data.TOPICS,
        "modes": [
            {"id": "simple", "label": "Simple", "hint": "No legal background needed"},
            {"id": "detailed", "label": "Detailed", "hint": "More context & reasoning"},
            {"id": "expert", "label": "Expert", "hint": "Legal terminology"},
            {"id": "executive", "label": "Executive summary", "hint": "For business owners"},
            {"id": "eli5", "label": "Very simple", "hint": "Extremely accessible"},
            {"id": "bullet", "label": "Bullet points", "hint": "Key points only"},
        ],
        "personas": [
            {"id": "individual", "label": "Individual"},
            {"id": "business", "label": "Business"},
            {"id": "employee", "label": "Employee"},
            {"id": "landlord", "label": "Landlord"},
            {"id": "tenant", "label": "Tenant"},
        ],
    }
