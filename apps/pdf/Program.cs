using System.Security.Cryptography;
using System.Text.Json;
using System.Linq;
using QuestPDF.Fluent;
using QuestPDF.Helpers;
using QuestPDF.Infrastructure;

// QuestPDF Community license
QuestPDF.Settings.License = LicenseType.Community;

var builder = WebApplication.CreateBuilder(args);
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen();

var app = builder.Build();

if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI();
}

app.MapGet("/health/pdf", () => Results.Ok(new { status = "ok", version = "1.0.0", services = new { pdf = "ok" } }))
   .WithName("GetPdfHealth").WithTags("Health");

app.MapPost("/render", async (HttpContext context) =>
{
    using var reader = new StreamReader(context.Request.Body);
    var body = await reader.ReadToEndAsync();

    RenderRequest? req = null;
    try { req = JsonSerializer.Deserialize<RenderRequest>(body, new JsonSerializerOptions { PropertyNameCaseInsensitive = true }); }
    catch { }

    byte[] pdfBytes;
    if (req?.PayloadJson is JsonElement payload)
    {
        var templateKey = (req.TemplateKey ?? string.Empty).Trim().ToLowerInvariant();
        pdfBytes = templateKey switch
        {
            "lab_report_v1" => GenerateLabReport(payload, req.BrandingConfig),
            "receipt_v1" => GenerateReceipt(payload, req.BrandingConfig),
            "opd_invoice_receipt_v1" => GenerateOpdInvoiceReceipt(payload, req.BrandingConfig),
            _ => GeneratePlaceholderPdf(body),
        };
    }
    else
    {
        pdfBytes = GeneratePlaceholderPdf(body);
    }

    var hash = Convert.ToHexString(SHA256.HashData(pdfBytes)).ToLower();
    context.Response.Headers["X-Pdf-Hash"] = hash;
    context.Response.ContentType = "application/pdf";
    await context.Response.Body.WriteAsync(pdfBytes);
})
.WithName("RenderPdf").WithTags("Render");

app.Run();

static byte[] GenerateLabReport(JsonElement payload, BrandingConfig? branding)
{
    var report = new LabReportDocument(payload, branding ?? new BrandingConfig());
    return report.GeneratePdf();
}

static byte[] GenerateReceipt(JsonElement payload, BrandingConfig? branding)
{
    var receipt = new ReceiptDocument(payload, branding ?? new BrandingConfig());
    return receipt.GeneratePdf();
}

static byte[] GenerateOpdInvoiceReceipt(JsonElement payload, BrandingConfig? branding)
{
    var doc = new OpdInvoiceReceiptDocument(payload, branding ?? new BrandingConfig());
    return doc.GeneratePdf();
}

static byte[] GeneratePlaceholderPdf(string jsonBody)
{
    var placeholder = "%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n"
        + "2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj\n"
        + "3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 612 792]>>endobj\n"
        + "xref\n0 4\n0000000000 65535 f\n"
        + "trailer<</Size 4/Root 1 0 R>>\nstartxref\n%%EOF";
    return System.Text.Encoding.ASCII.GetBytes(placeholder);
}

// ─── Request Models ──────────────────────────────────────────────────────────

record RenderRequest(
    string? TemplateKey,
    JsonElement? PayloadJson,
    BrandingConfig? BrandingConfig
);

record BrandingConfig
{
    public string? BrandName { get; init; }
    public string? LogoUrl { get; init; }
    public string? ReportHeader { get; init; }
    public string? ReportFooter { get; init; }
    public string? HeaderText { get; init; }
    public string? FooterText { get; init; }
}

// ─── QuestPDF Document ───────────────────────────────────────────────────────

class LabReportDocument : IDocument
{
    private readonly JsonElement _payload;
    private readonly BrandingConfig _branding;

    public LabReportDocument(JsonElement payload, BrandingConfig branding)
    {
        _payload = payload;
        _branding = branding;
    }

    public DocumentMetadata GetMetadata() => DocumentMetadata.Default;

