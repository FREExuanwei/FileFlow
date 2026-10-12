# Supported route and resource limits

MiB=1,048,576 bytes. Admission is also bounded by decoded pixels, page/structure complexity, runtime/output budgets and available resources.

| Route | Web / Desktop | Additional bounds |
|---|---|---|
| Ordinary PDF text | 40 / 100MiB | 500 pages, extractable text layer required |
| Ordinary image | 20 / 100MiB | Existing source/output pixel and side bounds |
| Desktop OCR scan/Hybrid PDF | unavailable / 100MiB | 100 physical pages,50 OCR pages; sequential |
| Desktop OCR image | unavailable / 100MiB | 24MP input,6MP raster,4096 side |
| PDF tools | 40MiB per file,60MiB combined | 500 total pages,50 outputs,64MiB combined output,60s operation |
| TXT/DOCX/MD/HTML/ordinary data | 10MiB | Route-specific text/structure caps |
| AI Ready PDF | 40MiB | Estimated tokens only; cleaning/chunk algorithms frozen |
| XLSX | 4MiB | 32MiB expanded,250k cells,20k rows,256 columns; cached formulas, not evaluation |
| CSV/TSV/new data routes | 10MiB | 100k rows,1000 columns,1m cells,32MiB output |
| Structured JSON/YAML | 2MiB | Depth/node/alias guards |
| Hash / Inspector | 32 / 40MiB | Hash is not streaming |

Phase5 new operations retain reduced input admission on narrow <=700px views. Shared:50 tasks,200MiB retained source,128MiB retained results,256MiB app-accounted transient, total2 / heavy1 concurrent conversions.

256MiB is not the WebView2/Windows process tree ceiling; local large OCR observations exceeded1GiB. Near100MiB fictional desktop inputs were tested;150MiB rejection is documented locally and200MiB is not enabled. Smaller-memory machines, more hardware and hour-level endurance are unverified.

PDF tools are static page processing, not preservation of forms/annotations/bookmarks/attachments/signatures. OCR characters may be wrong, and failed/capped pages create marked partial results. These limits are not promises that every hostile or unusually complex file below the size cap succeeds.
