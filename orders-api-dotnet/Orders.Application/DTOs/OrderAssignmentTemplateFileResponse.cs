namespace Orders.Application.DTOs;

public record OrderAssignmentTemplateFileResponse(
    string FileName,
    string ContentType,
    byte[] Content);
