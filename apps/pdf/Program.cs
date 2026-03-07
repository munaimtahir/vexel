using System.Security.Cryptography;
using System.Text.Json;
using System.Linq;
using QuestPDF.Fluent;
using QuestPDF.Helpers;
using QuestPDF.Infrastructure;
using ZXing;
using ZXing.Common;
using SkiaSharp;

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
        var logoBytes        = await FetchImageBytesAsync(req?.BrandingConfig?.LogoUrl);
        var footerImageBytes = await FetchImageBytesAsync(req?.BrandingConfig?.ReportFooterImageUrl);
        var templateKey = (req?.TemplateKey ?? string.Empty).Trim().ToLowerInvariant();
        pdfBytes = templateKey switch
        {
            "lab_report_v1"          => GenerateLabReport(payload, req?.BrandingConfig, logoBytes, footerImageBytes),
            "lab_report_v2"          => GenerateLabReportV2(payload, req?.BrandingConfig, logoBytes, footerImageBytes),
            "receipt_v1"             => GenerateReceipt(payload, req?.BrandingConfig, logoBytes),
            "opd_invoice_receipt_v1" => GenerateOpdInvoiceReceipt(payload, req?.BrandingConfig),
            "graphical_scale_report_v1" => GenerateGraphicalScaleReport(payload, req?.BrandingConfig, req?.ConfigJson, logoBytes),
            _                        => GeneratePlaceholderPdf(body),
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

// ─── Static Route Helpers ─────────────────────────────────────────────────────

static byte[] GenerateLabReport(JsonElement payload, BrandingConfig? branding, byte[]? logoBytes, byte[]? footerImageBytes)
{
    var report = new LabReportDocument(payload, branding ?? new BrandingConfig(), logoBytes, footerImageBytes);
    return report.GeneratePdf();
}

static byte[] GenerateLabReportV2(JsonElement payload, BrandingConfig? branding, byte[]? logoBytes, byte[]? footerImageBytes)
{
    var report = new LabReportDocumentV2(payload, branding ?? new BrandingConfig(), logoBytes, footerImageBytes);
    return report.GeneratePdf();
}

static byte[] GenerateReceipt(JsonElement payload, BrandingConfig? branding, byte[]? logoBytes)
{
    var receipt = new ReceiptDocument(payload, branding ?? new BrandingConfig(), logoBytes);
    return receipt.GeneratePdf();
}

static byte[] GenerateOpdInvoiceReceipt(JsonElement payload, BrandingConfig? branding)
{
    var doc = new OpdInvoiceReceiptDocument(payload, branding ?? new BrandingConfig());
    return doc.GeneratePdf();
}

static byte[] GenerateGraphicalScaleReport(JsonElement payload, BrandingConfig? branding, JsonElement? configJson, byte[]? logoBytes)
{
    var doc = new GraphicalScaleReportDocument(payload, branding ?? new BrandingConfig(), configJson, logoBytes);
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

static async Task<byte[]?> FetchImageBytesAsync(string? url)
{
    if (string.IsNullOrWhiteSpace(url)) return null;
    try
    {
        using var client = new HttpClient { Timeout = TimeSpan.FromSeconds(5) };
        return await client.GetByteArrayAsync(url);
    }
    catch { return null; }
}

// ─── Request Models ──────────────────────────────────────────────────────────

record RenderRequest(
    string?       TemplateKey,
    JsonElement?  PayloadJson,
    BrandingConfig? BrandingConfig,
    JsonElement?  ConfigJson
);

record BrandingConfig
{
    public string? BrandName              { get; init; }
    public string? LogoUrl                { get; init; }
    public string? ReportHeader           { get; init; }  // address / contact line for header
    public string? ReportFooter           { get; init; }  // footer text
    public string? HeaderText             { get; init; }
    public string? FooterText             { get; init; }
    public string? ReportHeaderLayout     { get; init; }  // default | classic | minimal  (lab report)
    public string? ReceiptHeaderLayout    { get; init; }  // default | classic | minimal  (receipt)
    public string? ReceiptLayout          { get; init; }  // a4 | thermal
    public string? ReportFooterImageUrl   { get; init; }  // URL to footer image
    public string? ReportFooterLayout     { get; init; }  // text | image | both  (lab report)
    public string? ReceiptFooterLayout    { get; init; }  // text | image | both  (receipt)
}

// ─── Shared Document Helpers ──────────────────────────────────────────────────

static class DocHelpers
{
    public static byte[]? GenerateBarcodePng(string content, int width = 280, int height = 55)
    {
        try
        {
            var writer = new BarcodeWriterGeneric
            {
                Format  = BarcodeFormat.CODE_128,
                Options = new EncodingOptions { Width = width, Height = height, Margin = 3, PureBarcode = true }
            };
            var matrix = writer.Encode(content);
            int w = matrix.Width, h = matrix.Height;
            var bmp = new SKBitmap(w, h, SKColorType.Rgba8888, SKAlphaType.Opaque);
            for (int y = 0; y < h; y++)
                for (int x = 0; x < w; x++)
                    bmp.SetPixel(x, y, matrix[x, y] ? SKColors.Black : SKColors.White);
            using var image = SKImage.FromBitmap(bmp);
            using var data  = image.Encode(SKEncodedImageFormat.Png, 100);
            return data.ToArray();
        }
        catch { return null; }
    }

    public static string FormatDate(string? iso, bool dateOnly = false)
    {
        if (string.IsNullOrWhiteSpace(iso) || iso == "\u2014") return "\u2014";
        if (DateTime.TryParse(iso, null, System.Globalization.DateTimeStyles.RoundtripKind, out var dt))
            return dateOnly ? dt.ToString("dd-MMM-yyyy") : dt.ToString("dd-MMM-yyyy HH:mm");
        return iso;
    }

    public static string Pkr(string v) =>
        decimal.TryParse(v, out var d) ? $"PKR {d:F2}"
        : (string.IsNullOrWhiteSpace(v) || v == "\u2014" ? "\u2014" : v);

    public static string ToDisplay(JsonElement value, string fallback = "\u2014") =>
        value.ValueKind switch
        {
            JsonValueKind.String    => value.GetString() ?? fallback,
            JsonValueKind.Number    => value.ToString(),
            JsonValueKind.True      => "true",
            JsonValueKind.False     => "false",
            JsonValueKind.Null      => fallback,
            JsonValueKind.Undefined => fallback,
            _                       => value.ToString()
        };
}

// ─── LabReportDocument ───────────────────────────────────────────────────────

class LabReportDocument : IDocument
{
    private readonly JsonElement    _payload;
    private readonly BrandingConfig _branding;
    private readonly byte[]?        _logoBytes;
    private readonly byte[]?        _footerImageBytes;

    public LabReportDocument(JsonElement payload, BrandingConfig branding, byte[]? logoBytes, byte[]? footerImageBytes)
    {
        _payload          = payload;
        _branding         = branding;
        _logoBytes        = logoBytes;
        _footerImageBytes = footerImageBytes;
    }

    public DocumentMetadata GetMetadata() => DocumentMetadata.Default;

    string Get(string key, string fallback = "")
    {
        if (_payload.TryGetProperty(key, out var v)) return DocHelpers.ToDisplay(v, fallback);
        return fallback;
    }

    static string GetFrom(JsonElement obj, string key, string fallback = "")
    {
        if (obj.ValueKind == JsonValueKind.Object && obj.TryGetProperty(key, out var v))
            return DocHelpers.ToDisplay(v, fallback);
        return fallback;
    }

    string GetPatientDemo(string key, string fallback = "")
    {
        if (_payload.TryGetProperty("patientDemographics", out var pd) &&
            pd.ValueKind == JsonValueKind.Object &&
            pd.TryGetProperty(key, out var value))
        {
            return DocHelpers.ToDisplay(value, fallback);
        }
        return fallback;
    }

    public void Compose(IDocumentContainer container)
    {
        container.Page(page =>
        {
            page.Size(PageSizes.A4);
            page.Margin(1.5f, Unit.Centimetre);
            page.DefaultTextStyle(x => x.FontSize(9).FontFamily(Fonts.Arial));

            page.Header().Element(c => ComposeReportHeader(c, _logoBytes));
            page.Content().Element(ComposeReportContent);
            page.Footer().Element(c => ComposeReportFooter(c, _footerImageBytes));
        });
    }

    void ComposeReportHeader(IContainer container, byte[]? logoBytes)
    {
        var layout = (_payload.TryGetProperty("reportHeaderLayout", out var rl) ? rl.GetString() : null)
                     ?? _branding.ReportHeaderLayout ?? "default";

        var brandName    = _branding.BrandName ?? "Laboratory";
        var address      = _branding.ReportHeader ?? "";
        var encounterCode = Get("encounterCode");
        var reportNumber  = Get("reportNumber");
        var reportStatus  = Get("reportStatus", "Provisional");
        var isVerified    = reportStatus.Equals("Verified", StringComparison.OrdinalIgnoreCase);

        byte[]? barcodeBytes = null;
        if (!string.IsNullOrWhiteSpace(encounterCode))
            barcodeBytes = DocHelpers.GenerateBarcodePng(encounterCode);

        container.Column(col =>
        {
            col.Item().Row(row =>
            {
                // Left: logo area (all layouts except "minimal")
                if (layout != "minimal")
                {
                    row.ConstantItem(50, Unit.Millimetre).Element(area =>
                    {
                        if (logoBytes != null)
                            area.MaxHeight(40).Image(logoBytes).FitHeight();
                    });
                }

                // Center: lab name (+ address for "classic" layout)
                row.RelativeItem().AlignCenter().Column(nameCol =>
                {
                    nameCol.Item().AlignCenter().Text(brandName).Bold().FontSize(16).FontColor(Colors.Blue.Darken3);
                    if (layout == "classic" && !string.IsNullOrWhiteSpace(address))
                        nameCol.Item().AlignCenter().Text(address).FontSize(8).FontColor(Colors.Grey.Darken1);
                });

                // Right: barcode + order code + report number + status badge
                row.ConstantItem(70, Unit.Millimetre).Column(rightCol =>
                {
                    if (barcodeBytes != null)
                        rightCol.Item().Height(25).AlignRight().Image(barcodeBytes).FitHeight();
                    if (encounterCode != "\u2014")
                        rightCol.Item().AlignRight()
                            .Text($"Lab Order: {encounterCode}").FontSize(7).FontColor(Colors.Grey.Darken1);
                    rightCol.Item().AlignRight()
                        .Text($"Report #: {reportNumber}").FontSize(7).FontColor(Colors.Grey.Darken1);
                    rightCol.Item().AlignRight().Element(badge =>
                    {
                        if (isVerified)
                            badge.Background(Colors.Green.Lighten3).Padding(3)
                                 .Text("\u2713 VERIFIED").Bold().FontSize(7).FontColor(Colors.Green.Darken3);
                        else
                            badge.Background(Colors.Orange.Lighten3).Padding(3)
                                 .Text("PROVISIONAL").Bold().FontSize(7).FontColor(Colors.Orange.Darken2);
                    });
                });
            });

            // Address line below row for "default" and "minimal"
            if ((layout == "default" || layout == "minimal") && !string.IsNullOrWhiteSpace(address))
                col.Item().PaddingTop(3).AlignCenter().Text(address).FontSize(7).FontColor(Colors.Grey.Darken1);

            col.Item().PaddingTop(4).LineHorizontal(1).LineColor(Colors.Grey.Darken2);
        });
    }

    void ComposeReportContent(IContainer container)
    {
        container.Column(col =>
        {
            col.Spacing(6);

            col.Item().Element(ComposePatientInfoBlock);
            col.Item().LineHorizontal(1).LineColor(Colors.Grey.Lighten1);

            if (_payload.TryGetProperty("tests", out var testsEl) && testsEl.ValueKind == JsonValueKind.Array)
            {
                bool isFirst = true;
                foreach (var test in testsEl.EnumerateArray())
                {
                    var printAlone = test.TryGetProperty("printAlone", out var pa) &&
                                     (pa.ValueKind == JsonValueKind.True ||
                                      (pa.ValueKind == JsonValueKind.String && pa.GetString() == "true"));
                    if (!isFirst && printAlone)
                        col.Item().PageBreak();
                    col.Item().Element(c => ComposeTestSection(c, test));
                    isFirst = false;
                }
            }
            else
            {
                col.Item().Text("No results available.").FontColor(Colors.Grey.Darken1);
            }

            var verifiedBy = Get("verifiedBy", "");
            if (!string.IsNullOrWhiteSpace(verifiedBy) && verifiedBy != "\u2014")
                col.Item().Element(ComposeVerificationBlock);
        });
    }

    void ComposePatientInfoBlock(IContainer container)
    {
        var reportStatus = Get("reportStatus", "Provisional");
        var isVerified   = reportStatus.Equals("Verified", StringComparison.OrdinalIgnoreCase);

        container.Background(Colors.Grey.Lighten5).Padding(4).Table(table =>
        {
            table.ColumnsDefinition(c =>
            {
                c.ConstantColumn(80);
                c.RelativeColumn();
                c.ConstantColumn(80);
                c.RelativeColumn();
            });

            PiRow(table, "MRN",
                         Get("patientMrn"),
                         "Lab Order ID",
                         Get("encounterCode"));
            PiRow(table, "Patient Name",
                         Get("patientName"),
                         "Sample Received",
                         DocHelpers.FormatDate(Get("sampleReceivedAt")));
            PiRow(table, "Age / Gender",
                         $"{Get("patientAge")} / {Get("patientGender")}",
                         "Print Date/Time",
                         DocHelpers.FormatDate(Get("printedAt", Get("issuedAt"))));

            // Row 4: Referring Physician | Report Status (colored)
            table.Cell().Background(Colors.Grey.Lighten4).BorderBottom(0.5f)
                 .BorderColor(Colors.Grey.Lighten2).Padding(3)
                 .Text("Referring Physician").Bold().FontSize(8);
            table.Cell().BorderBottom(0.5f).BorderColor(Colors.Grey.Lighten2)
                 .Padding(3).Text(Get("orderedBy", "\u2014")).FontSize(8);
            table.Cell().Background(Colors.Grey.Lighten4).BorderBottom(0.5f)
                 .BorderColor(Colors.Grey.Lighten2).Padding(3)
                 .Text("Report Status").Bold().FontSize(8);
            table.Cell().BorderBottom(0.5f).BorderColor(Colors.Grey.Lighten2).Padding(3)
                 .Text(t => t.Span(reportStatus).Bold()
                             .FontColor(isVerified ? Colors.Green.Darken2 : Colors.Orange.Darken2));
        });
    }

    void PiRow(TableDescriptor table, string l1, string v1, string l2, string v2)
    {
        table.Cell().Background(Colors.Grey.Lighten4).BorderBottom(0.5f)
             .BorderColor(Colors.Grey.Lighten2).Padding(3).Text(l1).Bold().FontSize(8);
        table.Cell().BorderBottom(0.5f).BorderColor(Colors.Grey.Lighten2)
             .Padding(3).Text(v1).FontSize(8);
        table.Cell().Background(Colors.Grey.Lighten4).BorderBottom(0.5f)
             .BorderColor(Colors.Grey.Lighten2).Padding(3).Text(l2).Bold().FontSize(8);
        table.Cell().BorderBottom(0.5f).BorderColor(Colors.Grey.Lighten2)
             .Padding(3).Text(v2).FontSize(8);
    }

    void ComposeTestSection(IContainer container, JsonElement test)
    {
        var testName   = GetFrom(test, "testName",   GetFrom(test, "name",     "Unknown Test"));
        var testCode   = GetFrom(test, "testCode",   "");
        var department = GetFrom(test, "department", "");
        var codeLabel  = testCode != "\u2014" && !string.IsNullOrWhiteSpace(testCode)
                         ? $"  ({testCode})" : "";

        container.Column(col =>
        {
            // Test name header row
            col.Item().Background(Colors.Blue.Lighten4).Padding(4).Row(hRow =>
            {
                hRow.RelativeItem().Text(testName + codeLabel).Bold().FontSize(10);
                if (department != "\u2014" && !string.IsNullOrWhiteSpace(department))
                    hRow.ConstantItem(100).AlignRight()
                        .Text(department).FontSize(8).FontColor(Colors.Grey.Darken2);
            });

            if (test.TryGetProperty("parameters", out var paramsEl) && paramsEl.ValueKind == JsonValueKind.Array)
            {
                col.Item().Table(table =>
                {
                    table.ColumnsDefinition(c =>
                    {
                        c.RelativeColumn(3);
                        c.RelativeColumn(1.5f);
                        c.RelativeColumn(1);
                        c.RelativeColumn(2);
                        c.ConstantColumn(40);
                    });

                    foreach (var h in new[] { "Parameter", "Value", "Unit", "Reference Range", "Flag" })
                        table.Cell().Background(Colors.Grey.Lighten3).Padding(3).Text(h).Bold().FontSize(8);

                    int rowIdx = 0;
                    foreach (var param in paramsEl.EnumerateArray())
                    {
                        var pName    = GetFrom(param, "parameterName", GetFrom(param, "name", "\u2014"));
                        var pValue   = GetFrom(param, "value",         "\u2014");
                        var pUnit    = GetFrom(param, "unit",          "");
                        var pRange   = GetFrom(param, "referenceRange", GetFrom(param, "refRange", "\u2014"));
                        var pFlag    = GetFrom(param, "flag",          "");
                        var flagUpper = pFlag.ToUpperInvariant();
                        bool isHigh  = flagUpper is "H" or "HIGH";
                        bool isLow   = flagUpper is "L" or "LOW";
                        bool isCrit  = flagUpper is "CRITICAL";
                        var  rowBg   = rowIdx % 2 == 0 ? Colors.White : Colors.Grey.Lighten5;
                        rowIdx++;

                        // Parameter name
                        table.Cell().Background(rowBg).BorderBottom(0.5f).BorderColor(Colors.Grey.Lighten2)
                             .Padding(3).Text(pName).FontSize(8);

                        // Value (colored if flagged)
                        var valCell = table.Cell().Background(rowBg).BorderBottom(0.5f)
                                          .BorderColor(Colors.Grey.Lighten2).Padding(3);
                        if (isHigh || isCrit)
                            valCell.Text(pValue).Bold().FontSize(8).FontColor(Colors.Red.Medium);
                        else if (isLow)
                            valCell.Text(pValue).Bold().FontSize(8).FontColor(Colors.Blue.Medium);
                        else
                            valCell.Text(pValue).FontSize(8);

                        // Unit
                        table.Cell().Background(rowBg).BorderBottom(0.5f).BorderColor(Colors.Grey.Lighten2)
                             .Padding(3).Text(pUnit == "\u2014" ? "" : pUnit).FontSize(8).FontColor(Colors.Grey.Darken1);

                        // Reference range
                        table.Cell().Background(rowBg).BorderBottom(0.5f).BorderColor(Colors.Grey.Lighten2)
                             .Padding(3).Text(pRange).FontSize(8);

                        // Flag
                        var flagCell = table.Cell().Background(rowBg).BorderBottom(0.5f)
                                           .BorderColor(Colors.Grey.Lighten2).Padding(3);
                        if (isCrit)
                            flagCell.Text("CRITICAL").Bold().FontSize(7).FontColor(Colors.Red.Darken3);
                        else if (isHigh)
                            flagCell.Text("HIGH").Bold().FontSize(7).FontColor(Colors.Red.Medium);
                        else if (isLow)
                            flagCell.Text("LOW").Bold().FontSize(7).FontColor(Colors.Blue.Medium);
                        else
                            flagCell.Text("Normal").FontSize(7).FontColor(Colors.Grey.Darken1);
                    }
                });
            }

            col.Item().Height(4);
        });
    }

    void ComposeVerificationBlock(IContainer container)
    {
        var verifiedBy = Get("verifiedBy");
        var verifiedAt = DocHelpers.FormatDate(Get("verifiedAt"));

        container.AlignRight().Width(200).Border(0.5f).BorderColor(Colors.Grey.Lighten2).Padding(6).Column(col =>
        {
            col.Item().Row(row =>
            {
                row.ConstantItem(70).Text("Verified by:").FontSize(8).FontColor(Colors.Grey.Darken1);
                row.RelativeItem().Text(verifiedBy).Bold().FontSize(8);
            });
            col.Item().Row(row =>
            {
                row.ConstantItem(70).Text("Date:").FontSize(8).FontColor(Colors.Grey.Darken1);
                row.RelativeItem().Text(verifiedAt).FontSize(8);
            });
        });
    }

    void ComposeReportFooter(IContainer container, byte[]? footerImageBytes)
    {
        var footerText = _branding.FooterText ?? _branding.ReportFooter
                         ?? "This report is generated electronically and is valid without signature.";
        var layout = _branding.ReportFooterLayout ?? (footerImageBytes != null ? "image" : "text");
        container.BorderTop(0.5f).BorderColor(Colors.Grey.Lighten1).PaddingTop(4).Row(row =>
        {
            row.RelativeItem().Element(left =>
            {
                if (layout == "both" && footerImageBytes != null)
                {
                    left.Column(c => {
                        c.Item().Height(20).Image(footerImageBytes).FitHeight();
                        c.Item().Text(footerText).FontSize(7).FontColor(Colors.Grey.Darken1);
                    });
                }
                else if ((layout == "image" || layout == "both") && footerImageBytes != null)
                    left.Height(20).Image(footerImageBytes).FitHeight();
                else
                    left.Text(footerText).FontSize(7).FontColor(Colors.Grey.Darken1);
            });
            row.ConstantItem(100).AlignRight().Text(text =>
            {
                text.Span("Page ").FontSize(7);
                text.CurrentPageNumber().FontSize(7);
                text.Span(" of ").FontSize(7);
                text.TotalPages().FontSize(7);
            });
        });
    }
}

// ─── LabReportDocumentV2 ─────────────────────────────────────────────────────
// v2 layout: single-parameter tests render as a single labelled line (no heading);
// multi-parameter tests render with a blue test heading + parameter table.
// Arrays are rendered in the order received (pre-sorted by the API payload builder).

class LabReportDocumentV2 : IDocument
{
    private readonly JsonElement    _payload;
    private readonly BrandingConfig _branding;
    private readonly byte[]?        _logoBytes;
    private readonly byte[]?        _footerImageBytes;

    public LabReportDocumentV2(JsonElement payload, BrandingConfig branding, byte[]? logoBytes, byte[]? footerImageBytes)
    {
        _payload          = payload;
        _branding         = branding;
        _logoBytes        = logoBytes;
        _footerImageBytes = footerImageBytes;
    }

    public DocumentMetadata GetMetadata() => DocumentMetadata.Default;

    string Get(string key, string fallback = "")
    {
        if (_payload.TryGetProperty(key, out var v)) return DocHelpers.ToDisplay(v, fallback);
        return fallback;
    }

    static string GetFrom(JsonElement obj, string key, string fallback = "")
    {
        if (obj.ValueKind == JsonValueKind.Object && obj.TryGetProperty(key, out var v))
            return DocHelpers.ToDisplay(v, fallback);
        return fallback;
    }

    string GetPatientDemo(string key, string fallback = "")
    {
        if (_payload.TryGetProperty("patientDemographics", out var pd) &&
            pd.ValueKind == JsonValueKind.Object &&
            pd.TryGetProperty(key, out var value))
        {
            return DocHelpers.ToDisplay(value, fallback);
        }
        return fallback;
    }

    public void Compose(IDocumentContainer container)
    {
        container.Page(page =>
        {
            page.Size(PageSizes.A4);
            page.Margin(1.5f, Unit.Centimetre);
            page.DefaultTextStyle(x => x.FontSize(9).FontFamily(Fonts.Arial));

            page.Header().Element(c => ComposeReportHeader(c, _logoBytes));
            page.Content().Element(ComposeReportContent);
            page.Footer().Element(c => ComposeReportFooter(c, _footerImageBytes));
        });
    }

    // ── Header (identical to v1) ─────────────────────────────────────────────

    void ComposeReportHeader(IContainer container, byte[]? logoBytes)
    {
        var layout        = (_payload.TryGetProperty("reportHeaderLayout", out var rl) ? rl.GetString() : null)
                            ?? _branding.ReportHeaderLayout ?? "default";
        var brandName     = _branding.BrandName ?? "Laboratory";
        var address       = _branding.ReportHeader ?? "";
        var encounterCode = Get("encounterCode");
        var reportNumber  = Get("reportNumber");
        var reportStatus  = Get("reportStatus", "Provisional");
        var isVerified    = reportStatus.Equals("Verified", StringComparison.OrdinalIgnoreCase);

        byte[]? barcodeBytes = null;
        if (!string.IsNullOrWhiteSpace(encounterCode))
            barcodeBytes = DocHelpers.GenerateBarcodePng(encounterCode);

        container.Column(col =>
        {
            col.Item().Row(row =>
            {
                if (layout != "minimal")
                {
                    row.ConstantItem(50, Unit.Millimetre).Element(area =>
                    {
                        if (logoBytes != null)
                            area.MaxHeight(40).Image(logoBytes).FitHeight();
                    });
                }

                row.RelativeItem().AlignCenter().Column(nameCol =>
                {
                    nameCol.Item().AlignCenter().Text(brandName).Bold().FontSize(16).FontColor(Colors.Blue.Darken3);
                    if (layout == "classic" && !string.IsNullOrWhiteSpace(address))
                        nameCol.Item().AlignCenter().Text(address).FontSize(8).FontColor(Colors.Grey.Darken1);
                });

                row.ConstantItem(70, Unit.Millimetre).Column(rightCol =>
                {
                    if (barcodeBytes != null)
                        rightCol.Item().Height(25).AlignRight().Image(barcodeBytes).FitHeight();
                    if (encounterCode != "\u2014")
                        rightCol.Item().AlignRight()
                            .Text($"Lab Order: {encounterCode}").FontSize(7).FontColor(Colors.Grey.Darken1);
                    rightCol.Item().AlignRight()
                        .Text($"Report #: {reportNumber}").FontSize(7).FontColor(Colors.Grey.Darken1);
                    rightCol.Item().AlignRight().Element(badge =>
                    {
                        if (isVerified)
                            badge.Background(Colors.Green.Lighten3).Padding(3)
                                 .Text("\u2713 VERIFIED").Bold().FontSize(7).FontColor(Colors.Green.Darken3);
                        else
                            badge.Background(Colors.Orange.Lighten3).Padding(3)
                                 .Text("PROVISIONAL").Bold().FontSize(7).FontColor(Colors.Orange.Darken2);
                    });
                });
            });

            if ((layout == "default" || layout == "minimal") && !string.IsNullOrWhiteSpace(address))
                col.Item().PaddingTop(3).AlignCenter().Text(address).FontSize(7).FontColor(Colors.Grey.Darken1);

            col.Item().PaddingTop(4).LineHorizontal(1).LineColor(Colors.Grey.Darken2);
        });
    }

    // ── Patient info block (identical to v1) ─────────────────────────────────

    void ComposePatientInfoBlock(IContainer container)
    {
        var reportStatus = Get("reportStatus", "Provisional");
        var isVerified   = reportStatus.Equals("Verified", StringComparison.OrdinalIgnoreCase);

        container.Background(Colors.Grey.Lighten5).Padding(4).Table(table =>
        {
            table.ColumnsDefinition(c =>
            {
                c.ConstantColumn(80);
                c.RelativeColumn();
                c.ConstantColumn(80);
                c.RelativeColumn();
            });

            PiRow(table, "MRN",            Get("patientMrn"),                     "Lab Order ID",    Get("encounterCode"));
            PiRow(table, "Patient Name",   Get("patientName"),                    "Sample Received", DocHelpers.FormatDate(Get("sampleReceivedAt")));
            PiRow(table, "Age / Gender",   $"{Get("patientAge")} / {Get("patientGender")}", "Issued Date",  DocHelpers.FormatDate(Get("issuedAt")));

            table.Cell().Background(Colors.Grey.Lighten4).BorderBottom(0.5f)
                 .BorderColor(Colors.Grey.Lighten2).Padding(3)
                 .Text("Referring Physician").Bold().FontSize(8);
            table.Cell().BorderBottom(0.5f).BorderColor(Colors.Grey.Lighten2)
                 .Padding(3).Text(Get("orderedBy", "\u2014")).FontSize(8);
            table.Cell().Background(Colors.Grey.Lighten4).BorderBottom(0.5f)
                 .BorderColor(Colors.Grey.Lighten2).Padding(3)
                 .Text("Report Status").Bold().FontSize(8);
            table.Cell().BorderBottom(0.5f).BorderColor(Colors.Grey.Lighten2).Padding(3)
                 .Text(t => t.Span(reportStatus).Bold()
                             .FontColor(isVerified ? Colors.Green.Darken2 : Colors.Orange.Darken2));
        });
    }

    void PiRow(TableDescriptor table, string l1, string v1, string l2, string v2)
    {
        table.Cell().Background(Colors.Grey.Lighten4).BorderBottom(0.5f)
             .BorderColor(Colors.Grey.Lighten2).Padding(3).Text(l1).Bold().FontSize(8);
        table.Cell().BorderBottom(0.5f).BorderColor(Colors.Grey.Lighten2)
             .Padding(3).Text(v1).FontSize(8);
        table.Cell().Background(Colors.Grey.Lighten4).BorderBottom(0.5f)
             .BorderColor(Colors.Grey.Lighten2).Padding(3).Text(l2).Bold().FontSize(8);
        table.Cell().BorderBottom(0.5f).BorderColor(Colors.Grey.Lighten2)
             .Padding(3).Text(v2).FontSize(8);
    }

    // ── Content ──────────────────────────────────────────────────────────────

    void ComposeReportContent(IContainer container)
    {
        container.Column(col =>
        {
            col.Spacing(4);

            col.Item().Element(ComposePatientInfoBlock);
            col.Item().LineHorizontal(1).LineColor(Colors.Grey.Lighten1);

            if (_payload.TryGetProperty("tests", out var testsEl) && testsEl.ValueKind == JsonValueKind.Array)
            {
                var testList = testsEl.EnumerateArray().ToList();
                bool isFirst = true;
                foreach (var test in testList)
                {
                    var printAlone = test.TryGetProperty("printAlone", out var pa) &&
                                     (pa.ValueKind == JsonValueKind.True ||
                                      (pa.ValueKind == JsonValueKind.String && pa.GetString() == "true"));
                    if (!isFirst && printAlone)
                        col.Item().PageBreak();
                    col.Item().Element(c => ComposeTestSectionV2(c, test));
                    isFirst = false;
                }
            }
            else
            {
                col.Item().Text("No results available.").FontColor(Colors.Grey.Darken1);
            }

            var verifiedBy = Get("verifiedBy", "");
            if (!string.IsNullOrWhiteSpace(verifiedBy) && verifiedBy != "\u2014")
                col.Item().PaddingTop(4).Element(ComposeVerificationBlock);
        });
    }

    // ── V2 test section: single vs multi parameter ────────────────────────────

    void ComposeTestSectionV2(IContainer container, JsonElement test)
    {
        var testName   = GetFrom(test, "testName",   GetFrom(test, "name",     "Unknown Test"));
        var testCode   = GetFrom(test, "testCode",   "");
        var department = GetFrom(test, "department", "");

        if (!test.TryGetProperty("parameters", out var paramsEl) || paramsEl.ValueKind != JsonValueKind.Array)
        {
            // No parameters: show test name as a placeholder line
            container.Column(col =>
            {
                col.Item().Row(row =>
                {
                    row.RelativeItem().Text(testName).Bold().FontSize(9);
                    row.ConstantItem(60).AlignRight().Text("No results").FontSize(8).FontColor(Colors.Grey.Darken1);
                });
                col.Item().LineHorizontal(0.3f).LineColor(Colors.Grey.Lighten2);
            });
            return;
        }

        var paramsList = paramsEl.EnumerateArray().ToList();

        // Zero parameters: empty array — show placeholder per spec
        if (paramsList.Count == 0)
        {
            container.Column(col =>
            {
                col.Item().Row(row =>
                {
                    row.RelativeItem().Text(testName + ":").Bold().FontSize(9).FontColor(Colors.Grey.Darken3);
                    row.ConstantItem(70).AlignRight().Text("No results").FontSize(8).FontColor(Colors.Grey.Darken1);
                });
                col.Item().LineHorizontal(0.3f).LineColor(Colors.Grey.Lighten2);
            });
            return;
        }

        var isSingle = paramsList.Count == 1;

        container.Column(col =>
        {
            if (isSingle)
            {
                // ── Single-parameter: one labelled line, no test heading ──────
                var param    = paramsList[0];
                var pName    = GetFrom(param, "parameterName", testName);
                var pValue   = GetFrom(param, "value",         "\u2014");
                var pUnit    = GetFrom(param, "unit",          "");
                var pRange   = GetFrom(param, "referenceRange", "");
                var pFlag    = GetFrom(param, "flag",          "");
                var flagU    = pFlag.ToUpperInvariant();
                bool isHigh  = flagU is "H" or "HIGH";
                bool isLow   = flagU is "L" or "LOW";
                bool isCrit  = flagU is "CRITICAL";

                col.Item().PaddingVertical(2).Row(row =>
                {
                    // Parameter name
                    row.ConstantItem(145).Text(pName + ":").Bold().FontSize(9).FontColor(Colors.Grey.Darken3);

                    // Value (colored when flagged)
                    var valItem = row.ConstantItem(65);
                    if (isCrit)
                        valItem.Text(pValue).Bold().FontSize(9).FontColor(Colors.Red.Darken2);
                    else if (isHigh)
                        valItem.Text(pValue + " \u2191").Bold().FontSize(9).FontColor(Colors.Red.Medium);
                    else if (isLow)
                        valItem.Text(pValue + " \u2193").Bold().FontSize(9).FontColor(Colors.Blue.Medium);
                    else
                        valItem.Text(pValue).Bold().FontSize(9);

                    // Unit
                    var unitStr = (pUnit == "\u2014" || string.IsNullOrWhiteSpace(pUnit)) ? "" : pUnit;
                    row.ConstantItem(45).Text(unitStr).FontSize(8).FontColor(Colors.Grey.Darken1);

                    // Reference range
                    var rangeStr = (pRange == "\u2014" || string.IsNullOrWhiteSpace(pRange))
                        ? "" : $"Ref: {pRange}";
                    row.RelativeItem().Text(rangeStr).FontSize(8).FontColor(Colors.Grey.Medium);

                    // Flag badge (critical only; H/L already encoded in value arrows)
                    if (isCrit)
                        row.ConstantItem(48).AlignRight()
                           .Background(Colors.Red.Lighten4).Padding(2)
                           .Text("CRITICAL").Bold().FontSize(7).FontColor(Colors.Red.Darken3);
                    else
                        row.ConstantItem(48);
                });
                col.Item().LineHorizontal(0.3f).LineColor(Colors.Grey.Lighten2);
            }
            else
            {
                // ── Multi-parameter: centered blue heading + table ────────────
                var codeLabel = (testCode != "\u2014" && !string.IsNullOrWhiteSpace(testCode))
                                ? $"  ({testCode})" : "";

                col.Item().Background(Colors.Blue.Lighten4).Padding(4).Row(hRow =>
                {
                    hRow.RelativeItem().Text(testName + codeLabel).Bold().FontSize(10);
                    if (department != "\u2014" && !string.IsNullOrWhiteSpace(department))
                        hRow.ConstantItem(100).AlignRight()
                            .Text(department).FontSize(8).FontColor(Colors.Grey.Darken2);
                });

                col.Item().Table(table =>
                {
                    table.ColumnsDefinition(c =>
                    {
                        c.RelativeColumn(3);    // parameter name
                        c.RelativeColumn(1.5f); // result
                        c.RelativeColumn(1);    // unit
                        c.RelativeColumn(2);    // reference range
                        c.ConstantColumn(32);   // flag
                    });

                    // Header row
                    foreach (var h in new[] { "Parameter", "Result", "Unit", "Reference Range", "" })
                        table.Cell().Background(Colors.Grey.Lighten3).Padding(3).Text(h).Bold().FontSize(8);

                    int rowIdx = 0;
                    foreach (var param in paramsEl.EnumerateArray())
                    {
                        var pName  = GetFrom(param, "parameterName", GetFrom(param, "name", "\u2014"));
                        var pValue = GetFrom(param, "value",          "\u2014");
                        var pUnit  = GetFrom(param, "unit",           "");
                        var pRange = GetFrom(param, "referenceRange", GetFrom(param, "refRange", "\u2014"));
                        var pFlag  = GetFrom(param, "flag",           "");
                        var flagU  = pFlag.ToUpperInvariant();
                        bool isHigh = flagU is "H" or "HIGH";
                        bool isLow  = flagU is "L" or "LOW";
                        bool isCrit = flagU is "CRITICAL";
                        var rowBg   = rowIdx % 2 == 0 ? Colors.White : Colors.Grey.Lighten5;
                        rowIdx++;

                        // Parameter name
                        table.Cell().Background(rowBg).BorderBottom(0.5f).BorderColor(Colors.Grey.Lighten2)
                             .Padding(3).Text(pName).FontSize(8);

                        // Result (colored if flagged)
                        var valCell = table.Cell().Background(rowBg).BorderBottom(0.5f)
                                          .BorderColor(Colors.Grey.Lighten2).Padding(3);
                        if (isCrit)
                            valCell.Text(pValue).Bold().FontSize(8).FontColor(Colors.Red.Darken2);
                        else if (isHigh)
                            valCell.Text(pValue + " \u2191").Bold().FontSize(8).FontColor(Colors.Red.Medium);
                        else if (isLow)
                            valCell.Text(pValue + " \u2193").Bold().FontSize(8).FontColor(Colors.Blue.Medium);
                        else
                            valCell.Text(pValue).FontSize(8);

                        // Unit
                        table.Cell().Background(rowBg).BorderBottom(0.5f).BorderColor(Colors.Grey.Lighten2)
                             .Padding(3).Text(pUnit == "\u2014" ? "" : pUnit).FontSize(8).FontColor(Colors.Grey.Darken1);

                        // Reference range
                        table.Cell().Background(rowBg).BorderBottom(0.5f).BorderColor(Colors.Grey.Lighten2)
                             .Padding(3).Text(pRange).FontSize(8);

                        // Flag badge
                        var flagCell = table.Cell().Background(rowBg).BorderBottom(0.5f)
                                           .BorderColor(Colors.Grey.Lighten2).Padding(3);
                        if (isCrit)
                            flagCell.Text("CRIT").Bold().FontSize(7).FontColor(Colors.Red.Darken3);
                        else if (isHigh)
                            flagCell.AlignCenter().Text("H \u2191").Bold().FontSize(7).FontColor(Colors.Red.Medium);
                        else if (isLow)
                            flagCell.AlignCenter().Text("L \u2193").Bold().FontSize(7).FontColor(Colors.Blue.Medium);
                        else
                            flagCell.Text("").FontSize(7);
                    }
                });

                col.Item().Height(4);
            }
        });
    }

    // ── Verification block (identical to v1) ─────────────────────────────────

    void ComposeVerificationBlock(IContainer container)
    {
        var verifiedBy = Get("verifiedBy");
        var verifiedAt = DocHelpers.FormatDate(Get("verifiedAt"));

        container.AlignRight().Width(200).Border(0.5f).BorderColor(Colors.Grey.Lighten2).Padding(6).Column(col =>
        {
            col.Item().Row(row =>
            {
                row.ConstantItem(70).Text("Verified by:").FontSize(8).FontColor(Colors.Grey.Darken1);
                row.RelativeItem().Text(verifiedBy).Bold().FontSize(8);
            });
            col.Item().Row(row =>
            {
                row.ConstantItem(70).Text("Date:").FontSize(8).FontColor(Colors.Grey.Darken1);
                row.RelativeItem().Text(verifiedAt).FontSize(8);
            });
        });
    }

    // ── Footer (identical to v1) ──────────────────────────────────────────────

    void ComposeReportFooter(IContainer container, byte[]? footerImageBytes)
    {
        var footerText = _branding.FooterText ?? _branding.ReportFooter
                         ?? "This report is generated electronically and is valid without signature.";
        var layout = _branding.ReportFooterLayout ?? (footerImageBytes != null ? "image" : "text");
        container.BorderTop(0.5f).BorderColor(Colors.Grey.Lighten1).PaddingTop(4).Row(row =>
        {
            row.RelativeItem().Element(left =>
            {
                if (layout == "both" && footerImageBytes != null)
                {
                    left.Column(c => {
                        c.Item().Height(20).Image(footerImageBytes).FitHeight();
                        c.Item().Text(footerText).FontSize(7).FontColor(Colors.Grey.Darken1);
                    });
                }
                else if ((layout == "image" || layout == "both") && footerImageBytes != null)
                    left.Height(20).Image(footerImageBytes).FitHeight();
                else
                    left.Text(footerText).FontSize(7).FontColor(Colors.Grey.Darken1);
            });
            row.ConstantItem(100).AlignRight().Text(text =>
            {
                text.Span("Page ").FontSize(7);
                text.CurrentPageNumber().FontSize(7);
                text.Span(" of ").FontSize(7);
                text.TotalPages().FontSize(7);
            });
        });
    }
}

// ─── ReceiptDocument ──────────────────────────────────────────────────────────

class ReceiptDocument : IDocument
{
    private readonly JsonElement    _payload;
    private readonly BrandingConfig _branding;
    private readonly byte[]?        _logoBytes;

    // Adaptive font sizing for the items table
    const float NormalItemFontPt = 8f;  // preferred size
    const float MinItemFontPt    = 6f;  // minimum readable size

    public ReceiptDocument(JsonElement payload, BrandingConfig branding, byte[]? logoBytes)
    {
        _payload   = payload;
        _branding  = branding;
        _logoBytes = logoBytes;
    }

    public DocumentMetadata GetMetadata() => DocumentMetadata.Default;

    string Get(string key, string fallback = "")
    {
        if (_payload.TryGetProperty(key, out var v)) return DocHelpers.ToDisplay(v, fallback);
        return fallback;
    }

    static string GetFrom(JsonElement obj, string key, string fallback = "")
    {
        if (obj.ValueKind == JsonValueKind.Object && obj.TryGetProperty(key, out var v))
            return DocHelpers.ToDisplay(v, fallback);
        return fallback;
    }

    string GetPatientDemo(string key, string fallback = "")
    {
        if (_payload.TryGetProperty("patientDemographics", out var pd) &&
            pd.ValueKind == JsonValueKind.Object &&
            pd.TryGetProperty(key, out var value))
        {
            return DocHelpers.ToDisplay(value, fallback);
        }
        return fallback;
    }

    public void Compose(IDocumentContainer container)
    {
        var orderCode = Get("labOrderCode", Get("encounterCode"));
        byte[]? barcodeBytes = null;
        if (!string.IsNullOrWhiteSpace(orderCode))
            barcodeBytes = DocHelpers.GenerateBarcodePng(orderCode);

        var isThermal = string.Equals(_branding.ReceiptLayout ?? "a4", "thermal", StringComparison.OrdinalIgnoreCase);

        if (isThermal)
        {
            // 80mm thermal roll — 80mm wide, auto-height
            container.Page(page =>
            {
                page.Size(80, 200, Unit.Millimetre); // width=80mm, height generous (auto-extends)
                page.Margin(3f, Unit.Millimetre);
                page.DefaultTextStyle(x => x.FontSize(7).FontFamily(Fonts.Arial));
                page.Content().Element(c => ComposeThermalReceipt(c, barcodeBytes, orderCode));
            });
        }
        else
        {
            // ── Determine how many items fit per A4 half ─────────────────────────────
            var allItems  = GetItemsList();
            bool hasLogo  = HasLogoInHeader();
            bool hasBarcode = barcodeBytes != null;

            var (itemsPage1, fontSizePage1) = FitItemsForA4Half(allItems.Count, hasLogo, hasBarcode);
            var page1Items    = allItems.Take(itemsPage1).ToList();
            var overflowItems = allItems.Skip(itemsPage1).ToList();
            bool hasOverflow  = overflowItems.Count > 0;

            // ── Page 1 — standard two-half A4 receipt ────────────────────────────────
            container.Page(page =>
            {
                page.Size(PageSizes.A4);
                // Vertical margins: 6 mm × 2 = 12 mm → content height ≈ 285 mm
                // Layout: 48 % patient copy (137 mm) + 4 % tear strip (11 mm) + 48 % office copy (137 mm)
                page.MarginVertical(0.6f, Unit.Centimetre);
                page.MarginHorizontal(0.8f, Unit.Centimetre);
                page.DefaultTextStyle(x => x.FontSize(8).FontFamily(Fonts.Arial));

                page.Content().Column(col =>
                {
                    col.Spacing(0);
                    col.Item().Height(137, Unit.Millimetre).Element(c =>
                        ComposeReceiptHalf(c, "PATIENT COPY", barcodeBytes, orderCode,
                            page1Items, fontSizePage1, showTotals: !hasOverflow, hasOverflow));
                    col.Item().Height(11, Unit.Millimetre).Element(ComposeCutLine);
                    col.Item().Height(137, Unit.Millimetre).Element(c =>
                        ComposeReceiptHalf(c, "OFFICE COPY", barcodeBytes, orderCode,
                            page1Items, fontSizePage1, showTotals: !hasOverflow, hasOverflow));
                });
            });

            // ── Overflow pages — continuation with remaining items ────────────────────
            if (hasOverflow)
            {
                int startIdx = itemsPage1;
                int pageNum  = 2;
                while (startIdx < allItems.Count)
                {
                    // Estimate capacity for this overflow half (hasBarcode:false = conservative,
                    // barcode only appears on the last page; safety factor covers the difference)
                    var (ovFontSize, ovCount) = FitItemsForOverflowPage(
                        allItems.Count - startIdx, hasLogo, hasBarcode: false);
                    var pageItems = allItems.Skip(startIdx).Take(ovCount).ToList();
                    startIdx += ovCount;
                    bool isLastPage = startIdx >= allItems.Count;
                    // Capture loop variable explicitly — C# closures capture by reference,
                    // so we must copy pageNum before it is incremented below.
                    int  capturedPage = pageNum;
                    container.Page(page =>
                    {
                        page.Size(PageSizes.A4);
                        page.MarginVertical(0.6f, Unit.Centimetre);
                        page.MarginHorizontal(0.8f, Unit.Centimetre);
                        page.DefaultTextStyle(x => x.FontSize(8).FontFamily(Fonts.Arial));
                        page.Content().Element(c =>
                            ComposeOverflowPage(c, capturedPage, barcodeBytes, orderCode,
                                pageItems, ovFontSize, isLastPage));
                    });
                    pageNum++;
                }
            }
        }
    }

    // ── Item-fitting helpers ──────────────────────────────────────────────────────

    // Determines whether the active header layout shows a logo image.
    bool HasLogoInHeader() =>
        _logoBytes != null &&
        !string.Equals(_branding.ReceiptHeaderLayout ?? "", "minimal",
            StringComparison.OrdinalIgnoreCase);

    // Extract items array from the payload.
    List<JsonElement> GetItemsList()
    {
        if (_payload.TryGetProperty("items", out var el) && el.ValueKind == JsonValueKind.Array)
            return el.EnumerateArray().ToList();
        return new List<JsonElement>();
    }

    // Conversion: 1 typographic point = 1/72 inch = 25.4/72 ≈ 0.3528 mm  →  1 mm ≈ 2.835 pt.
    const float PtPerMm = 2.835f;

    // Estimated height (mm) of a single data row at the given font size.
    // Cell padding in QuestPDF: Padding(3) = 3 pt each side = 6 pt total; plus the font cap height.
    static float ItemRowHeightMm(float fontPt) => (fontPt + 6f) / PtPerMm;

    // Safety margin applied to the available items area to account for
    // font-metric variance between our estimates and QuestPDF's actual render.
    const float FitSafetyFactor = 0.85f;

    // Estimate how many items fit in one A4 receipt half (137 mm tall).
    // Heights derived from layout analysis of ComposeReceiptHalf.
    static int MaxItemsInHalf(bool hasLogo, bool hasBarcode, float fontPt)
    {
        float headerMm = hasLogo ? 29f : 9f;   // logo row (28 mm) or text-only brand block
        float fixedMm  = 6.5f                  // border (0.7pt×2) + 3mm padding top & bottom
                       + 4f                    // copy label (8pt + 3pt bottom)
                       + headerMm              // brand / logo header
                       + 2.5f                  // divider (PaddingVertical 3pt each side + line)
                       + 5f                    // "PAYMENT RECEIPT" title (9pt + 4pt bottom)
                       + 14f                   // patient info (3 rows × ~4.5mm + bottom pad)
                       + (hasBarcode ? 14f : 0f) // barcode (30pt image + label + line + pad)
                       + 4.5f                  // footer line + text
                       + 27f;                  // totals table (5 rows) + payment section
        float available  = 137f - fixedMm;
        if (available <= 0) return 0;
        float tableHdrMm = ItemRowHeightMm(8f);    // table header row is always 8 pt
        float dataRowMm  = ItemRowHeightMm(fontPt);
        float usable     = (available - tableHdrMm) * FitSafetyFactor;
        return Math.Max(0, (int)(usable / dataRowMm));
    }

    // Choose the largest font size that fits all items in one A4 half.
    // Returns (how many items fit on page 1, chosen font size).
    // Edge case: if even 1 item cannot fit (extreme logo/header overhead), we still return
    // (1, MinItemFontPt) so the receipt is always renderable; QuestPDF will clip at the border.
    (int itemsOnPage1, float fontSize) FitItemsForA4Half(int totalItems, bool hasLogo, bool hasBarcode)
    {
        for (float fs = NormalItemFontPt; fs >= MinItemFontPt; fs -= 1f)
        {
            int cap = MaxItemsInHalf(hasLogo, hasBarcode, fs);
            if (totalItems <= cap)
                return (totalItems, fs);  // all items fit at this font size
        }
        // Still can't fit all → use minimum size, overflow the rest
        int maxAtMin = MaxItemsInHalf(hasLogo, hasBarcode, MinItemFontPt);
        return (Math.Max(1, maxAtMin), MinItemFontPt);
    }

    // Estimate max items on a continuation overflow page half (137 mm tall, same as page 1).
    // Overflow pages use the same two-half A4 layout as page 1 — each half is 137 mm,
    // so capacity is identical to a regular receipt half.  We pass hasBarcode=false because
    // the barcode appears only on the last continuation half; the safety factor covers that last page.
    static int MaxItemsOnOverflowPage(bool hasLogo, bool hasBarcode, float fontPt)
        => MaxItemsInHalf(hasLogo, hasBarcode, fontPt);

    // Choose font size + item count for a continuation overflow page half.
    (float fontSize, int itemCount) FitItemsForOverflowPage(int remaining, bool hasLogo, bool hasBarcode)
    {
        for (float fs = NormalItemFontPt; fs >= MinItemFontPt; fs -= 1f)
        {
            int cap = MaxItemsOnOverflowPage(hasLogo, hasBarcode, fs);
            if (remaining <= cap) return (fs, remaining);
        }
        return (MinItemFontPt, MaxItemsOnOverflowPage(hasLogo, hasBarcode, MinItemFontPt));
    }

    void ComposeThermalReceipt(IContainer container, byte[]? barcodeBytes, string orderCode)
    {
        var brandName    = _branding.BrandName ?? "Vexel Health";
        var address      = _branding.ReportHeader ?? "";
        var footerText   = _branding.ReportFooter
                           ?? (_branding.BrandName is { } bn ? $"Thank you for choosing {bn}" : "Thank you for choosing us");
        var headerLayout = _branding.ReceiptHeaderLayout ?? _branding.ReportHeaderLayout ?? "default";

        container.Column(col =>
        {
            // ── Header ──────────────────────────────────────────
            col.Item().PaddingBottom(3).Element(hdr =>
            {
                if (_logoBytes != null && headerLayout != "minimal")
                {
                    hdr.Column(hc =>
                    {
                        hc.Item().AlignCenter().Height(24).Image(_logoBytes).FitHeight();
                        hc.Item().AlignCenter().Text(brandName).Bold().FontSize(9);
                        if (!string.IsNullOrWhiteSpace(address))
                            hc.Item().AlignCenter().Text(address).FontSize(6).FontColor(Colors.Grey.Darken1);
                    });
                }
                else
                {
                    hdr.Column(hc =>
                    {
                        hc.Item().AlignCenter().Text(brandName).Bold().FontSize(9);
                        if (!string.IsNullOrWhiteSpace(address))
                            hc.Item().AlignCenter().Text(address).FontSize(6).FontColor(Colors.Grey.Darken1);
                    });
                }
            });

            col.Item().LineHorizontal(0.5f).LineColor(Colors.Grey.Lighten1);
            col.Item().PaddingVertical(2).AlignCenter().Text("PAYMENT RECEIPT").Bold().FontSize(8);
            col.Item().LineHorizontal(0.5f).LineColor(Colors.Grey.Lighten1);
            col.Item().PaddingBottom(4);

            // ── Patient Info ─────────────────────────────────────
            var displayName = GetPatientDemo("displayName", Get("patientName"));
            var ageDisplay = GetPatientDemo("ageDisplay", Get("patientAge"));
            var gender = GetPatientDemo("gender", Get("patientGender"));
            var mrn = GetPatientDemo("mrn", Get("patientMrn"));
            col.Item().PaddingBottom(1).Text(t =>
            {
                t.Span($"MRN: ").Bold().FontSize(7);
                t.Span(string.IsNullOrWhiteSpace(mrn) ? "N/A" : mrn).FontSize(7);
            });
            col.Item().PaddingBottom(1).Text(t =>
            {
                t.Span("Patient: ").Bold().FontSize(7);
                t.Span(string.IsNullOrWhiteSpace(displayName) ? "N/A" : displayName).FontSize(7);
            });
            col.Item().PaddingBottom(1).Text(t =>
            {
                t.Span("Order ID: ").Bold().FontSize(7);
                t.Span(string.IsNullOrWhiteSpace(orderCode) ? "N/A" : orderCode).FontSize(7);
            });
            col.Item().PaddingBottom(1).Text(t =>
            {
                t.Span("Age/Gender: ").Bold().FontSize(7);
                var ageGender = string.IsNullOrWhiteSpace(ageDisplay)
                    ? (string.IsNullOrWhiteSpace(gender) ? "N/A" : gender)
                    : (string.IsNullOrWhiteSpace(gender) ? ageDisplay : $"{ageDisplay} / {gender}");
                t.Span(ageGender).FontSize(7);
            });
            col.Item().PaddingBottom(4).Text(t =>
            {
                t.Span("Date: ").Bold().FontSize(7);
                t.Span(DocHelpers.FormatDate(Get("issuedAt"))).FontSize(7);
            });

            // ── Items ────────────────────────────────────────────
            col.Item().LineHorizontal(0.5f).LineColor(Colors.Grey.Lighten1);
            col.Item().PaddingBottom(2).Row(r =>
            {
                r.RelativeItem().Text("Test").Bold().FontSize(7);
                r.ConstantItem(36).AlignRight().Text("Price").Bold().FontSize(7);
            });
            col.Item().LineHorizontal(0.5f).LineColor(Colors.Grey.Lighten1);

            if (_payload.TryGetProperty("items", out var itemsEl) && itemsEl.ValueKind == JsonValueKind.Array)
            {
                foreach (var item in itemsEl.EnumerateArray())
                {
                    var desc  = GetFrom(item, "description", GetFrom(item, "testName", GetFrom(item, "name", "\u2014")));
                    var price = GetFrom(item, "unitPrice", GetFrom(item, "price", "0"));
                    col.Item().PaddingVertical(1).Row(r =>
                    {
                        r.RelativeItem().Text(desc).FontSize(7);
                        r.ConstantItem(36).AlignRight().Text(DocHelpers.Pkr(price)).FontSize(7);
                    });
                }
            }

            col.Item().LineHorizontal(0.5f).LineColor(Colors.Grey.Lighten1);
            col.Item().PaddingBottom(2);

            // ── Totals ────────────────────────────────────────────
            var subtotal   = Get("subtotalAmount",  Get("subtotal",    "0"));
            var discount   = Get("discountAmount",  Get("discount",    "0"));
            var grandTotal = Get("grandTotal",      Get("totalAmount", Get("payableAmount", "0")));
            var paid       = Get("paidAmount",      Get("amountPaid",  "0"));
            var due        = Get("balanceAmount",   Get("dueAmount",   Get("balanceDue",    "0")));

            col.Item().PaddingBottom(1).Row(r =>
            {
                r.RelativeItem().Text("Subtotal:").FontSize(7);
                r.ConstantItem(36).AlignRight().Text(DocHelpers.Pkr(subtotal)).FontSize(7);
            });
            if (decimal.TryParse(discount, out var discValT) && discValT > 0)
            {
                col.Item().PaddingBottom(1).Row(r =>
                {
                    r.RelativeItem().Text("Discount:").FontSize(7).FontColor(Colors.Green.Darken2);
                    r.ConstantItem(36).AlignRight().Text(DocHelpers.Pkr(discount)).FontSize(7).FontColor(Colors.Green.Darken2);
                });
            }
            col.Item().LineHorizontal(0.5f).LineColor(Colors.Grey.Lighten1);
            col.Item().PaddingVertical(1).Row(r =>
            {
                r.RelativeItem().Text("Payable:").Bold().FontSize(7);
                r.ConstantItem(36).AlignRight().Text(DocHelpers.Pkr(grandTotal)).Bold().FontSize(7);
            });
            col.Item().LineHorizontal(0.5f).LineColor(Colors.Grey.Lighten1);
            col.Item().PaddingBottom(1).Row(r =>
            {
                r.RelativeItem().Text("Paid:").FontSize(7);
                r.ConstantItem(36).AlignRight().Text(DocHelpers.Pkr(paid)).FontSize(7);
            });
            col.Item().PaddingBottom(3).Row(r =>
            {
                r.RelativeItem().Text("Due:").FontSize(7);
                r.ConstantItem(36).AlignRight().Text(DocHelpers.Pkr(due)).FontSize(7);
            });

            // ── Barcode ───────────────────────────────────────────
            if (barcodeBytes != null)
            {
                col.Item().PaddingTop(2).Column(bc =>
                {
                    bc.Item().AlignCenter().Height(22).Image(barcodeBytes).FitHeight();
                    bc.Item().AlignCenter().Text(orderCode).FontSize(6).FontColor(Colors.Grey.Darken1);
                });
            }

            // ── Footer ────────────────────────────────────────────
            col.Item().PaddingTop(4).AlignCenter().Text(footerText)
               .FontSize(6).Italic().FontColor(Colors.Grey.Darken1);
        });
    }

    void ComposeCutLine(IContainer container)
    {
        // Dotted perforated tear strip — 11 mm tall, centred vertically.
        // Renders:  ✂  - - - - - - - - - - TEAR HERE - - - - - - - - - -  ✂
        const string scissors  = "\u2702"; // ✂
        const string dash      = "\u2500"; // ─
        const string tearLabel = "TEAR HERE";

        var dashes = string.Join(" ", Enumerable.Repeat(dash, 18));

        container.AlignMiddle().Row(row =>
        {
            // Left scissors
            row.AutoItem().AlignMiddle()
               .Text(scissors).FontSize(10).FontColor(Colors.Grey.Medium);

            // Left dash segment
            row.RelativeItem().AlignMiddle().AlignRight()
               .Text(dashes).FontSize(8).FontColor(Colors.Grey.Medium);

            // "TEAR HERE" label
            row.AutoItem().PaddingHorizontal(4).AlignMiddle()
               .Text(tearLabel).Bold().FontSize(7).FontColor(Colors.Grey.Medium);

            // Right dash segment
            row.RelativeItem().AlignMiddle().AlignLeft()
               .Text(dashes).FontSize(8).FontColor(Colors.Grey.Medium);

            // Right scissors
            row.AutoItem().AlignMiddle()
               .Text(scissors).FontSize(10).FontColor(Colors.Grey.Medium);
        });
    }

    void ComposeReceiptHalf(IContainer container, string copyLabel,
        byte[]? barcodeBytes, string encounterCode,
        IReadOnlyList<JsonElement> items, float itemFontSize,
        bool showTotals, bool hasOverflow,
        string pageTitle = "PAYMENT RECEIPT")
    {
        var brandName     = _branding.BrandName ?? "Vexel Health";
        var address       = _branding.ReportHeader ?? "";
        var footerText    = _branding.ReportFooter
                            ?? (_branding.BrandName is { } bn
                                ? $"Thank you for choosing {bn}"
                                : "Thank you for choosing us");
        var headerLayout  = _branding.ReceiptHeaderLayout ?? _branding.ReportHeaderLayout ?? "default";
        var footerLayout  = _branding.ReceiptFooterLayout ?? "text";

        container
            .Border(0.7f)
            .BorderColor(Colors.Grey.Lighten1)
            .Padding(3f, Unit.Millimetre)
            .Column(col =>
        {
            // 1. Copy label
            col.Item().PaddingBottom(3).AlignCenter()
               .Text(copyLabel).Bold().FontSize(8).FontColor(Colors.Grey.Darken2);

            // 2. Header block — respects headerLayout
            col.Item().PaddingBottom(3).Element(c =>
            {
                if (_logoBytes != null && headerLayout != "minimal")
                {
                    // classic or default: logo left
                    c.Row(row =>
                    {
                        row.ConstantItem(40, Unit.Millimetre).Height(28).Image(_logoBytes).FitHeight();
                        row.RelativeItem().Column(hc =>
                        {
                            hc.Item().AlignCenter().Text(brandName).Bold().FontSize(13);
                            if (!string.IsNullOrWhiteSpace(address))
                                hc.Item().AlignRight().Text(address).FontSize(7).FontColor(Colors.Grey.Darken1);
                        });
                    });
                }
                else
                {
                    // minimal or no logo: text only
                    c.Column(hc =>
                    {
                        hc.Item().AlignCenter().Text(brandName).Bold().FontSize(13);
                        if (!string.IsNullOrWhiteSpace(address))
                            hc.Item().AlignCenter().Text(address).FontSize(7).FontColor(Colors.Grey.Darken1);
                    });
                }
            });

            // 3. Divider
            col.Item().PaddingVertical(3).LineHorizontal(0.5f).LineColor(Colors.Grey.Lighten1);

            // 4. Title — "PAYMENT RECEIPT" on page 1; "PAYMENT RECEIPT (Cont. — Pg N)" on overflow
            col.Item().PaddingBottom(4).AlignCenter()
               .Text(pageTitle).Bold().FontSize(9).FontColor(Colors.Grey.Darken3);

            // 5. Info block (3 rows x 2 cols)
            col.Item().PaddingBottom(4).Table(table =>
            {
                table.ColumnsDefinition(c => { c.RelativeColumn(); c.RelativeColumn(); });
                InfoRow(table,
                    $"MRN: {GetPatientDemo("mrn", Get("patientMrn", "N/A"))}",
                    $"Order ID: {(string.IsNullOrWhiteSpace(encounterCode) ? "N/A" : encounterCode)}");
                InfoRow(table,
                    $"Patient: {GetPatientDemo("displayName", Get("patientName", "N/A"))}",
                    $"Date: {DocHelpers.FormatDate(Get("issuedAt"))}");
                InfoRow(table,
                    $"Age/Gender: {GetPatientDemo("ageDisplay", Get("patientAge", "N/A"))}/{GetPatientDemo("gender", Get("patientGender", ""))}",
                    "");
            });

            // 6. Items table + optional totals
            col.Item().Element(c => ComposeReceiptBodyA4(c, items, itemFontSize, showTotals));

            // 7. "Continued on next page" note when items overflow
            if (hasOverflow && !showTotals)
            {
                col.Item().PaddingTop(2).AlignCenter()
                   .Text("▶ Continued on next page — see all tests & totals overleaf")
                   .Italic().FontSize(7).FontColor(Colors.Grey.Darken1);
            }

            // 8. Barcode
            if (barcodeBytes != null)
            {
                col.Item().PaddingTop(2).Column(bc =>
                {
                    bc.Item().LineHorizontal(0.5f).LineColor(Colors.Grey.Lighten2);
                    bc.Item().Height(30).AlignCenter().Image(barcodeBytes).FitHeight();
                    bc.Item().AlignCenter().Text(encounterCode).FontSize(7).FontColor(Colors.Grey.Darken1);
                });
            }

            // 9. Footer — respects footerLayout
            col.Item().PaddingTop(2).Element(footer =>
            {
                footer.Column(fc =>
                {
                    fc.Item().LineHorizontal(0.5f).LineColor(Colors.Grey.Lighten2);
                    if (footerLayout == "both" && _logoBytes != null)
                    {
                        fc.Item().PaddingTop(2).Column(inner => {
                            inner.Item().AlignCenter().Text(footerText).FontSize(7).FontColor(Colors.Grey.Darken1);
                        });
                    }
                    else
                    {
                        fc.Item().PaddingTop(2).AlignCenter().Text(footerText).FontSize(7).FontColor(Colors.Grey.Darken1);
                    }
                });
            });
        });
    }

    void InfoRow(TableDescriptor table, string left, string right)
    {
        table.Cell().Padding(2).Text(left).FontSize(8);
        table.Cell().Padding(2).Text(right).FontSize(8);
    }

    void ComposeReceiptBodyA4(IContainer container, IReadOnlyList<JsonElement> items,
        float fontSize, bool showTotals)
    {
        container.Column(col =>
        {
            col.Item().Element(c => ComposeReceiptItems(c, items, fontSize, showTotals));
            if (showTotals)
                col.Item().PaddingTop(4).Element(ComposePaymentSection);
        });
    }

    void ComposeReceiptItems(IContainer container, IReadOnlyList<JsonElement> items,
        float fontSize, bool showTotals)
    {
        if (items.Count == 0)
        {
            container.Column(col =>
            {
                col.Item().Table(table => ComposeReceiptItemsTable(table, items, fontSize));
                col.Item().PaddingTop(4).Text("No items.").FontSize(8).FontColor(Colors.Grey.Darken1);
            });
            return;
        }

        container.Column(col =>
        {
            // Items table — uses adaptive font size
            col.Item().Table(table => ComposeReceiptItemsTable(table, items, fontSize));

            // Totals — only shown on the last page of a multi-page receipt
            if (showTotals)
            {
                var subtotal   = Get("subtotalAmount",  Get("subtotal",    "0"));
                var discount   = Get("discountAmount",  Get("discount",    "0"));
                var grandTotal = Get("grandTotal",      Get("totalAmount", Get("payableAmount", "0")));
                var paid       = Get("paidAmount",      Get("amountPaid",  "0"));
                var due        = Get("balanceAmount",   Get("dueAmount",   Get("balanceDue",    "0")));

                col.Item().PaddingTop(4).Table(totals =>
                {
                    totals.ColumnsDefinition(c => { c.RelativeColumn(3); c.RelativeColumn(1); c.RelativeColumn(2); });
                    // spacer | label | value
                    TotalRow(totals, "Subtotal:",   DocHelpers.Pkr(subtotal),   false);
                    if (decimal.TryParse(discount, out var discVal) && discVal > 0)
                        TotalRow(totals, "Discount:", DocHelpers.Pkr(discount), false);
                    TotalRow(totals, "Payable:",    DocHelpers.Pkr(grandTotal), true);
                    var paidDisplay = decimal.TryParse(paid, out var paidVal) && paidVal == 0 &&
                                      decimal.TryParse(grandTotal, out var gtVal) && gtVal > 0
                                      ? "\u2014" : DocHelpers.Pkr(paid);
                    TotalRow(totals, "Paid:", paidDisplay, false);
                    TotalRow(totals, "Due:",  DocHelpers.Pkr(due), false);
                });
            }
        });
    }

    void ComposeReceiptItemsTable(TableDescriptor table, IReadOnlyList<JsonElement> linesList, float fontSize)
    {
        table.ColumnsDefinition(c =>
        {
            c.RelativeColumn(4);
            c.ConstantColumn(60);
        });

        // Header row — always 8 pt regardless of adaptive font size
        table.Cell().Background(Colors.Grey.Lighten4).BorderBottom(0.5f)
             .BorderColor(Colors.Grey.Lighten2).Padding(3)
             .Text("Test Name").Bold().FontSize(8);
        table.Cell().Background(Colors.Grey.Lighten4).BorderBottom(0.5f)
             .BorderColor(Colors.Grey.Lighten2).Padding(3).AlignRight()
             .Text("Price").Bold().FontSize(8);

        foreach (var line in linesList)
        {
            var desc  = GetFrom(line, "description",
                        GetFrom(line, "testName", GetFrom(line, "name", "\u2014")));
            var price = GetFrom(line, "unitPrice", GetFrom(line, "price", "0"));
            table.Cell().BorderBottom(0.5f).BorderColor(Colors.Grey.Lighten2)
                 .Padding(3).Text(desc).FontSize(fontSize);
            table.Cell().BorderBottom(0.5f).BorderColor(Colors.Grey.Lighten2)
                 .Padding(3).AlignRight().Text(DocHelpers.Pkr(price)).FontSize(fontSize);
        }
    }

    void TotalRow(TableDescriptor totals, string label, string value, bool bold)
    {
        totals.Cell().Text("").FontSize(8); // spacer
        totals.Cell().AlignRight().BorderTop(0.5f).BorderColor(Colors.Grey.Lighten2)
              .Padding(2).Text(label).FontSize(8).FontColor(Colors.Grey.Darken2);
        var cell = totals.Cell().AlignRight().BorderTop(0.5f).BorderColor(Colors.Grey.Lighten2).Padding(2);
        if (bold) cell.Text(value).Bold().FontSize(8);
        else      cell.Text(value).FontSize(8);
    }

    void ComposePaymentSection(IContainer container)
    {
        var method   = Get("paymentMethod", Get("method"));
        var comments = Get("paymentComments", Get("comments", ""));
        container.Column(col =>
        {
            col.Item().Text($"Paid by: {method}").FontSize(8).FontColor(Colors.Grey.Darken1);
            if (!string.IsNullOrWhiteSpace(comments) && comments != "\u2014")
                col.Item().Text(comments).FontSize(8).FontColor(Colors.Grey.Darken1);
        });
    }

    // Renders a continuation A4 page for items that did not fit on page 1.
    // Uses the same two-half tearable layout as page 1 (patient copy + tear strip + office copy),
    // because every A4 receipt page must print two copies.
    void ComposeOverflowPage(IContainer container, int pageNum,
        byte[]? barcodeBytes, string encounterCode,
        IReadOnlyList<JsonElement> items, float fontSize, bool isLastPage)
    {
        // Continuation page title — kept compact to fit within the 5mm title slot
        var title = $"PAYMENT RECEIPT (Cont. — Pg {pageNum})";

        container.Column(col =>
        {
            col.Spacing(0);
            col.Item().Height(137, Unit.Millimetre).Element(c =>
                ComposeReceiptHalf(c, "PATIENT COPY", barcodeBytes, encounterCode,
                    items, fontSize, showTotals: isLastPage, hasOverflow: !isLastPage,
                    pageTitle: title));
            col.Item().Height(11, Unit.Millimetre).Element(ComposeCutLine);
            col.Item().Height(137, Unit.Millimetre).Element(c =>
                ComposeReceiptHalf(c, "OFFICE COPY", barcodeBytes, encounterCode,
                    items, fontSize, showTotals: isLastPage, hasOverflow: !isLastPage,
                    pageTitle: title));
        });
    }
}

// ─── OpdInvoiceReceiptDocument ────────────────────────────────────────────────

class OpdInvoiceReceiptDocument : IDocument
{
    private readonly JsonElement    _payload;
    private readonly BrandingConfig _branding;

    public OpdInvoiceReceiptDocument(JsonElement payload, BrandingConfig branding)
    {
        _payload  = payload;
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

            Cell(table, "Visit ID",       Get("opdVisitId",  Get("visitId")));
            Cell(table, "Appointment ID", Get("appointmentId"));
            Cell(table, "Provider",       Get("providerName", Get("doctorName")));
            Cell(table, "Department",     Get("departmentName"));

            Cell(table, "Payment Method", Get("paymentMethod", Get("method")));
            Cell(table, "Reference",      Get("referenceNo"));
            Cell(table, "Received By",    Get("receivedBy"));
            Cell(table, "Source Ref",     Get("sourceRef"));
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
            SummaryRow(table, "Tax",      Get("taxAmount",      Get("tax",      "0.00")));
            SummaryRow(table, "Total",    Get("totalAmount",    Get("total",    "0.00")), true);
            SummaryRow(table, "Paid",     Get("paidAmount",     Get("amountPaid", "0.00")));
            SummaryRow(table, "Balance",  Get("balanceAmount",  Get("balanceDue", "0.00")));
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
        else           cell.Text(value).FontSize(8);
    }

    void Cell(TableDescriptor table, string label, string value)
    {
        table.Cell().Background(Colors.Grey.Lighten4).BorderBottom(0.5f)
             .BorderColor(Colors.Grey.Lighten2).Padding(3).Text(label).FontSize(8);
        table.Cell().BorderBottom(0.5f).BorderColor(Colors.Grey.Lighten2)
             .Padding(3).Text(value).FontSize(8);
    }

    string Get(string key, string fallback = "\u2014")
    {
        if (_payload.TryGetProperty(key, out var value))
            return ToDisplay(value, fallback);
        return fallback;
    }

    static string Get(JsonElement obj, string key, string fallback = "\u2014")
    {
        if (obj.ValueKind == JsonValueKind.Object && obj.TryGetProperty(key, out var value))
            return ToDisplay(value, fallback);
        return fallback;
    }

    static string ToDisplay(JsonElement value, string fallback = "\u2014") =>
        value.ValueKind switch
        {
            JsonValueKind.String    => value.GetString() ?? fallback,
            JsonValueKind.Number    => value.ToString(),
            JsonValueKind.True      => "true",
            JsonValueKind.False     => "false",
            JsonValueKind.Null      => fallback,
            JsonValueKind.Undefined => fallback,
            _                       => value.ToString()
        };
}

// ─── GraphicalScaleReportDocument ─────────────────────────────────────────────

class GraphicalScaleReportDocument : IDocument
{
    private readonly JsonElement         _payload;
    private readonly BrandingConfig      _branding;
    private readonly JsonElement?        _configJson;
    private readonly byte[]?             _logoBytes;

    // Color token → QuestPDF Color
    private static readonly Dictionary<string, QuestPDF.Infrastructure.Color> TokenColors = new()
    {
        ["GOOD"]    = QuestPDF.Infrastructure.Color.FromHex("#22C55E"),  // green-500
        ["CAUTION"] = QuestPDF.Infrastructure.Color.FromHex("#F59E0B"),  // amber-500
        ["BAD"]     = QuestPDF.Infrastructure.Color.FromHex("#EF4444"),  // red-500
        ["INFO"]    = QuestPDF.Infrastructure.Color.FromHex("#3B82F6"),  // blue-500
        ["NEUTRAL"] = QuestPDF.Infrastructure.Color.FromHex("#9CA3AF"),  // gray-400
    };

    private static readonly QuestPDF.Infrastructure.Color LightGray   = QuestPDF.Infrastructure.Color.FromHex("#F3F4F6");
    private static readonly QuestPDF.Infrastructure.Color MediumGray  = QuestPDF.Infrastructure.Color.FromHex("#9CA3AF");
    private static readonly QuestPDF.Infrastructure.Color DarkGray    = QuestPDF.Infrastructure.Color.FromHex("#374151");
    private static readonly QuestPDF.Infrastructure.Color TextPrimary = QuestPDF.Infrastructure.Color.FromHex("#111827");

    public GraphicalScaleReportDocument(JsonElement payload, BrandingConfig branding, JsonElement? configJson, byte[]? logoBytes)
    {
        _payload    = payload;
        _branding   = branding;
        _configJson = configJson;
        _logoBytes  = logoBytes;
    }

    public DocumentMetadata GetMetadata() => new()
    {
        Title = GetConfigString("title", "Graphical Scale Report"),
    };

    public void Compose(IDocumentContainer container)
    {
        container.Page(page =>
        {
            page.Size(PageSizes.A4);
            page.Margin(30, Unit.Point);
            page.DefaultTextStyle(t => t.FontSize(9).FontColor(TextPrimary));

            page.Header().Element(ComposeHeader);
            page.Content().Element(ComposeContent);
            page.Footer().Element(ComposeFooter);
        });
    }

    // ── Header ──────────────────────────────────────────────────────────────

    void ComposeHeader(IContainer container)
    {
        container.Column(col =>
        {
            col.Item().Row(row =>
            {
                // Logo
                if (_logoBytes != null)
                {
                    row.ConstantItem(60).Padding(2).Image(_logoBytes).FitArea();
                }

                row.RelativeItem().Column(inner =>
                {
                    inner.Item().Text(_branding.BrandName ?? "Laboratory")
                        .Bold().FontSize(14).FontColor(TextPrimary);
                    if (!string.IsNullOrEmpty(_branding.ReportHeader))
                        inner.Item().Text(_branding.ReportHeader).FontSize(8).FontColor(MediumGray);
                });

                row.ConstantItem(120).Column(inner =>
                {
                    var title = GetConfigString("title", "Graphical Report");
                    var subtitle = GetConfigString("subtitle", "");
                    inner.Item().AlignRight().Text(title).Bold().FontSize(11).FontColor(TextPrimary);
                    if (!string.IsNullOrEmpty(subtitle))
                        inner.Item().AlignRight().Text(subtitle).FontSize(8).FontColor(MediumGray);
                });
            });

            col.Item().PaddingTop(4).LineHorizontal(1.5f).LineColor(DarkGray);
        });
    }

    // ── Content ─────────────────────────────────────────────────────────────

    void ComposeContent(IContainer container)
    {
        container.PaddingTop(8).Column(col =>
        {
            // Demographics block
            if (GetConfigBool("showDemographics", true))
            {
                col.Item().Element(ComposeDemographics);
                col.Item().PaddingVertical(6).LineHorizontal(0.5f).LineColor(MediumGray);
            }

            // Collect all parameter values from payload
            var paramValues = CollectParameterValues();

            // Get configured parameters
            var parameters = GetConfigParameters();

            if (parameters.Count == 0)
            {
                col.Item().Padding(10).Text("No parameters configured for this template.").FontColor(MediumGray);
                return;
            }

            // Render each parameter section
            foreach (var param in parameters)
            {
                col.Item().PaddingVertical(4).Element(c => ComposeParameterScale(c, param, paramValues));
            }

            // Interpretation summary table
            if (GetConfigBool("showInterpretationSummary", true))
            {
                col.Item().PaddingTop(10).Element(c => ComposeSummaryTable(c, parameters, paramValues));
            }
        });
    }

    void ComposeDemographics(IContainer container)
    {
        var patientName = Str("patientName");
        var mrn         = Str("patientMrn");
        var age         = Str("patientAge");
        var gender      = Str("patientGender");
        var dob         = Str("patientDob");
        var encCode     = Str("encounterCode");
        var reportNo    = Str("reportNumber");
        var issuedAt    = Str("issuedAt");

        container.Table(table =>
        {
            table.ColumnsDefinition(c =>
            {
                c.RelativeColumn(1);
                c.RelativeColumn(1);
                c.RelativeColumn(1);
                c.RelativeColumn(1);
            });

            DemoCell(table, "Patient", patientName);
            DemoCell(table, "MRN", mrn);
            DemoCell(table, "Age / Gender", $"{age} / {gender}");
            DemoCell(table, "Report No.", reportNo);
            DemoCell(table, "Date of Birth", dob);
            DemoCell(table, "Encounter", encCode);
            DemoCell(table, "Issued", FormatDate(issuedAt));
            DemoCell(table, "Status", Str("reportStatus"));
        });
    }

    static void DemoCell(TableDescriptor table, string label, string value)
    {
        table.Cell().Padding(2).Column(c =>
        {
            c.Item().Text(label).FontSize(7).FontColor(MediumGray);
            c.Item().Text(value).FontSize(9).Bold();
        });
    }

    void ComposeParameterScale(IContainer container, ScaleParameter param, Dictionary<string, string?> paramValues)
    {
        var rawValue = ResolveParamValue(param, paramValues);

        container.Background(LightGray).Padding(6).Column(col =>
        {
            // Row 1: label + value
            col.Item().Row(row =>
            {
                row.RelativeItem().Text(param.Label).Bold().FontSize(10);
                if (rawValue != null)
                {
                    if (double.TryParse(rawValue, System.Globalization.NumberStyles.Any,
                            System.Globalization.CultureInfo.InvariantCulture, out var numVal))
                    {
                        var matchedBand = ResolveBand(param.Bands, numVal);
                        var valueColor = matchedBand != null
                            ? TokenColors.GetValueOrDefault(matchedBand.ColorToken, MediumGray)
                            : MediumGray;
                        row.AutoItem().Text($"{rawValue} {param.Unit}").Bold().FontSize(11).FontColor(valueColor);
                    }
                    else
                    {
                        row.AutoItem().Text($"{rawValue} {param.Unit}").Bold().FontSize(11);
                    }
                }
                else
                {
                    row.AutoItem().Text("—").FontSize(11).FontColor(MediumGray);
                }
            });

            col.Item().PaddingTop(4).Element(c => ComposeBandScale(c, param.Bands, rawValue));
        });
    }

    void ComposeBandScale(IContainer container, List<InterpretationBand> bands, string? rawValue)
    {
        double? numericValue = null;
        if (rawValue != null && double.TryParse(rawValue, System.Globalization.NumberStyles.Any,
                System.Globalization.CultureInfo.InvariantCulture, out var p))
            numericValue = p;

        var matchedBandIdx = -1;
        if (numericValue.HasValue)
        {
            for (int i = 0; i < bands.Count; i++)
            {
                if (BandContains(bands[i], numericValue.Value))
                { matchedBandIdx = i; break; }
            }
        }

        // Total visible width split equally across bands
        container.Row(row =>
        {
            for (int i = 0; i < bands.Count; i++)
            {
                var band = bands[i];
                var isMatch = (i == matchedBandIdx);
                var bandColor = TokenColors.GetValueOrDefault(band.ColorToken, MediumGray);
                var bgColor   = isMatch ? bandColor : QuestPDF.Infrastructure.Color.FromHex("#E5E7EB");

                int idx = i;
                row.RelativeItem().Element(cell =>
                {
                    cell.Background(bgColor).Padding(3).Column(c =>
                    {
                        c.Item().AlignCenter()
                            .Text(band.Label)
                            .FontSize(7)
                            .FontColor(isMatch ? Colors.White : DarkGray);
                        c.Item().AlignCenter()
                            .Text(BandRangeLabel(band))
                            .FontSize(6)
                            .FontColor(isMatch ? Colors.White : MediumGray);
                    });
                });
            }
        });
    }

    void ComposeSummaryTable(IContainer container, List<ScaleParameter> parameters, Dictionary<string, string?> paramValues)
    {
        container.Column(col =>
        {
            col.Item().Text("Interpretation Summary").Bold().FontSize(10);
            col.Item().PaddingTop(4).Table(table =>
            {
                table.ColumnsDefinition(c =>
                {
                    c.RelativeColumn(3);
                    c.RelativeColumn(2);
                    c.RelativeColumn(1);
                    c.RelativeColumn(3);
                });

                // Header
                SumCell(table, "Parameter", true);
                SumCell(table, "Result", true);
                SumCell(table, "Unit", true);
                SumCell(table, "Category", true);

                foreach (var param in parameters)
                {
                    var rawValue = ResolveParamValue(param, paramValues);
                    string category = "—";
                    QuestPDF.Infrastructure.Color catColor = MediumGray;

                    if (rawValue != null && double.TryParse(rawValue,
                            System.Globalization.NumberStyles.Any,
                            System.Globalization.CultureInfo.InvariantCulture, out var numVal))
                    {
                        var band = ResolveBand(param.Bands, numVal);
                        if (band != null)
                        {
                            category = band.Label;
                            catColor = TokenColors.GetValueOrDefault(band.ColorToken, MediumGray);
                        }
                    }

                    SumCell(table, param.Label);
                    SumCell(table, rawValue ?? "—");
                    SumCell(table, param.Unit);
                    table.Cell().Padding(3)
                        .Text(category).FontSize(8).Bold().FontColor(catColor);
                }
            });
        });
    }

    static void SumCell(TableDescriptor table, string text, bool isHeader = false)
    {
        var cell = table.Cell().Padding(3).Text(text).FontSize(8);
        if (isHeader) cell.Bold();
    }

    // ── Footer ──────────────────────────────────────────────────────────────

    void ComposeFooter(IContainer container)
    {
        container.Column(col =>
        {
            col.Item().LineHorizontal(0.5f).LineColor(MediumGray);
            col.Item().PaddingTop(4).Row(row =>
            {
                var disclaimer = _branding.FooterText ?? _branding.ReportFooter ?? "Results are for clinical use only.";
                row.RelativeItem().Text(disclaimer).FontSize(7).FontColor(MediumGray);

                var verifiedBy = _payload.ValueKind == JsonValueKind.Object &&
                    _payload.TryGetProperty("verifiedBy", out var vb) ? vb.GetString() : null;
                if (!string.IsNullOrEmpty(verifiedBy))
                    row.AutoItem().Text($"Verified by: {verifiedBy}").FontSize(7).FontColor(MediumGray);
            });
        });
    }

    // ── Config helpers ───────────────────────────────────────────────────────

    string GetConfigString(string key, string fallback = "")
    {
        if (_configJson == null) return fallback;
        var cfg = _configJson.Value;
        if (cfg.ValueKind == JsonValueKind.Object && cfg.TryGetProperty(key, out var val) && val.ValueKind == JsonValueKind.String)
            return val.GetString() ?? fallback;
        return fallback;
    }

    bool GetConfigBool(string key, bool fallback = true)
    {
        if (_configJson == null) return fallback;
        var cfg = _configJson.Value;
        if (cfg.ValueKind != JsonValueKind.Object) return fallback;
        if (!cfg.TryGetProperty(key, out var val)) return fallback;
        return val.ValueKind switch
        {
            JsonValueKind.True  => true,
            JsonValueKind.False => false,
            _                   => fallback,
        };
    }

    List<ScaleParameter> GetConfigParameters()
    {
        var result = new List<ScaleParameter>();
        if (_configJson == null) return result;
        var cfg = _configJson.Value;
        if (cfg.ValueKind != JsonValueKind.Object) return result;
        if (!cfg.TryGetProperty("parameters", out var paramsEl)) return result;
        if (paramsEl.ValueKind != JsonValueKind.Array) return result;

        foreach (var p in paramsEl.EnumerateArray())
        {
            if (p.ValueKind != JsonValueKind.Object) continue;
            var key          = p.TryGetProperty("key", out var k) ? k.GetString() ?? "" : "";
            var label        = p.TryGetProperty("label", out var l) ? l.GetString() ?? "" : key;
            var unit         = p.TryGetProperty("unit", out var u) ? u.GetString() ?? "" : "";
            var sourceMode   = p.TryGetProperty("sourceMode", out var sm) ? sm.GetString() ?? "parameter_name_match" : "parameter_name_match";
            var sourceMatch  = p.TryGetProperty("sourceMatch", out var sc) ? sc.GetString() ?? label : label;
            var skipIfMissing = p.TryGetProperty("skipIfMissing", out var skip) && skip.ValueKind == JsonValueKind.True;

            var bands = new List<InterpretationBand>();
            if (p.TryGetProperty("bands", out var bandsEl) && bandsEl.ValueKind == JsonValueKind.Array)
            {
                foreach (var b in bandsEl.EnumerateArray())
                {
                    if (b.ValueKind != JsonValueKind.Object) continue;
                    var bLabel = b.TryGetProperty("label", out var bl) ? bl.GetString() ?? "" : "";
                    double? bMin = null;
                    double? bMax = null;
                    if (b.TryGetProperty("min", out var bMinEl) && bMinEl.ValueKind == JsonValueKind.Number)
                        bMin = bMinEl.GetDouble();
                    if (b.TryGetProperty("max", out var bMaxEl) && bMaxEl.ValueKind == JsonValueKind.Number)
                        bMax = bMaxEl.GetDouble();
                    var bColor = b.TryGetProperty("colorToken", out var bc) ? bc.GetString() ?? "NEUTRAL" : "NEUTRAL";
                    bands.Add(new InterpretationBand(bLabel, bMin, bMax, bColor));
                }
            }

            if (bands.Count == 0) continue;
            result.Add(new ScaleParameter(key, label, unit, sourceMode, sourceMatch, skipIfMissing, bands));
        }

        return result;
    }

    // ── Parameter value resolution ───────────────────────────────────────────

    Dictionary<string, string?> CollectParameterValues()
    {
        var dict = new Dictionary<string, string?>(StringComparer.OrdinalIgnoreCase);
        if (_payload.ValueKind != JsonValueKind.Object) return dict;
        if (!_payload.TryGetProperty("tests", out var tests)) return dict;
        if (tests.ValueKind != JsonValueKind.Array) return dict;

        foreach (var test in tests.EnumerateArray())
        {
            if (!test.TryGetProperty("parameters", out var parms)) continue;
            if (parms.ValueKind != JsonValueKind.Array) continue;
            foreach (var param in parms.EnumerateArray())
            {
                var name = param.TryGetProperty("parameterName", out var pn) ? pn.GetString() : null;
                var val  = param.TryGetProperty("value", out var pv) ? pv.GetString() : null;
                if (!string.IsNullOrEmpty(name))
                    dict[name!] = val;
            }
        }

        return dict;
    }

    static string? ResolveParamValue(ScaleParameter param, Dictionary<string, string?> paramValues)
    {
        // Exact match first
        if (paramValues.TryGetValue(param.SourceMatch, out var val)) return val;
        // Case-insensitive fallback
        foreach (var kv in paramValues)
        {
            if (string.Equals(kv.Key, param.SourceMatch, StringComparison.OrdinalIgnoreCase))
                return kv.Value;
            if (string.Equals(kv.Key, param.Label, StringComparison.OrdinalIgnoreCase))
                return kv.Value;
        }
        return null;
    }

    // ── Band helpers ─────────────────────────────────────────────────────────

    static bool BandContains(InterpretationBand band, double value)
    {
        var lo = band.Min ?? double.NegativeInfinity;
        var hi = band.Max ?? double.PositiveInfinity;
        return value >= lo && value < hi;
    }

    static InterpretationBand? ResolveBand(List<InterpretationBand> bands, double value)
    {
        foreach (var b in bands)
            if (BandContains(b, value)) return b;
        // If value equals the max of the last band (upper-inclusive for final band)
        if (bands.Count > 0)
        {
            var last = bands[^1];
            if (last.Max.HasValue && Math.Abs(value - last.Max.Value) < 1e-9)
                return last;
        }
        return null;
    }

    static string BandRangeLabel(InterpretationBand band)
    {
        if (band.Min == null && band.Max != null)  return $"< {band.Max}";
        if (band.Min != null && band.Max == null)  return $"≥ {band.Min}";
        if (band.Min != null && band.Max != null)  return $"{band.Min}–{band.Max}";
        return "all";
    }

    // ── Payload string helper ────────────────────────────────────────────────

    string Str(string key, string fallback = "—")
    {
        if (_payload.ValueKind == JsonValueKind.Object && _payload.TryGetProperty(key, out var val))
            return val.ValueKind == JsonValueKind.String ? val.GetString() ?? fallback : fallback;
        return fallback;
    }

    static string FormatDate(string iso)
    {
        if (DateTime.TryParse(iso, out var dt))
            return dt.ToString("dd MMM yyyy");
        return iso;
    }
}

// ─── Graphical Scale Config Models ────────────────────────────────────────────

record InterpretationBand(string Label, double? Min, double? Max, string ColorToken);
record ScaleParameter(string Key, string Label, string Unit, string SourceMode, string SourceMatch, bool SkipIfMissing, List<InterpretationBand> Bands);