    public void Compose(IDocumentContainer container)
    {
        container.Page(page =>
        {
            page.Size(PageSizes.A4);
            page.Margin(1.5f, Unit.Centimetre);
            page.DefaultTextStyle(x => x.FontSize(9).FontFamily(Fonts.Arial));

            page.Header().Element(ComposeHeader);
            page.Content().Element(ComposeContent);
            page.Footer().Element(ComposeFooter);
        });
    }

    void ComposeHeader(IContainer container)
    {
        var headerText = _branding.HeaderText ?? _branding.BrandName ?? "Laboratory Report";
        container.BorderBottom(1).BorderColor(Colors.Grey.Darken2).PaddingBottom(8).Column(col =>
        {
            col.Item().Row(row =>
            {
                row.RelativeItem().Column(c =>
                {
                    c.Item().Text(headerText).Bold().FontSize(16).FontColor(Colors.Blue.Darken3);
                    if (!string.IsNullOrEmpty(_branding.ReportHeader))
                        c.Item().Text(_branding.ReportHeader).FontSize(8).FontColor(Colors.Grey.Darken1);
                });
                row.ConstantItem(160).AlignRight().Column(c =>
                {
                    c.Item().Text("LABORATORY REPORT").Bold().FontSize(12).FontColor(Colors.Grey.Darken3);
                    var issuedAt = _payload.TryGetProperty("issuedAt", out var ia) ? ia.GetString() : null;
                    c.Item().Text($"Issued: {issuedAt ?? "—"}").FontSize(7).FontColor(Colors.Grey.Darken1);
                });
            });
        });
    }

    void ComposeContent(IContainer container)
    {
        container.Column(col =>
        {
            col.Spacing(8);
            col.Item().Element(ComposePatientInfo);
            col.Item().LineHorizontal(0.5f).LineColor(Colors.Grey.Lighten1);
            col.Item().Element(ComposeResults);
        });
    }

    void ComposePatientInfo(IContainer container)
    {
        string Get(string key, string fallback = "—") =>
            _payload.TryGetProperty(key, out var v) ? v.GetString() ?? fallback : fallback;

        container.Table(table =>
        {
            table.ColumnsDefinition(c => { c.RelativeColumn(); c.RelativeColumn(); c.RelativeColumn(); c.RelativeColumn(); });

            table.Cell().Element(LabelCell).Text("Patient Name");
            table.Cell().Element(ValueCell).Text(Get("patientName"));
            table.Cell().Element(LabelCell).Text("MRN");
            table.Cell().Element(ValueCell).Text(Get("patientMrn"));

            table.Cell().Element(LabelCell).Text("Date of Birth");
            table.Cell().Element(ValueCell).Text(Get("patientDob"));
            table.Cell().Element(LabelCell).Text("Gender");
            table.Cell().Element(ValueCell).Text(Get("patientGender"));

            table.Cell().Element(LabelCell).Text("Encounter ID");
            table.Cell().Element(ValueCell).Text(Get("encounterId"));
            table.Cell().Element(LabelCell).Text("Report #");
            table.Cell().Element(ValueCell).Text(Get("reportNumber"));

            table.Cell().Element(LabelCell).Text("Issued At");
            table.Cell().Element(ValueCell).Text(Get("issuedAt"));
            table.Cell().Element(LabelCell).Text("Ordered By");
            table.Cell().Element(ValueCell).Text(Get("orderedBy"));

            if (_payload.TryGetProperty("verifiedBy", out var vb) && vb.GetString() is { } vbStr && !string.IsNullOrEmpty(vbStr))
            {
                table.Cell().Element(LabelCell).Text("Verified By");
                table.Cell().Element(ValueCell).Text(vbStr);
                table.Cell().Element(LabelCell).Text("Verified At");
                table.Cell().Element(ValueCell).Text(
                    _payload.TryGetProperty("verifiedAt", out var va) ? va.GetString() ?? "—" : "—");
            }
        });
    }

