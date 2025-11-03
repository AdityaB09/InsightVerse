// Program.cs
using System.Globalization;
using System.Text;
using System.Text.Json;
using System.Text.RegularExpressions;
using Dapper;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http.Features;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.OpenApi.Models;
using Npgsql;

var builder = WebApplication.CreateBuilder(args);

builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen(c =>
{
    c.SwaggerDoc("v1", new OpenApiInfo { Title = "InsightVerse API", Version = "v1" });
});

var corsOrigins = Environment.GetEnvironmentVariable("CORS_ORIGINS") ?? "http://localhost:5173";
builder.Services.AddCors(o => o.AddDefaultPolicy(p =>
{
    if (corsOrigins.Trim() == "*")
        p.AllowAnyOrigin().AllowAnyHeader().AllowAnyMethod();
    else
        p.WithOrigins(corsOrigins.Split(',', StringSplitOptions.RemoveEmptyEntries))
         .AllowAnyMethod().AllowAnyHeader();
}));

var connString = builder.Configuration.GetConnectionString("Default")
    ?? Environment.GetEnvironmentVariable("ConnectionStrings__Default")
    ?? "Host=db;Database=insightverse;Username=postgres;Password=postgres";
AppContext.SetSwitch("Npgsql.EnableLegacyTimestampBehavior", true);
builder.Services.AddSingleton(new Db(connString));

builder.Services.AddSingleton<PdfTextExtractor>();
builder.Services.AddSingleton<EmbeddingService>();
builder.Services.AddSingleton<LlmService>();
builder.Services.AddSingleton<RagService>();
builder.Services.AddSingleton<GraphService>();
builder.Services.AddSingleton<TimelineService>();

builder.Services.Configure<FormOptions>(o => o.MultipartBodyLengthLimit = 1024L * 1024L * 1024L);

var app = builder.Build();
app.UseCors();

// minimal API access log
app.Use(async (ctx, next) =>
{
    if ((ctx.Request.Path.Value ?? "").StartsWith("/api"))
    {
        app.Logger.LogInformation("{method} {path}", ctx.Request.Method, ctx.Request.Path);
    }
    await next();
});

app.MapGet("/health", () => Results.Json(new { status = "ok", service = "api" }));
app.UseSwagger();
app.UseSwaggerUI(c => c.SwaggerEndpoint("/swagger/v1/swagger.json", "InsightVerse API v1"));

// helpers
static string ToVectorLiteral(float[] v) => "[" + string.Join(",", v.Select(x => x.ToString(CultureInfo.InvariantCulture))) + "]";
static string CleanText(string s)
{
    if (string.IsNullOrEmpty(s)) return string.Empty;
    var sb = new StringBuilder(s.Length);
    foreach (var ch in s)
    {
        if (ch == '\0') continue; // NUL not allowed in PG
        if (char.IsControl(ch) && ch != '\r' && ch != '\n' && ch != '\t') continue;
        sb.Append(ch);
    }
    return Regex.Replace(sb.ToString(), @"\s+", " ").Trim();
}

// ====== ingest (upload) ======
app.MapPost("/api/ingest", async (HttpRequest req, Db db, PdfTextExtractor pdf, EmbeddingService embed) =>
{
    try
    {
        if (!req.HasFormContentType)
            return Results.BadRequest(new { error = "multipart/form-data required" });

        var form = await req.ReadFormAsync();
        var files = form.Files;
        if (files.Count == 0) return Results.BadRequest(new { error = "Upload at least one PDF" });

        var docIds = new List<Guid>();
        foreach (var f in files)
        {
            if (!f.FileName.EndsWith(".pdf", StringComparison.OrdinalIgnoreCase))
                return Results.BadRequest(new { error = "Only PDF supported" });

            using var stream = f.OpenReadStream();
            var text = pdf.Extract(stream);

            var docId = Guid.NewGuid();
            await db.ExecuteAsync(
                "INSERT INTO documents(id, source, title, token_count) VALUES (@id,@src,@title,@tok)",
                new { id = docId, src = f.FileName, title = Path.GetFileNameWithoutExtension(f.FileName), tok = text.Length });

            var chunkSize = int.Parse(Environment.GetEnvironmentVariable("CHUNK_TOKENS") ?? "800") * 4;
            var overlap = int.Parse(Environment.GetEnvironmentVariable("CHUNK_OVERLAP") ?? "120") * 4;

            int idx = 0;
            for (int start = 0; start < text.Length; start += Math.Max(1, (chunkSize - overlap)))
            {
                var len = Math.Min(chunkSize, text.Length - start);
                var chunkText = CleanText(text.Substring(start, len));
                var vec = await embed.EmbedAsync(chunkText);
                var embLit = ToVectorLiteral(vec);

                await db.ExecuteAsync(
                    "INSERT INTO chunks(id, document_id, idx, text, embedding) VALUES (@id,@doc,@idx,@txt, CAST(@emb AS vector))",
                    new { id = Guid.NewGuid(), doc = docId, idx = idx++, txt = chunkText, emb = embLit });

                if (start + len >= text.Length) break;
            }
            docIds.Add(docId);
        }
        app.Logger.LogInformation("Ingested {n} doc(s) via upload", docIds.Count);
        return Results.Ok(new { ingested = docIds.Count, documentIds = docIds });
    }
    catch (Exception ex)
    {
        app.Logger.LogError(ex, "Error in /api/ingest");
        return Results.Problem(title: "ingest_failed", detail: ex.Message, statusCode: 500);
    }
});

