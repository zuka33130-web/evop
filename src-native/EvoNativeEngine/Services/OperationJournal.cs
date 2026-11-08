namespace EvoNativeEngine.Services;

// Session-local change counter. Detects engine operations, not edits made by external apps.
public sealed class OperationJournal
{
    private long revision;
    public long Revision => Interlocked.Read(ref revision);
    public void Touch() => Interlocked.Increment(ref revision);
}
