"""India-first seed corpus of well-known legal sources + a lightweight search.

This is a small, curated reference set used to power the search page and to
provide plausible citations in offline/mock mode. In production this table is
replaced by a proper document store + vector index (see ARCHITECTURE.md → RAG).

NOTE: Section references are widely known but readers must verify against the
official source before relying on them. URLs point at official portals.
"""
from __future__ import annotations

SOURCES: list[dict] = [
    {
        "title": "Section 138 — Dishonour of cheque for insufficiency of funds",
        "description": "Makes bouncing of a cheque for insufficiency of funds a criminal offence, punishable with imprisonment up to two years and/or fine up to twice the cheque amount, subject to notice and procedure.",
        "jurisdiction": "India",
        "authority": "Negotiable Instruments Act, 1881",
        "section": "Section 138",
        "topic": "Criminal / Commercial",
        "url": "https://www.indiacode.nic.in/handle/123456789/2435",
        "published_date": "1881-12-09",
        "effective_date": "1989-04-01",
        "keywords": ["cheque", "check", "bounce", "138", "dishonour", "insufficient funds", "negotiable"],
    },
    {
        "title": "Rights of tenants and eviction procedure",
        "description": "Eviction generally requires due process and adequate notice under the applicable state Rent Control Act or the Model Tenancy Act, 2021. Arbitrary short-notice eviction is typically not permitted.",
        "jurisdiction": "India",
        "authority": "Model Tenancy Act, 2021 / State Rent Acts",
        "section": "Model Tenancy Act, 2021",
        "topic": "Property / Rent",
        "url": "https://mohua.gov.in/cms/model-tenancy-act.php",
        "published_date": "2021-06-02",
        "effective_date": "2021-06-02",
        "keywords": ["tenant", "landlord", "eviction", "rent", "lease", "notice", "vacate", "tenancy"],
    },
    {
        "title": "Termination of employment & notice / retrenchment",
        "description": "Conditions for termination, notice pay and retrenchment compensation for workmen are governed by the Industrial Disputes Act, 1947 and shops & establishments acts; wrongful termination may entitle an employee to remedies.",
        "jurisdiction": "India",
        "authority": "Industrial Disputes Act, 1947",
        "section": "Sections 25F–25N",
        "topic": "Employment",
        "url": "https://www.indiacode.nic.in/handle/123456789/1889",
        "published_date": "1947-04-11",
        "effective_date": "1947-04-11",
        "keywords": ["termination", "fired", "employment", "notice period", "retrenchment", "layoff", "workman", "job", "dismissal"],
    },
    {
        "title": "Consumer rights, unfair trade practices & complaints",
        "description": "Establishes consumer rights, a three-tier redressal system (District/State/National Commissions), and rules on unfair trade practices, product liability and e-commerce.",
        "jurisdiction": "India",
        "authority": "Consumer Protection Act, 2019",
        "section": "Consumer Protection Act, 2019",
        "topic": "Consumer",
        "url": "https://consumeraffairs.nic.in/acts-and-rules/consumer-protection",
        "published_date": "2019-08-09",
        "effective_date": "2020-07-20",
        "keywords": ["consumer", "refund", "warranty", "defective", "complaint", "e-commerce", "unfair trade", "product"],
    },
    {
        "title": "Protection of personal data & privacy obligations",
        "description": "Establishes obligations for data fiduciaries handling digital personal data, rights of data principals, consent requirements and penalties for breaches.",
        "jurisdiction": "India",
        "authority": "Digital Personal Data Protection Act, 2023",
        "section": "DPDP Act, 2023",
        "topic": "Data / Privacy",
        "url": "https://www.meity.gov.in/data-protection-framework",
        "published_date": "2023-08-11",
        "effective_date": "2023-08-11",
        "keywords": ["privacy", "data", "personal data", "consent", "dpdp", "breach", "data protection"],
    },
    {
        "title": "Goods and Services Tax — registration & returns",
        "description": "Framework for indirect taxation on supply of goods and services, including registration thresholds, invoicing, input tax credit and periodic returns.",
        "jurisdiction": "India",
        "authority": "Central Goods and Services Tax Act, 2017",
        "section": "CGST Act, 2017",
        "topic": "Business / Tax",
        "url": "https://www.cbic.gov.in/entities/cbic-content-mst/NzY=",
        "published_date": "2017-04-12",
        "effective_date": "2017-07-01",
        "keywords": ["gst", "tax", "registration", "return", "input tax", "invoice", "cgst", "notification"],
    },
    {
        "title": "Right to Information — obtaining public records",
        "description": "Gives citizens the right to request information from public authorities, with defined timelines (generally 30 days) and an appeals mechanism.",
        "jurisdiction": "India",
        "authority": "Right to Information Act, 2005",
        "section": "RTI Act, 2005",
        "topic": "Government / Civil",
        "url": "https://rti.gov.in/",
        "published_date": "2005-06-15",
        "effective_date": "2005-10-12",
        "keywords": ["rti", "information", "public authority", "government", "records", "appeal"],
    },
    {
        "title": "Maintenance & rights on divorce / separation",
        "description": "Rights to maintenance, custody and property vary by personal law and the Special Marriage Act; interim maintenance and procedure are court-governed.",
        "jurisdiction": "India",
        "authority": "Hindu Marriage Act, 1955 / Special Marriage Act, 1954",
        "section": "Hindu Marriage Act, 1955",
        "topic": "Personal / Family",
        "url": "https://www.indiacode.nic.in/handle/123456789/1560",
        "published_date": "1955-05-18",
        "effective_date": "1955-05-18",
        "keywords": ["divorce", "marriage", "maintenance", "custody", "alimony", "separation", "family"],
    },
]

TOPICS = sorted({s["topic"] for s in SOURCES})


def search(query: str, jurisdiction: str = "India", limit: int = 10) -> list[dict]:
    """Simple keyword relevance scoring over the seed corpus."""
    q = (query or "").lower()
    terms = [t for t in q.replace("?", " ").split() if len(t) > 2]
    scored: list[tuple[float, dict]] = []
    for s in SOURCES:
        if jurisdiction and s["jurisdiction"].lower() != jurisdiction.lower():
            continue
        score = 0.0
        hay = " ".join(
            [s["title"], s["description"], s["topic"]] + s["keywords"]
        ).lower()
        for kw in s["keywords"]:
            if kw in q:
                score += 3.0
        for t in terms:
            if t in hay:
                score += 1.0
        if score > 0:
            scored.append((score, s))
    scored.sort(key=lambda x: x[0], reverse=True)
    results = []
    maxscore = scored[0][0] if scored else 1.0
    for score, s in scored[:limit]:
        item = {k: v for k, v in s.items() if k != "keywords"}
        item["relevance"] = round(min(1.0, score / maxscore), 2)
        results.append(item)
    return results