// ====== ingest (filesystem) ======
app.MapPost("/api/ingest/fs", async (Db db, PdfTextExtractor pdf, EmbeddingService embed) =>
{
    try
    {
        var folder = Environment.GetEnvironmentVariable("FS_INGEST_FOLDER") ?? "/data/pdfs";
        if (!Directory.Exists(folder)) return Results.BadRequest(new { error = $"No folder: {folder}" });

        var paths = Directory.GetFiles(folder, "*.pdf", SearchOption.TopDirectoryOnly);
        if (paths.Length == 0) return Results.BadRequest(new { error = $"No PDFs found in {folder}" });

        var docIds = new List<Guid>();
        foreach (var path in paths)
        {
            using var fs = File.OpenRead(path);
            var text = pdf.Extract(fs);

            var docId = Guid.NewGuid();
            await db.ExecuteAsync(
                "INSERT INTO documents(id, source, title, token_count) VALUES (@id,@src,@title,@tok)",
                new { id = docId, src = Path.GetFileName(path), title = Path.GetFileNameWithoutExtension(path), tok = text.Length });

            var chunkSize = int.Parse(Environment.GetEnvironmentVariable("CHUNK_TOKENS") ?? "800") * 4;
            var overlap = int.Parse(Environment.GetEnvironmentVariable("CHUNK_OVERLAP") ?? "120") * 4;

            int idx = 0;
            for (int start = 0; start < text.Length; start += Math.Max(1, (chunkSize - overlap)))
            {
                var len = Math.Min(chunkSize, text.Length - start);
                var chunkText = CleanText(text.Substring(start, len));
                var vec = await embed.EmbedAsync(chunkText);
                var embLit = ToVectorLiteral(vec);

                await db.ExecuteAsync(
                    "INSERT INTO chunks(id, document_id, idx, text, embedding) VALUES (@id,@doc,@idx,@txt, CAST(@emb AS vector))",
                    new { id = Guid.NewGuid(), doc = docId, idx = idx++, txt = chunkText, emb = embLit });

                if (start + len >= text.Length) break;
            }
            docIds.Add(docId);
        }
        app.Logger.LogInformation("Ingested {n} doc(s) from disk", docIds.Count);
        return Results.Ok(new { ingested = docIds.Count, documentIds = docIds, folder = Environment.GetEnvironmentVariable("FS_INGEST_FOLDER") ?? "/data/pdfs" });
    }
    catch (Exception ex)
    {
        app.Logger.LogError(ex, "Error in /api/ingest/fs");
        return Results.Problem(title: "ingest_fs_failed", detail: ex.Message, statusCode: 500);
    }
});

// ====== docs ======
app.MapGet("/api/docs", async (Db db) =>
{
    try
    {
        var docs = await db.QueryAsync("SELECT id, source, title, created_at, token_count FROM documents ORDER BY created_at DESC");
        return Results.Ok(new { docs });
    }
    catch (Exception ex)
    {
        return Results.Problem(title: "docs_failed", detail: ex.Message, statusCode: 500);
    }
});

// NEW: delete one document (+ cascade chunks)
app.MapDelete("/api/docs/{id:guid}", async (Db db, Guid id) =>
{
    try
    {
        // delete chunks first then document
        await db.ExecuteAsync("DELETE FROM chunks WHERE document_id=@d", new { d = id });
        var n = await db.ExecuteAsync("DELETE FROM documents WHERE id=@d", new { d = id });
        return Results.Ok(new { deleted = n, id });
    }
    catch (Exception ex)
    {
        return Results.Problem(title: "delete_failed", detail: ex.Message, statusCode: 500);
    }
});

