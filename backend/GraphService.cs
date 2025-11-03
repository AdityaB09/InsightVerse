using System.Text.RegularExpressions;

public class GraphService
{
    private static readonly Regex WordRx = new(@"[A-Za-z][A-Za-z0-9\-]{3,}", RegexOptions.Compiled);

    public (List<Node> nodes, List<Edge> edges) BuildCoOccurrence(IList<string> texts, int window = 12)
    {
        var vocab = new Dictionary<string, int>();
        var co = new Dictionary<(int,int), int>();

        int idSeq = 0;
        foreach (var t in texts)
        {
            var tokens = WordRx.Matches(t.ToLowerInvariant()).Select(m => m.Value).ToList();
            for (int i = 0; i < tokens.Count; i++)
            {
                if (!vocab.TryGetValue(tokens[i], out var a))
                    vocab[tokens[i]] = a = idSeq++;

                for (int j = i + 1; j < Math.Min(tokens.Count, i + window); j++)
                {
                    if (!vocab.TryGetValue(tokens[j], out var b))
                        vocab[tokens[j]] = b = idSeq++;

                    var key = a < b ? (a, b) : (b, a);
                    co[key] = co.GetValueOrDefault(key) + 1;
                }
            }
        }

        var nodes = vocab.OrderByDescending(kv => kv.Value)
                         .Select(kv => new Node { id = kv.Value.ToString(), label = kv.Key, weight = 1 })
                         .ToList();

        var edges = co.Select(kv => new Edge {
            id = $"{kv.Key.Item1}-{kv.Key.Item2}",
            source = kv.Key.Item1.ToString(),
            target = kv.Key.Item2.ToString(),
            weight = kv.Value
        }).ToList();

        return (nodes, edges);
    }
}

public class Node { public string id { get; set; } = ""; public string label { get; set; } = ""; public float weight { get; set; } }
public class Edge { public string id { get; set; } = ""; public string source { get; set; } = ""; public string target { get; set; } = ""; public float weight { get; set; } }
