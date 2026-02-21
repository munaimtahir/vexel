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

// Render stub endpoint
app.MapPost("/render", (RenderRequest request) =>
{
    // TODO: implement QuestPDF rendering
    return Results.Accepted("/render/stub-job-id", new
    {
        jobId = Guid.NewGuid().ToString(),
        status = "queued",
        message = "PDF rendering not yet implemented"
    });
})
.WithName("RenderPdf")
.WithTags("Render");

app.Run();

record RenderRequest(
    string TenantId,
    string EncounterId,
    string DocType,
    string TemplateVersion,
    object Payload
);