    void ComposeResults(IContainer container)
    {
        if (!_payload.TryGetProperty("tests", out var testsEl) || testsEl.ValueKind != JsonValueKind.Array)
        {
            container.Text("No results available.").FontColor(Colors.Grey.Darken1);
            return;
        }

        container.Column(col =>
        {
            foreach (var test in testsEl.EnumerateArray())
            {
                var testName = test.TryGetProperty("testName", out var tn) ? tn.GetString() ?? "Unknown Test" : "Unknown Test";
                var testCode = test.TryGetProperty("testCode", out var tc) ? tc.GetString() ?? "" : "";

                col.Item().Background(Colors.Blue.Lighten4).Padding(4)
                   .Text($"{testName}  ({testCode})").Bold().FontSize(9);

                if (test.TryGetProperty("parameters", out var paramsEl) && paramsEl.ValueKind == JsonValueKind.Array)
                {
                    col.Item().Table(table =>
                    {
                        table.ColumnsDefinition(c =>
                        {
                            c.RelativeColumn(3);
                            c.RelativeColumn(2);
                            c.RelativeColumn(1);
                            c.RelativeColumn(3);
                            c.RelativeColumn(1);
                        });

                        foreach (var h in new[] { "Parameter", "Value", "Unit", "Reference Range", "Flag" })
                            table.Cell().Background(Colors.Grey.Lighten3).Padding(3).Text(h).Bold().FontSize(8);

                        foreach (var param in paramsEl.EnumerateArray())
                        {
                            string P(string k) => param.TryGetProperty(k, out var v2) ? v2.GetString() ?? "—" : "—";
                            var flag = P("flag");
                            var flagColor = flag switch
                            {
                                "high" or "H" => Colors.Red.Medium,
                                "low" or "L" => Colors.Blue.Medium,
                                "critical" => Colors.Red.Darken3,
                                _ => Colors.Black
                            };

                            table.Cell().BorderBottom(0.5f).BorderColor(Colors.Grey.Lighten2).Padding(3).Text(P("parameterName")).FontSize(8);
                            table.Cell().BorderBottom(0.5f).BorderColor(Colors.Grey.Lighten2).Padding(3).Text(P("value")).Bold().FontSize(8);
                            table.Cell().BorderBottom(0.5f).BorderColor(Colors.Grey.Lighten2).Padding(3).Text(P("unit")).FontSize(8);
                            table.Cell().BorderBottom(0.5f).BorderColor(Colors.Grey.Lighten2).Padding(3).Text(P("referenceRange")).FontSize(8);
                            table.Cell().BorderBottom(0.5f).BorderColor(Colors.Grey.Lighten2).Padding(3)
                                 .Text(flag == "—" || flag == "normal" ? "N" : flag.ToUpper())
                                 .FontSize(8).FontColor(flagColor).Bold();
                        }
                    });
                }

                col.Item().Height(6);
            }
        });
    }

    void ComposeFooter(IContainer container)
    {
        var footerText = _branding.FooterText ?? _branding.ReportFooter ?? "This report is generated electronically and is valid without signature.";
        container.BorderTop(0.5f).BorderColor(Colors.Grey.Lighten1).PaddingTop(4).Row(row =>
        {
            row.RelativeItem().Text(footerText).FontSize(7).FontColor(Colors.Grey.Darken1);
            row.ConstantItem(100).AlignRight().Text(text =>
            {
                text.Span("Page ").FontSize(7);
                text.CurrentPageNumber().FontSize(7);
                text.Span(" of ").FontSize(7);
                text.TotalPages().FontSize(7);
            });
        });
    }

    static IContainer LabelCell(IContainer c) =>
        c.BorderBottom(0.5f).BorderColor(Colors.Grey.Lighten2).Padding(3).Background(Colors.Grey.Lighten4);

    static IContainer ValueCell(IContainer c) =>
        c.BorderBottom(0.5f).BorderColor(Colors.Grey.Lighten2).Padding(3);
}

class ReceiptDocument : IDocument
{
    private readonly JsonElement _payload;
    private readonly BrandingConfig _branding;

    public ReceiptDocument(JsonElement payload, BrandingConfig branding)
    {
        _payload = payload;
        _branding = branding;
    }

    public DocumentMetadata GetMetadata() => DocumentMetadata.Default;

