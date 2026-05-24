using System;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;
using Orders.Infrastructure.Persistence;

#nullable disable

namespace Orders.Infrastructure.Migrations
{
    [DbContext(typeof(OrdersDbContext))]
    [Migration("20260523040000_OrderAssignmentImportFlow")]
    public partial class OrderAssignmentImportFlow : Migration
    {
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "OrderAssignmentImportJobs",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    FileName = table.Column<string>(type: "nvarchar(256)", maxLength: 256, nullable: false),
                    FileContent = table.Column<byte[]>(type: "varbinary(max)", nullable: false),
                    Status = table.Column<int>(type: "int", nullable: false),
                    TotalCellsRead = table.Column<int>(type: "int", nullable: false),
                    ValidCells = table.Column<int>(type: "int", nullable: false),
                    InvalidCells = table.Column<int>(type: "int", nullable: false),
                    InsertedCount = table.Column<int>(type: "int", nullable: false),
                    UpdatedCount = table.Column<int>(type: "int", nullable: false),
                    CreatedAtUtc = table.Column<DateTime>(type: "datetime2", nullable: false),
                    StartedAtUtc = table.Column<DateTime>(type: "datetime2", nullable: true),
                    CompletedAtUtc = table.Column<DateTime>(type: "datetime2", nullable: true),
                    LastError = table.Column<string>(type: "nvarchar(max)", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_OrderAssignmentImportJobs", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "OrderAssignmentImportRows",
                columns: table => new
                {
                    Id = table.Column<long>(type: "bigint", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    JobId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    UserKey = table.Column<string>(type: "nvarchar(128)", maxLength: 128, nullable: false),
                    OrderId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    AssignedValue = table.Column<decimal>(type: "decimal(18,2)", precision: 18, scale: 2, nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_OrderAssignmentImportRows", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "OrderAssignments",
                columns: table => new
                {
                    UserKey = table.Column<string>(type: "nvarchar(128)", maxLength: 128, nullable: false),
                    OrderId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    AssignedValue = table.Column<decimal>(type: "decimal(18,2)", precision: 18, scale: 2, nullable: false),
                    UpdatedAtUtc = table.Column<DateTime>(type: "datetime2", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_OrderAssignments", x => new { x.UserKey, x.OrderId });
                });

            migrationBuilder.CreateIndex(
                name: "IX_OrderAssignmentImportRows_JobId",
                table: "OrderAssignmentImportRows",
                column: "JobId");
        }

        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "OrderAssignmentImportJobs");

            migrationBuilder.DropTable(
                name: "OrderAssignmentImportRows");

            migrationBuilder.DropTable(
                name: "OrderAssignments");
        }
    }
}
