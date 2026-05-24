namespace Orders.Domain.Entities;

public enum OrderAssignmentImportStatus
{
    Pending = 1,
    Processing = 2,
    Completed = 3,
    Failed = 4,
}

public class OrderAssignmentImportJob
{
    public Guid Id { get; set; }
    public string FileName { get; set; } = string.Empty;
    public byte[] FileContent { get; set; } = Array.Empty<byte>();
    public OrderAssignmentImportStatus Status { get; set; }
    public int TotalCellsRead { get; set; }
    public int ValidCells { get; set; }
    public int InvalidCells { get; set; }
    public int InsertedCount { get; set; }
    public int UpdatedCount { get; set; }
    public DateTime CreatedAtUtc { get; set; }
    public DateTime? StartedAtUtc { get; set; }
    public DateTime? CompletedAtUtc { get; set; }
    public string? LastError { get; set; }
}