    public void Compose(IDocumentContainer container)
    {
        container.Page(page =>
        {
            page.Size(PageSizes.A4);
            page.Margin(1.5f, Unit.Centimetre);
            page.DefaultTextStyle(x => x.FontSize(9).FontFamily(Fonts.Arial));

            page.Header().Element(c => ComposeHeader(c, "PAYMENT RECEIPT", Colors.Green.Darken2));
            page.Content().Element(ComposeContent);
            page.Footer().Element(c => ComposeFooter(c, _branding.FooterText ?? _branding.ReportFooter ?? "Payment receipt"));
        });
    }

    void ComposeHeader(IContainer container, string title, string color)
    {
        var brand = _branding.BrandName ?? "Vexel Health";
        container.BorderBottom(1).BorderColor(Colors.Grey.Lighten1).PaddingBottom(8).Row(row =>
        {
            row.RelativeItem().Column(c =>
            {
                c.Item().Text(brand).Bold().FontSize(15).FontColor(Colors.Blue.Darken3);
                if (!string.IsNullOrWhiteSpace(_branding.ReportHeader))
                    c.Item().Text(_branding.ReportHeader).FontSize(8).FontColor(Colors.Grey.Darken1);
            });
            row.ConstantItem(180).AlignRight().Column(c =>
            {
                c.Item().Text(title).Bold().FontSize(12).FontColor(color);
                c.Item().Text($"Receipt #: {Get("receiptNumber", Get("receiptCode"))}").FontSize(8);
                c.Item().Text($"Issued: {Get("issuedAt", Get("receiptDate"))}").FontSize(8).FontColor(Colors.Grey.Darken1);
            });
        });
    }

    void ComposeContent(IContainer container)
    {
        container.Column(col =>
        {
            col.Spacing(8);
            col.Item().Element(ComposeIdentityBlock);
            col.Item().Element(ComposeAmountSummary);
            col.Item().Element(ComposeLines);
        });
    }

    void ComposeIdentityBlock(IContainer container)
    {
        container.Table(table =>
        {
            table.ColumnsDefinition(c => { c.RelativeColumn(); c.RelativeColumn(); c.RelativeColumn(); c.RelativeColumn(); });

            Cell(table, "Patient", Get("patientName"));
            Cell(table, "MRN", Get("patientMrn"));
            Cell(table, "Encounter", Get("encounterId"));
            Cell(table, "Invoice", Get("invoiceNumber", Get("invoiceCode")));

            Cell(table, "Payment Method", Get("paymentMethod", Get("method")));
            Cell(table, "Collected By", Get("receivedBy", Get("collectedBy")));
            Cell(table, "Reference", Get("referenceNo"));
            Cell(table, "Status", Get("status", Get("paymentStatus")));
        });
    }

    void ComposeAmountSummary(IContainer container)
    {
        container.Border(0.5f).BorderColor(Colors.Grey.Lighten2).Padding(6).Table(table =>
        {
            table.ColumnsDefinition(c => { c.RelativeColumn(3); c.RelativeColumn(); c.RelativeColumn(); c.RelativeColumn(); });

            Header(table, "Subtotal");
            Header(table, "Discount");
            Header(table, "Paid");
            Header(table, "Balance");

            Value(table, Get("subtotalAmount", Get("subtotal", "0.00")));
            Value(table, Get("discountAmount", Get("discount", "0.00")));
            Value(table, Get("paidAmount", Get("amountPaid", Get("amount", "0.00"))));
            Value(table, Get("balanceAmount", Get("balanceDue", "0.00")));
        });
    }

