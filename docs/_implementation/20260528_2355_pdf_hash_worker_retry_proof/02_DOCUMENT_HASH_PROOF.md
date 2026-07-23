# Document Hash Proof

## Methodology
1. Generate documents (`LAB_REPORT` and `RECEIPT`) via the LIMS workflow.
2. Fetch document metadata from the API to retrieve the stored `pdfHash`.
3. Download the raw PDF bytes from the storage layer via the API.
4. Compute the SHA256 hash of the downloaded file locally.
5. Compare the results.

## Verification Results

### LAB_REPORT
- **Document ID:** `0099d8f8-a9a3-4a25-8c24-6db565d5eb4d`
- **Stored pdfHash:** `f2d371b1367a38a2390e586db2a771eb5e008807f4ef01a5f7f9ebd6ebf5922a`
- **Computed SHA256:** `f2d371b1367a38a2390e586db2a771eb5e008807f4ef01a5f7f9ebd6ebf5922a`
- **Result:** **MATCH ✅**

### RECEIPT
- **Document ID:** `6e3ae2df-5aee-43ba-943b-6405e2ff9cc9`
- **Stored pdfHash:** `8a5d5229c1377f1cc561bfea3881193bbfb3410eefc8e5c72799e28fd7dbc53e`
- **Computed SHA256:** `8a5d5229c1377f1cc561bfea3881193bbfb3410eefc8e5c72799e28fd7dbc53e`
- **Result:** **MATCH ✅**

## Evidence Files
- Metadata: `runtime-responses/documents/lab_report_metadata.json`
- Metadata: `runtime-responses/documents/receipt_metadata.json`
- Raw PDF: `documents/lab_report_0099d8f8-a9a3-4a25-8c24-6db565d5eb4d.pdf`
- Raw PDF: `documents/receipt_6e3ae2df-5aee-43ba-943b-6405e2ff9cc9.pdf`
- Hash Output: `documents/lab_report_sha256.txt`
- Hash Output: `documents/receipt_sha256.txt`
