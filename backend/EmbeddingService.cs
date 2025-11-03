using System.Net.Http.Headers;
using System.Text;
using System.Text.Json;

public class EmbeddingService
{
    private readonly HttpClient _http = new();
    private readonly string _provider = Environment.GetEnvironmentVariable("EMBEDDING_PROVIDER") ?? "openai";

    public async Task<float[]> EmbedAsync(string text)
    {
        try
        {
            if (_provider.Equals("openai", StringComparison.OrdinalIgnoreCase))
            {
                var key = Environment.GetEnvironmentVariable("OPENAI_API_KEY") ?? "";
                if (string.IsNullOrWhiteSpace(key))
                    return FakeEmbed(text); // no key -> local

                _http.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", key);
                var body = JsonSerializer.Serialize(new
                {
                    input = text,
                    model = "text-embedding-3-small"
                });
                var resp = await _http.PostAsync("https://api.openai.com/v1/embeddings",
                    new StringContent(body, Encoding.UTF8, "application/json"));

                if (!resp.IsSuccessStatusCode)
                    return FakeEmbed(text); // network/HTTP error -> local

                var raw = await resp.Content.ReadAsStringAsync();
                using var json = JsonDocument.Parse(raw);

                if (!json.RootElement.TryGetProperty("data", out var dataEl) || dataEl.GetArrayLength() == 0)
                    return FakeEmbed(text); // unexpected schema -> local

                var arr = dataEl[0].GetProperty("embedding");
                return arr.EnumerateArray().Select(x => x.GetSingle()).ToArray();
            }

            // other providers can be added here

            return FakeEmbed(text); // default local
        }
        catch
        {
            return FakeEmbed(text); // absolute fallback
        }
    }

    private float[] FakeEmbed(string text)
    {
        var vec = new float[1536];
        unchecked
        {
            int i = 0;
            foreach (var c in text)
            {
                vec[i % vec.Length] += (c % 13) / 13f;
                i++;
            }
        }
        var norm = MathF.Sqrt(vec.Sum(v => v * v));
        if (norm > 0) for (int i = 0; i < vec.Length; i++) vec[i] /= norm;
        return vec;
    }
}