    void ComposeLines(IContainer container)
    {
        if (!_payload.TryGetProperty("lines", out var lines) || lines.ValueKind != JsonValueKind.Array || !lines.EnumerateArray().Any())
        {
            container.Text("No line items in payload.").FontSize(8).FontColor(Colors.Grey.Darken1);
            return;
        }

        container.Table(table =>
        {
            table.ColumnsDefinition(c =>
            {
                c.RelativeColumn(5);
                c.RelativeColumn(1);
                c.RelativeColumn(2);
                c.RelativeColumn(2);
            });

            foreach (var h in new[] { "Description", "Qty", "Unit", "Amount" })
                table.Cell().Background(Colors.Grey.Lighten3).Padding(4).Text(h).Bold().FontSize(8);

            foreach (var line in lines.EnumerateArray())
            {
                table.Cell().BorderBottom(0.5f).BorderColor(Colors.Grey.Lighten2).Padding(4)
                    .Text(Get(line, "description", Get(line, "name"))).FontSize(8);
                table.Cell().BorderBottom(0.5f).BorderColor(Colors.Grey.Lighten2).Padding(4)
                    .AlignRight().Text(Get(line, "quantity", "1")).FontSize(8);
                table.Cell().BorderBottom(0.5f).BorderColor(Colors.Grey.Lighten2).Padding(4)
                    .AlignRight().Text(Get(line, "unitPrice", "0.00")).FontSize(8);
                table.Cell().BorderBottom(0.5f).BorderColor(Colors.Grey.Lighten2).Padding(4)
                    .AlignRight().Text(Get(line, "lineTotal", Get(line, "amount", "0.00"))).FontSize(8).Bold();
            }
        });
    }

    void ComposeFooter(IContainer container, string footerText)
    {
        container.BorderTop(0.5f).BorderColor(Colors.Grey.Lighten1).PaddingTop(4).Row(row =>
        {
            row.RelativeItem().Text(footerText).FontSize(7).FontColor(Colors.Grey.Darken1);
            row.ConstantItem(100).AlignRight().Text(text =>
            {
                text.Span("Page ").FontSize(7);
                text.CurrentPageNumber().FontSize(7);
                text.Span(" of ").FontSize(7);
                text.TotalPages().FontSize(7);
            });
        });
    }

    void Cell(TableDescriptor table, string label, string value)
    {
        table.Cell().Background(Colors.Grey.Lighten4).BorderBottom(0.5f).BorderColor(Colors.Grey.Lighten2).Padding(3).Text(label).FontSize(8);
        table.Cell().BorderBottom(0.5f).BorderColor(Colors.Grey.Lighten2).Padding(3).Text(value).FontSize(8);
    }

    void Header(TableDescriptor table, string label) =>
        table.Cell().Background(Colors.Grey.Lighten4).Padding(4).Text(label).Bold().FontSize(8);

    void Value(TableDescriptor table, string value) =>
        table.Cell().BorderBottom(0.5f).BorderColor(Colors.Grey.Lighten2).Padding(4).AlignRight().Text(value).FontSize(8);

    string Get(string key, string fallback = "—")
    {
        if (_payload.TryGetProperty(key, out var value))
            return ToDisplay(value, fallback);
        return fallback;
    }

    static string Get(JsonElement obj, string key, string fallback = "—")
    {
        if (obj.ValueKind == JsonValueKind.Object && obj.TryGetProperty(key, out var value))
            return ToDisplay(value, fallback);
        return fallback;
    }

    static string ToDisplay(JsonElement value, string fallback = "—") =>
        value.ValueKind switch
        {
            JsonValueKind.String => value.GetString() ?? fallback,
            JsonValueKind.Number => value.ToString(),
            JsonValueKind.True => "true",
            JsonValueKind.False => "false",
            JsonValueKind.Null => fallback,
            JsonValueKind.Undefined => fallback,
            _ => value.ToString()
        };
}

class OpdInvoiceReceiptDocument : IDocument
{
    private readonly JsonElement _payload;
    private readonly BrandingConfig _branding;

    public OpdInvoiceReceiptDocument(JsonElement payload, BrandingConfig branding)
    {
        _payload = payload;
        _branding = branding;
    }

    public DocumentMetadata GetMetadata() => DocumentMetadata.Default;

    public void Compose(IDocumentContainer container)
    {
        container.Page(page =>
        {
            page.Size(PageSizes.A4);
            page.Margin(1.5f, Unit.Centimetre);
            page.DefaultTextStyle(x => x.FontSize(9).FontFamily(Fonts.Arial));

            page.Header().Element(ComposeHeader);
            page.Content().Element(ComposeContent);
            page.Footer().Element(ComposeFooter);
        });
    }

