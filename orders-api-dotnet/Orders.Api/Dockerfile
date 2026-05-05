FROM mcr.microsoft.com/dotnet/sdk:8.0 AS build
WORKDIR /src

COPY Orders.Domain/Orders.Domain.csproj Orders.Domain/
COPY Orders.Application/Orders.Application.csproj Orders.Application/
COPY Orders.Infrastructure/Orders.Infrastructure.csproj Orders.Infrastructure/
COPY Orders.Api/Orders.Api.csproj Orders.Api/
RUN dotnet restore Orders.Api/Orders.Api.csproj

COPY . .
RUN dotnet publish Orders.Api/Orders.Api.csproj -c Release -o /app/publish /p:UseAppHost=false

FROM mcr.microsoft.com/dotnet/aspnet:8.0 AS final
WORKDIR /app
COPY --from=build /app/publish .

EXPOSE 8080
ENV ASPNETCORE_URLS=http://+:8080
ENTRYPOINT ["dotnet", "Orders.Api.dll"]
