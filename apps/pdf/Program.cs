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
            "receipt_v1"             => GenerateReceipt(payload, req?.BrandingConfig, logoBytes),
            "opd_invoice_receipt_v1" => GenerateOpdInvoiceReceipt(payload, req?.BrandingConfig),
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
    BrandingConfig? BrandingConfig
);

record BrandingConfig
{
    public string? BrandName            { get; init; }
    public string? LogoUrl              { get; init; }
    public string? ReportHeader         { get; init; }
    public string? ReportFooter         { get; init; }
    public string? HeaderText           { get; init; }
    public string? FooterText           { get; init; }
    public string? ReportHeaderLayout   { get; init; }  // default | classic | minimal
    public string? ReceiptLayout        { get; init; }  // a4 | thermal (thermal TBD)
    public string? ReportFooterImageUrl { get; init; }  // URL to footer image
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

    string Get(string key, string fallback = "\u2014")
    {
        if (_payload.TryGetProperty(key, out var v)) return DocHelpers.ToDisplay(v, fallback);
        return fallback;
    }

    static string GetFrom(JsonElement obj, string key, string fallback = "\u2014")
    {
        if (obj.ValueKind == JsonValueKind.Object && obj.TryGetProperty(key, out var v))
            return DocHelpers.ToDisplay(v, fallback);
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
        if (encounterCode != "\u2014" && !string.IsNullOrWhiteSpace(encounterCode))
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
        container.BorderTop(0.5f).BorderColor(Colors.Grey.Lighten1).PaddingTop(4).Row(row =>
        {
            row.RelativeItem().Element(left =>
            {
                if (footerImageBytes != null)
                    left.MaxHeight(25).Image(footerImageBytes).FitHeight();
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

    public ReceiptDocument(JsonElement payload, BrandingConfig branding, byte[]? logoBytes)
    {
        _payload   = payload;
        _branding  = branding;
        _logoBytes = logoBytes;
    }

    public DocumentMetadata GetMetadata() => DocumentMetadata.Default;

    string Get(string key, string fallback = "\u2014")
    {
        if (_payload.TryGetProperty(key, out var v)) return DocHelpers.ToDisplay(v, fallback);
        return fallback;
    }

    static string GetFrom(JsonElement obj, string key, string fallback = "\u2014")
    {
        if (obj.ValueKind == JsonValueKind.Object && obj.TryGetProperty(key, out var v))
            return DocHelpers.ToDisplay(v, fallback);
        return fallback;
    }

    public void Compose(IDocumentContainer container)
    {
        var encounterCode = Get("encounterCode");
        byte[]? barcodeBytes = null;
        if (encounterCode != "\u2014" && !string.IsNullOrWhiteSpace(encounterCode))
            barcodeBytes = DocHelpers.GenerateBarcodePng(encounterCode);

        container.Page(page =>
        {
            page.Size(PageSizes.A4);
            page.Margin(1f, Unit.Centimetre);
            page.DefaultTextStyle(x => x.FontSize(8).FontFamily(Fonts.Arial));

            page.Content().Column(col =>
            {
                col.Spacing(0);
                col.Item().Element(c => ComposeReceiptHalf(c, "PATIENT COPY", barcodeBytes, encounterCode));
                col.Item().PaddingVertical(4).Element(ComposeCutLine);
                col.Item().Element(c => ComposeReceiptHalf(c, "OFFICE COPY", barcodeBytes, encounterCode));
            });
        });
    }

    void ComposeCutLine(IContainer container)
    {
        container.AlignMiddle().AlignCenter()
            .Text("\u2500 \u2500 \u2500 \u2500 \u2500 \u2500 \u2500 \u2500 \u2500 \u2500 \u2500 \u2500 \u2500 \u2500 \u2500  \u2702  \u2500 \u2500 \u2500 \u2500 \u2500 \u2500 \u2500 \u2500 \u2500 \u2500 \u2500 \u2500 \u2500 \u2500 \u2500")
            .FontSize(9).FontColor(Colors.Grey.Lighten2);
    }

    void ComposeReceiptHalf(IContainer container, string copyLabel, byte[]? barcodeBytes, string encounterCode)
    {
        var brandName  = _branding.BrandName ?? "Vexel Health";
        var address    = _branding.ReportHeader ?? "";
        var footerText = _branding.ReportFooter
                         ?? (_branding.BrandName is { } bn
                             ? $"Thank you for choosing {bn}"
                             : "Thank you for choosing us");

        container.Column(col =>
        {
            // 1. Copy label
            col.Item().PaddingBottom(3).AlignCenter()
               .Text(copyLabel).Bold().FontSize(8).FontColor(Colors.Grey.Darken2);

            // 2. Header block
            col.Item().PaddingBottom(3).Element(c =>
            {
                if (_logoBytes != null)
                {
                    c.Row(row =>
                    {
                        row.ConstantItem(50, Unit.Millimetre).MaxHeight(30).Image(_logoBytes).FitHeight();
                        row.RelativeItem().AlignCenter().Column(hc =>
                        {
                            hc.Item().AlignCenter().Text(brandName).Bold().FontSize(14);
                            if (!string.IsNullOrWhiteSpace(address))
                                hc.Item().AlignRight().Text(address).FontSize(8).FontColor(Colors.Grey.Darken1);
                        });
                    });
                }
                else
                {
                    c.Column(hc =>
                    {
                        hc.Item().AlignCenter().Text(brandName).Bold().FontSize(14);
                        if (!string.IsNullOrWhiteSpace(address))
                            hc.Item().AlignCenter().Text(address).FontSize(8).FontColor(Colors.Grey.Darken1);
                    });
                }
            });

            // 3. Divider
            col.Item().PaddingVertical(3).LineHorizontal(0.5f).LineColor(Colors.Grey.Lighten1);

            // 4. "PAYMENT RECEIPT" label
            col.Item().PaddingBottom(4).AlignCenter()
               .Text("PAYMENT RECEIPT").Bold().FontSize(9).FontColor(Colors.Grey.Darken3);

            // 5. Info block (3 rows x 2 cols)
            col.Item().PaddingBottom(4).Table(table =>
            {
                table.ColumnsDefinition(c => { c.RelativeColumn(); c.RelativeColumn(); });
                InfoRow(table,
                    $"MRN: {Get("patientMrn")}",
                    $"Order ID: {encounterCode}");
                InfoRow(table,
                    $"Patient: {Get("patientName")}",
                    $"Date: {DocHelpers.FormatDate(Get("issuedAt"))}");
                InfoRow(table,
                    $"Age/Gender: {Get("patientAge")}/{Get("patientGender")}",
                    $"Receipt No: {Get("receiptNumber")}");
            });

            // 6. Items table + totals
            col.Item().PaddingBottom(4).Element(ComposeReceiptItems);

            // 7. Payment section
            col.Item().PaddingBottom(4).Element(ComposePaymentSection);

            // 8. Barcode
            if (barcodeBytes != null)
            {
                col.Item().PaddingBottom(2).Column(bc =>
                {
                    bc.Item().Height(30).AlignCenter().Image(barcodeBytes).FitHeight();
                    bc.Item().AlignCenter().Text(encounterCode).FontSize(7).FontColor(Colors.Grey.Darken1);
                });
            }

            // 9. Footer
            col.Item().AlignCenter().Text(footerText).Italic().FontSize(7).FontColor(Colors.Grey.Darken1);
        });
    }

    void InfoRow(TableDescriptor table, string left, string right)
    {
        table.Cell().Padding(2).Text(left).FontSize(8);
        table.Cell().Padding(2).Text(right).FontSize(8);
    }

    void ComposeReceiptItems(IContainer container)
    {
        if (!_payload.TryGetProperty("items", out var lines) || lines.ValueKind != JsonValueKind.Array)
        {
            container.Text("No items.").FontSize(8).FontColor(Colors.Grey.Darken1);
            return;
        }

        var linesList = lines.EnumerateArray().ToList();
        if (linesList.Count == 0)
        {
            container.Text("No items.").FontSize(8).FontColor(Colors.Grey.Darken1);
            return;
        }

        var subtotal   = Get("subtotalAmount",  Get("subtotal",    "0"));
        var discount   = Get("discountAmount",  Get("discount",    "0"));
        var grandTotal = Get("grandTotal",      Get("totalAmount", Get("payableAmount", "0")));
        var paid       = Get("paidAmount",      Get("amountPaid",  "0"));
        var due        = Get("balanceAmount",   Get("dueAmount",   Get("balanceDue",    "0")));

        container.Column(col =>
        {
            // Items table
            col.Item().Table(table =>
            {
                table.ColumnsDefinition(c =>
                {
                    c.RelativeColumn(4);
                    c.ConstantColumn(60);
                });

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
                         .Padding(3).Text(desc).FontSize(8);
                    table.Cell().BorderBottom(0.5f).BorderColor(Colors.Grey.Lighten2)
                         .Padding(3).AlignRight().Text(DocHelpers.Pkr(price)).FontSize(8);
                }
            });

            // Totals — right-aligned table (no width constraint)
            col.Item().PaddingTop(4).Table(totals =>
            {
                totals.ColumnsDefinition(c => { c.RelativeColumn(3); c.RelativeColumn(1); c.RelativeColumn(2); });
                // spacer | label | value
                TotalRow(totals, "Subtotal:",          DocHelpers.Pkr(subtotal),   false);
                if (decimal.TryParse(discount, out var discVal) && discVal > 0)
                    TotalRow(totals, "Discount:",      DocHelpers.Pkr(discount),   false);
                TotalRow(totals, "Payable:",            DocHelpers.Pkr(grandTotal), true);
                var paidDisplay = decimal.TryParse(paid, out var paidVal) && paidVal == 0 &&
                                  decimal.TryParse(grandTotal, out var gtVal) && gtVal > 0
                                  ? "\u2014" : DocHelpers.Pkr(paid);
                TotalRow(totals, "Paid:",              paidDisplay,                false);
                TotalRow(totals, "Due:",               DocHelpers.Pkr(due),        false);
            });
        });
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
