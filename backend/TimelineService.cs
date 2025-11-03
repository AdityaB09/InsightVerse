public class TimelineService
{
    public async Task<List<TimelineEvent>> ExtractTimelineAsync(IList<string> chunks, LlmService llm)
    {
        // Keep it simple: ask the LLM to return dated/ordered bullets.
        var joined = string.Join("\n\n", chunks.Take(6)); // sample to keep prompt short
        var prompt = @$"From the following document excerpts, extract a timeline of 6-10 key discoveries or events
in chronological order. If dates are absent, infer rough order. Return as JSON array with
fields: title, date (string), summary (1 sentence).

Text:
{joined}";

        var json = await llm.GenerateAsync(prompt);
        // If LLM returns plain text, wrap as a single event fallback.
        return TryParse(json);
    }

    private static List<TimelineEvent> TryParse(string s)
    {
        try
        {
            var events = System.Text.Json.JsonSerializer.Deserialize<List<TimelineEvent>>(s);
            return events ?? new();
        }
        catch
        {
            return new List<TimelineEvent> {
                new TimelineEvent { title="Summary", date="n/a", summary=s.Length>300 ? s[..300]+"..." : s }
            };
        }
    }
}

public class TimelineEvent { public string title { get; set; } = ""; public string date { get; set; } = ""; public string summary { get; set; } = ""; }