    void ComposeHeader(IContainer container)
    {
        var brand = _branding.BrandName ?? "Vexel Health";
        container.BorderBottom(1).BorderColor(Colors.Grey.Lighten1).PaddingBottom(8).Row(row =>
        {
            row.RelativeItem().Column(c =>
            {
                c.Item().Text(brand).Bold().FontSize(15).FontColor(Colors.Blue.Darken3);
                if (!string.IsNullOrWhiteSpace(_branding.ReportHeader))
                    c.Item().Text(_branding.ReportHeader).FontSize(8).FontColor(Colors.Grey.Darken1);
            });
            row.ConstantItem(220).AlignRight().Column(c =>
            {
                c.Item().Text("OPD INVOICE / RECEIPT").Bold().FontSize(12).FontColor(Colors.Purple.Darken2);
                c.Item().Text($"Invoice: {Get("invoiceCode", Get("invoiceNumber"))}").FontSize(8);
                c.Item().Text($"Receipt: {Get("receiptNumber", Get("receiptCode"))}").FontSize(8);
                c.Item().Text($"Issued: {Get("issuedAt", Get("invoiceDate"))}").FontSize(8).FontColor(Colors.Grey.Darken1);
            });
        });
    }

    void ComposeContent(IContainer container)
    {
        container.Column(col =>
        {
            col.Spacing(8);
            col.Item().Element(ComposeParties);
            col.Item().Element(ComposeVisitAndProvider);
            col.Item().Element(ComposeItems);
            col.Item().Element(ComposeTotals);
        });
    }

    void ComposeParties(IContainer container)
    {
        container.Table(table =>
        {
            table.ColumnsDefinition(c => { c.RelativeColumn(); c.RelativeColumn(); c.RelativeColumn(); c.RelativeColumn(); });

            Cell(table, "Patient", Get("patientName"));
            Cell(table, "MRN", Get("patientMrn"));
            Cell(table, "Phone", Get("patientPhone"));
            Cell(table, "Status", Get("status", Get("paymentStatus")));
        });
    }

    void ComposeVisitAndProvider(IContainer container)
    {
        container.Table(table =>
        {
            table.ColumnsDefinition(c => { c.RelativeColumn(); c.RelativeColumn(); c.RelativeColumn(); c.RelativeColumn(); });

            Cell(table, "Visit ID", Get("opdVisitId", Get("visitId")));
            Cell(table, "Appointment ID", Get("appointmentId"));
            Cell(table, "Provider", Get("providerName", Get("doctorName")));
            Cell(table, "Department", Get("departmentName"));

            Cell(table, "Payment Method", Get("paymentMethod", Get("method")));
            Cell(table, "Reference", Get("referenceNo"));
            Cell(table, "Received By", Get("receivedBy"));
            Cell(table, "Source Ref", Get("sourceRef"));
        });
    }

    void ComposeItems(IContainer container)
    {
        if (!_payload.TryGetProperty("lines", out var lines) || lines.ValueKind != JsonValueKind.Array || !lines.EnumerateArray().Any())
        {
            container.Text("No invoice lines in payload.").FontSize(8).FontColor(Colors.Grey.Darken1);
            return;
        }

        container.Table(table =>
        {
            table.ColumnsDefinition(c =>
            {
                c.RelativeColumn(5);
                c.RelativeColumn(1);
                c.RelativeColumn(2);
                c.RelativeColumn(2);
                c.RelativeColumn(2);
            });

            foreach (var h in new[] { "Description", "Qty", "Unit", "Discount", "Line Total" })
                table.Cell().Background(Colors.Grey.Lighten3).Padding(4).Text(h).Bold().FontSize(8);

            foreach (var line in lines.EnumerateArray())
            {
                table.Cell().BorderBottom(0.5f).BorderColor(Colors.Grey.Lighten2).Padding(4)
                    .Text(Get(line, "description", Get(line, "name"))).FontSize(8);
                table.Cell().BorderBottom(0.5f).BorderColor(Colors.Grey.Lighten2).Padding(4)
                    .AlignRight().Text(Get(line, "quantity", "1")).FontSize(8);
                table.Cell().BorderBottom(0.5f).BorderColor(Colors.Grey.Lighten2).Padding(4)
                    .AlignRight().Text(Get(line, "unitPrice", "0.00")).FontSize(8);
                table.Cell().BorderBottom(0.5f).BorderColor(Colors.Grey.Lighten2).Padding(4)
                    .AlignRight().Text(Get(line, "discountAmount", "0.00")).FontSize(8);
                table.Cell().BorderBottom(0.5f).BorderColor(Colors.Grey.Lighten2).Padding(4)
                    .AlignRight().Text(Get(line, "lineTotal", "0.00")).FontSize(8).Bold();
            }
        });
    }

