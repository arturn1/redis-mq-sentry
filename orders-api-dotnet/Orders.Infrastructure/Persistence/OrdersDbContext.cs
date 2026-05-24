using Microsoft.EntityFrameworkCore;
using Orders.Domain.Entities;

namespace Orders.Infrastructure.Persistence;

public class OrdersDbContext : DbContext
{
    public OrdersDbContext(DbContextOptions<OrdersDbContext> options) : base(options)
    {
    }

    public DbSet<Order> Orders => Set<Order>();
    public DbSet<OutboxMessage> OutboxMessages => Set<OutboxMessage>();
    public DbSet<OrderSagaState> OrderSagaStates => Set<OrderSagaState>();
    public DbSet<OrderEventStoreEntry> OrderEventStoreEntries => Set<OrderEventStoreEntry>();
    public DbSet<OrderAssignment> OrderAssignments => Set<OrderAssignment>();
    public DbSet<OrderAssignmentImportJob> OrderAssignmentImportJobs => Set<OrderAssignmentImportJob>();
    public DbSet<OrderAssignmentImportRow> OrderAssignmentImportRows => Set<OrderAssignmentImportRow>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        base.OnModelCreating(modelBuilder);

        modelBuilder.Entity<OrderAssignment>(entity =>
        {
            entity.HasKey(x => new { x.UserKey, x.OrderId });
            entity.Property(x => x.UserKey).HasMaxLength(128);
            entity.Property(x => x.AssignedValue).HasPrecision(18, 2);
        });

        modelBuilder.Entity<OrderAssignmentImportJob>(entity =>
        {
            entity.HasKey(x => x.Id);
            entity.Property(x => x.FileName).HasMaxLength(256);
        });

        modelBuilder.Entity<OrderAssignmentImportRow>(entity =>
        {
            entity.HasKey(x => x.Id);
            entity.Property(x => x.Id).ValueGeneratedOnAdd();
            entity.Property(x => x.UserKey).HasMaxLength(128);
            entity.Property(x => x.AssignedValue).HasPrecision(18, 2);
            entity.HasIndex(x => x.JobId);
        });
    }
}
