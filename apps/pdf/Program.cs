using System.Security.Cryptography;
using System.Text.Json;
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
        pdfBytes = GenerateLabReport(payload, req.BrandingConfig);
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
                    c.Item().Text($"Printed: {DateTime.UtcNow:yyyy-MM-dd HH:mm} UTC").FontSize(7).FontColor(Colors.Grey.Darken1);
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
