namespace Orders.Domain.Entities;

public class OrderAssignmentImportRow
{
    public long Id { get; set; }
    public Guid JobId { get; set; }
    public string UserKey { get; set; } = string.Empty;
    public Guid OrderId { get; set; }
    public decimal AssignedValue { get; set; }
}