    void ComposeTotals(IContainer container)
    {
        container.AlignRight().Width(260).Border(0.5f).BorderColor(Colors.Grey.Lighten2).Padding(6).Table(table =>
        {
            table.ColumnsDefinition(c => { c.RelativeColumn(2); c.RelativeColumn(1); });

            SummaryRow(table, "Subtotal", Get("subtotalAmount", Get("subtotal", "0.00")));
            SummaryRow(table, "Discount", Get("discountAmount", Get("discount", "0.00")));
            SummaryRow(table, "Tax", Get("taxAmount", Get("tax", "0.00")));
            SummaryRow(table, "Total", Get("totalAmount", Get("total", "0.00")), true);
            SummaryRow(table, "Paid", Get("paidAmount", Get("amountPaid", "0.00")));
            SummaryRow(table, "Balance", Get("balanceAmount", Get("balanceDue", "0.00")));
        });
    }

    void ComposeFooter(IContainer container)
    {
        var footerText = _branding.FooterText ?? _branding.ReportFooter ?? "OPD billing document";
        container.BorderTop(0.5f).BorderColor(Colors.Grey.Lighten1).PaddingTop(4).Row(row =>
        {
            row.RelativeItem().Text(footerText).FontSize(7).FontColor(Colors.Grey.Darken1);
            row.ConstantItem(100).AlignRight().Text(text =>
            {
                text.Span("Page ").FontSize(7);
                text.CurrentPageNumber().FontSize(7);
                text.Span(" of ").FontSize(7);
                text.TotalPages().FontSize(7);
            });
        });
    }

    void SummaryRow(TableDescriptor table, string label, string value, bool emphasize = false)
    {
        table.Cell().BorderBottom(0.5f).BorderColor(Colors.Grey.Lighten2).Padding(3).Text(label).FontSize(8);
        var cell = table.Cell().BorderBottom(0.5f).BorderColor(Colors.Grey.Lighten2).Padding(3).AlignRight();
        if (emphasize) cell.Text(value).Bold().FontSize(8);
        else cell.Text(value).FontSize(8);
    }

    void Cell(TableDescriptor table, string label, string value)
    {
        table.Cell().Background(Colors.Grey.Lighten4).BorderBottom(0.5f).BorderColor(Colors.Grey.Lighten2).Padding(3).Text(label).FontSize(8);
        table.Cell().BorderBottom(0.5f).BorderColor(Colors.Grey.Lighten2).Padding(3).Text(value).FontSize(8);
    }

    string Get(string key, string fallback = "—")
    {
        if (_payload.TryGetProperty(key, out var value))
            return ToDisplay(value, fallback);
        return fallback;
    }

    static string Get(JsonElement obj, string key, string fallback = "—")
    {
        if (obj.ValueKind == JsonValueKind.Object && obj.TryGetProperty(key, out var value))
            return ToDisplay(value, fallback);
        return fallback;
    }

    static string ToDisplay(JsonElement value, string fallback = "—") =>
        value.ValueKind switch
        {
            JsonValueKind.String => value.GetString() ?? fallback,
            JsonValueKind.Number => value.ToString(),
            JsonValueKind.True => "true",
            JsonValueKind.False => "false",
            JsonValueKind.Null => fallback,
            JsonValueKind.Undefined => fallback,
            _ => value.ToString()
        };
}