// NEW: reset all (truncate)
app.MapPost("/api/reset", async (Db db) =>
{
    try
    {
        await db.ExecuteAsync("TRUNCATE TABLE chunks, documents RESTART IDENTITY CASCADE");
        return Results.Ok(new { reset = true });
    }
    catch (Exception ex)
    {
        return Results.Problem(title: "reset_failed", detail: ex.Message, statusCode: 500);
    }
});

// ====== search ======
app.MapPost("/api/search", async (Db db, EmbeddingService embed, SearchRequest req) =>
{
    try
    {
        if (string.IsNullOrWhiteSpace(req.Query)) return Results.BadRequest(new { error = "Query is required" });
        var v = await embed.EmbedAsync(req.Query);
        var vLit = ToVectorLiteral(v);
        var topK = req.TopK <= 0 ? 8 : Math.Min(req.TopK, 50);

        const string sql = @"
            SELECT c.document_id, c.idx, c.text, 1 - (c.embedding <=> CAST(@v AS vector)) AS score
            FROM   chunks c
            ORDER  BY c.embedding <=> CAST(@v AS vector)
            LIMIT  @k";
        var hits = await db.QueryAsync<SearchHit>(sql, new { v = vLit, k = topK });
        return Results.Ok(new { hits });
    }
    catch (Exception ex)
    {
        return Results.Problem(title: "search_failed", detail: ex.Message, statusCode: 500);
    }
});

// ====== chat (RAG) ======
app.MapPost("/api/chat", async (Db db, EmbeddingService embed, LlmService llm, RagService rag, ChatRequest req) =>
{
    try
    {
        if (string.IsNullOrWhiteSpace(req.Query)) return Results.BadRequest(new { error = "Query is required" });

        var v = await embed.EmbedAsync(req.Query);
        var vLit = ToVectorLiteral(v);

        var rows = await db.QueryAsync<string>(
            @"SELECT c.text FROM chunks c ORDER BY c.embedding <=> CAST(@v AS vector) LIMIT 6",
            new { v = vLit });

        var context = string.Join("\n\n---\n\n", rows);
        var prompt = rag.BuildPrompt(context, req.Query, req.Style);
        var answer = await llm.GenerateAsync(prompt);

        return Results.Ok(new { answer, used = rows.Count(), prompt });
    }
    catch (Exception ex)
    {
        return Results.Problem(title: "chat_failed", detail: ex.Message, statusCode: 500);
    }
});

// ====== graph/timeline ======
app.MapGet("/api/graph/{documentId:guid}", async (Db db, Guid documentId, GraphService graph) =>
{
    try
    {
        var chunks = await db.QueryAsync<string>("SELECT text FROM chunks WHERE document_id=@d ORDER BY idx", new { d = documentId });
        var (nodes, edges) = graph.BuildCoOccurrence(chunks.ToList());
        return Results.Ok(new { nodes, edges });
    }
    catch (Exception ex)
    {
        return Results.Problem(title: "graph_failed", detail: ex.Message, statusCode: 500);
    }
});

app.MapGet("/api/timeline/{documentId:guid}", async (Db db, Guid documentId, TimelineService tl, LlmService llm) =>
{
    try
    {
        var chunks = await db.QueryAsync<string>("SELECT text FROM chunks WHERE document_id=@d ORDER BY idx", new { d = documentId });
        var events = await tl.ExtractTimelineAsync(chunks.ToList(), llm);
        return Results.Ok(new { events });
    }
    catch (Exception ex)
    {
        return Results.Problem(title: "timeline_failed", detail: ex.Message, statusCode: 500);
    }
});

app.Run();

// === records & DB ===
public record SearchRequest(string Query, int TopK);
public record ChatRequest(string Query, string? Style);
public record SearchHit(Guid document_id, int idx, string text, double score);

public class Db
{
    private readonly string _conn;
    public Db(string c) => _conn = c;

    public async Task<int> ExecuteAsync(string sql, object? p = null)
    {
        await using var conn = new NpgsqlConnection(_conn);
        return await conn.ExecuteAsync(sql, p);
    }

    public async Task<IEnumerable<T>> QueryAsync<T>(string sql, object? p = null)
    {
        await using var conn = new NpgsqlConnection(_conn);
        return await conn.QueryAsync<T>(sql, p);
    }

    public async Task<IEnumerable<dynamic>> QueryAsync(string sql, object? p = null)
    {
        await using var conn = new NpgsqlConnection(_conn);
        return await conn.QueryAsync(sql, p);
    }
}
