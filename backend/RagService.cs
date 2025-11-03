public class RagService
{
    public string BuildPrompt(string context, string question, string? style)
    {
        var tone = style switch
        {
            "bullets" => "Respond in concise bullet points.",
            "concise" => "Respond in 3-4 short sentences.",
            _ => "Respond clearly with citations to snippets when possible."
        };

        return $@"
You are an assistant answering based only on the Context below.

Context:
-------
{context}
-------

Question: {question}

{tone}";
    }
}
