using System.Net.Http.Headers;
using System.Text;
using System.Text.Json;

public class LlmService
{
    private readonly HttpClient _http = new();
    private readonly string _provider = Environment.GetEnvironmentVariable("LLM_PROVIDER") ?? "openai";

    public async Task<string> GenerateAsync(string prompt)
    {
        try
        {
            if (_provider.Equals("openai", StringComparison.OrdinalIgnoreCase))
            {
                var key = Environment.GetEnvironmentVariable("OPENAI_API_KEY");
                if (string.IsNullOrWhiteSpace(key)) return LocalSummarize(prompt);

                _http.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", key);
                var body = JsonSerializer.Serialize(new
                {
                    model = "gpt-4o-mini",
                    messages = new[]
                    {
                        new { role = "system", content = "You are a concise research assistant." },
                        new { role = "user",   content = prompt }
                    },
                    temperature = 0.2
                });
                var resp = await _http.PostAsync("https://api.openai.com/v1/chat/completions",
                    new StringContent(body, Encoding.UTF8, "application/json"));

                if (!resp.IsSuccessStatusCode) return LocalSummarize(prompt);

                var raw = await resp.Content.ReadAsStringAsync();
                using var json = JsonDocument.Parse(raw);

                if (json.RootElement.TryGetProperty("choices", out var choices) &&
                    choices.GetArrayLength() > 0 &&
                    choices[0].TryGetProperty("message", out var msg) &&
                    msg.TryGetProperty("content", out var content))
                {
                    return content.GetString() ?? LocalSummarize(prompt);
                }
                return LocalSummarize(prompt);
            }

            // other providers can be added similarly; fallback if unknown
            return LocalSummarize(prompt);
        }
        catch
        {
            return LocalSummarize(prompt);
        }
    }

    // dumb but deterministic local summarizer
    private static string LocalSummarize(string prompt)
    {
        // take last ~1500 chars of the context in the prompt and compress
        var text = prompt.Length > 1500 ? prompt[^1500..] : prompt;
        var sentences = text.Split(new[] { '.', '!', '?' }, StringSplitOptions.RemoveEmptyEntries)
                            .Select(t => t.Trim())
                            .Where(t => t.Length > 0)
                            .Take(6);
        var bulletPoints = string.Join("\n- ", sentences);
        if (string.IsNullOrWhiteSpace(bulletPoints)) bulletPoints = "No content available to summarize.";
        return "Summary (local fallback):\n- " + bulletPoints;
    }
}
