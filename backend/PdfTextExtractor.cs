using UglyToad.PdfPig;
using UglyToad.PdfPig.Content;
using System.Text;
using System.Text.RegularExpressions;

public class PdfTextExtractor
{
    private static readonly Regex MultiSpace = new(@"\s+", RegexOptions.Compiled);

    public string Extract(Stream pdfStream)
    {
        using var ms = new MemoryStream();
        pdfStream.CopyTo(ms);
        ms.Position = 0;

        var sb = new StringBuilder(1 << 20);
        using (var doc = PdfDocument.Open(ms))
        {
            foreach (var page in doc.GetPages())
            {
                sb.AppendLine(ExtractPage(page));
                sb.AppendLine("\n--- PAGE BREAK ---\n");
            }
        }

        return CleanText(sb.ToString());
    }

    private static string ExtractPage(Page page)
    {
        var sb = new StringBuilder(page.Letters.Count + 128);
        foreach (var w in page.GetWords())
        {
            sb.Append(w.Text);
            sb.Append(' ');
        }
        return sb.ToString();
    }

    // Remove NULs and non-printable controls (keep \r \n \t)
    private static string CleanText(string s)
    {
        if (string.IsNullOrEmpty(s)) return string.Empty;

        var sb = new StringBuilder(s.Length);
        foreach (var ch in s)
        {
            if (ch == '\0') continue; // PostgreSQL forbids NUL
            if (char.IsControl(ch) && ch != '\r' && ch != '\n' && ch != '\t') continue;
            sb.Append(ch);
        }
        // collapse crazy whitespace
        return MultiSpace.Replace(sb.ToString(), " ").Trim();
    }
}
