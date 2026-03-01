# Page snapshot

```yaml
- generic [active] [ref=e1]:
  - generic [ref=e2]:
    - generic [ref=e3]:
      - link "← Encounter" [ref=e4] [cursor=pointer]:
        - /url: /lims/encounters/6e753977-0d19-411f-b8b8-660e42e25ab9
      - generic [ref=e5]: /
      - generic [ref=e6]: Report Status
    - generic [ref=e7]:
      - generic [ref=e8]:
        - paragraph [ref=e9]: Patient
        - paragraph [ref=e10]: Doc Patient
        - paragraph [ref=e11]: "MRN: DOC-MM6SLWN1"
      - generic [ref=e12]:
        - paragraph [ref=e13]: Encounter
        - paragraph [ref=e14]: 6e753977…
      - generic [ref=e15]:
        - paragraph [ref=e16]: Status
        - generic [ref=e17]: Verified
      - generic [ref=e18]:
        - paragraph [ref=e19]: Created
        - paragraph [ref=e20]: 3/1/2026
    - generic [ref=e21]:
      - heading "Lab Report" [level=3] [ref=e22]
      - paragraph [ref=e23]: Verify generates the report; publish is a separate command step.
      - generic [ref=e24]:
        - generic [ref=e25]: "Status:"
        - generic [ref=e26]: Ready
        - generic [ref=e27]: ⏳ Generating PDF...
        - generic [ref=e28]: 65fc9963…
      - button "Publish report" [ref=e30] [cursor=pointer]
  - region "Notifications alt+T"
  - alert [ref=e31]
```