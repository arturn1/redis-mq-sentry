namespace Orders.Infrastructure.Messaging;

public class BullBoardOptions
{
    public const string SectionName = "BullBoard";

    public string BaseUrl { get; set; } = "http://bull-board-app:4000";
}
