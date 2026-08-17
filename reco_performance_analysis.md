# Reconciliation Engine — Performance Analysis

## Current Architecture

The engine in [`reconciliation.py`](file:///c:/Users/Expound%20Team/OneDrive%20-%20EXPOUND%20TECHNIVO%20PVT%20LTD/Documents/workspace2/GSTRECO/backend/app/api/reconciliation.py#L132-L296) runs 4 sequential matching levels, each doing a **nested loop** over SAP × GSTR-2B records. Successful matches are removed before the next level runs.

---

## Bottleneck #1 — O(N × M) Nested Loops (CRITICAL)

| Level | SAP Loop | GST Loop | Complexity | Expensive Operation |
|-------|----------|----------|-----------|---------------------|
| Level 1: Exact Match | N | M | **O(N×M)** | `clean_gstin()` called on every pair |
| Level 2: Normalized | N' | M' | **O(N'×M')** | `normalize_inv()` called on every GST record every SAP iteration |
| Level 3: Financial | N'' | M'' | **O(N''×M'')** | `difflib.SequenceMatcher()` created on every pair |
| Level 4: Fuzzy | N''' | M''' | **O(N'''×M''')** | `difflib.SequenceMatcher()` created on every pair |

**Impact**: If you have **15,000 SAP** and **15,000 GSTR-2B** records:
- Level 1 alone does up to **225 million** comparisons
- Even if Level 1 matches 3,000, Level 2 runs on 12K × 12K = **144 million** comparisons
- Levels 3 & 4 each create a `SequenceMatcher` object per pair — this is **extremely expensive**

> [!CAUTION]
> This O(N×M) algorithm is the #1 reason for slow performance. With 15K records on each side, you're looking at hundreds of millions of operations across all 4 levels.

---

## Bottleneck #2 — Repeated Computation Inside Loops

### `clean_gstin()` called redundantly
```python
# Line 202 — called INSIDE the inner loop for EVERY SAP×GST pair
clean_gstin(sap.vendor_gstin) == clean_gstin(gst.supplier_gstin)
```
For 15K × 15K = 225M pairs, `clean_gstin()` is called **450 million times** instead of being pre-computed once per record (30K calls).

### `normalize_inv()` for GST called redundantly
```python
# Line 224 — called INSIDE inner loop
gst_norm = normalize_inv(gst.invoice_number)
```
Each GST record's invoice number is normalized once per SAP record iteration — so 15K × 15K = 225M calls instead of 15K.

### `safe_float()` called redundantly
```python
# Lines 205-206, 226-227, 253-254, 277
abs(safe_float(sap.taxable_value) - safe_float(gst.taxable_value))
```
Called on every pair. Should be pre-computed once.

---

## Bottleneck #3 — No GSTIN-Based Grouping (CRITICAL)

The most impactful optimization. Currently, every SAP record is compared against **every** GST record. But matching can only happen between records with the **same GSTIN pair** (vendor_gstin == supplier_gstin).

If you have 500 unique GSTINs with ~30 invoices each:
- **Current**: 15K × 15K = 225M comparisons
- **With GSTIN grouping**: 500 groups × 30 × 30 = **450K comparisons** → **500× faster**

---

## Bottleneck #4 — `difflib.SequenceMatcher` (Levels 3 & 4)

```python
# Lines 249, 273
inv_similarity = difflib.SequenceMatcher(None, sap_norm, gst_norm).ratio()
```
`SequenceMatcher` is Python's general-purpose string similarity engine. It's:
- **Not optimized** for short strings (invoice numbers are typically 5-20 chars)
- **Creates a new object** per call (no caching of junk heuristics)
- Called potentially millions of times in Levels 3 & 4

---

## Bottleneck #5 — No Database Indexes

[`models.py`](file:///c:/Users/Expound%20Team/OneDrive%20-%20EXPOUND%20TECHNIVO%20PVT%20LTD/Documents/workspace2/GSTRECO/backend/app/models.py) has:
- **No index** on `sap_purchase_register.gstin` + `return_period`
- **No index** on `sap_purchase_register.vendor_gstin`
- **No index** on `gstr2b_invoices.gstin` + `return_period`
- **No index** on `reconciliation_summary.gstin` + `return_period`

The initial queries (lines 154-163) and the DELETE (line 146-149) are doing **full table scans**.

---

## Bottleneck #6 — Results Fetching (`/reconcile/results`)

```python
# Line 322 — N+1 query anti-pattern
sap = r.sap_record or (db.query(SapPurchaseRegister).filter_by(id=r.sap_id).first() if r.sap_id else None)
gst = r.gst_record or (db.query(Gstr2bInvoice).filter_by(id=r.gst_id).first() if r.gst_id else None)
```
Even though `joinedload` is used (line 311-312), the fallback queries fire individual SELECTs per row if eager loading fails — creating an **N+1 query problem** that scales linearly with result count.

---

## Optimization Recommendations (Same Logic, Just Faster)

| # | Optimization | Expected Speedup | Effort |
|---|-------------|-------------------|--------|
| 1 | **Group by GSTIN** before matching — build `dict[gstin → list[records]]` and only compare within same GSTIN | **100-500×** | Low |
| 2 | **Pre-compute** `clean_gstin()`, `normalize_inv()`, `safe_float()` once per record into lookup dicts | **5-10×** | Low |
| 3 | **Build hash indexes** — for Level 1 & 2, use `dict[(gstin, inv_num)]` for O(1) lookup instead of O(M) scan | **10-50×** | Low |
| 4 | **Add database indexes** on `(gstin, return_period)` and `vendor_gstin`/`supplier_gstin` | **2-5×** on data fetch | Low |
| 5 | **Remove N+1 fallback** queries in results endpoint | **2-3×** on results fetch | Low |
| 6 | **Batch SequenceMatcher** — only run fuzzy matching on records within same GSTIN group (dramatically reduces call count) | **50-100×** on L3/L4 | Low |

> [!IMPORTANT]
> **Combined estimated improvement: 500× to 2000× faster** — turning a 5-minute run into 1-3 seconds — without changing any matching logic or thresholds.

---

## Summary

The matching logic (4 levels, thresholds, similarity scores) is **completely fine**. The performance problem is purely algorithmic:

1. **Brute-force N×M loops** instead of GSTIN-grouped comparisons
2. **Redundant function calls** inside hot loops (hundreds of millions of wasted calls)
3. **Missing database indexes** causing slow data fetching
4. **No pre-computation** of normalized/cleaned values
