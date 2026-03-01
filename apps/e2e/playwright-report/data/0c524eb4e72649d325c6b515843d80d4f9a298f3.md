# Page snapshot

```yaml
- generic [active] [ref=e1]:
  - generic [ref=e2]:
    - generic [ref=e3]:
      - link "← Encounter" [ref=e4] [cursor=pointer]:
        - /url: /lims/encounters/c2810f62-e0c4-4af7-85f9-63d1ec833a7e
      - generic [ref=e5]: /
      - generic [ref=e6]: Report Status
    - generic [ref=e7]:
      - generic [ref=e8]:
        - paragraph [ref=e9]: Patient
        - paragraph [ref=e10]: Workflow Patient
        - paragraph [ref=e11]: "MRN: WF-MM6SMIP7"
      - generic [ref=e12]:
        - paragraph [ref=e13]: Encounter
        - paragraph [ref=e14]: c2810f62…
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
        - generic [ref=e28]: 4c1104a3…
      - button "Publish report" [ref=e30] [cursor=pointer]
  - region "Notifications alt+T"
  - alert [ref=e31]
```