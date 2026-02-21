using System.Security.Cryptography;
using System.Text.Json;

var builder = WebApplication.CreateBuilder(args);
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen();

var app = builder.Build();

if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI();
}

// Health endpoint
app.MapGet("/health/pdf", () => Results.Ok(new
{
    status = "ok",
    version = "0.1.0",
    services = new { pdf = "ok" }
}))
.WithName("GetPdfHealth")
.WithTags("Health");

// Render endpoint
app.MapPost("/render", async (HttpContext context) =>
{
    using var reader = new StreamReader(context.Request.Body);
    var body = await reader.ReadToEndAsync();

    // Generate placeholder PDF bytes (Phase 6 will use QuestPDF with real templates)
    var pdfBytes = GeneratePlaceholderPdf(body);

    var hash = Convert.ToHexString(SHA256.HashData(pdfBytes)).ToLower();

    context.Response.Headers["X-Pdf-Hash"] = hash;
    context.Response.ContentType = "application/pdf";
    await context.Response.Body.WriteAsync(pdfBytes);
})
.WithName("RenderPdf")
.WithTags("Render");

app.Run();

static byte[] GeneratePlaceholderPdf(string jsonBody)
{
    // Minimal valid PDF — real QuestPDF rendering comes in Phase 6
    var placeholder = "%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n" +
                      "2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj\n" +
                      "3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 612 792]>>endobj\n" +
                      "xref\n0 4\n0000000000 65535 f\n" +
                      "trailer<</Size 4/Root 1 0 R>>\nstartxref\n%%EOF";
    return System.Text.Encoding.ASCII.GetBytes(placeholder);
}
