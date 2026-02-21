FROM mcr.microsoft.com/dotnet/aspnet:8.0 AS base
WORKDIR /app
EXPOSE 8080
RUN apt-get update && apt-get install -y --no-install-recommends curl && rm -rf /var/lib/apt/lists/*

FROM mcr.microsoft.com/dotnet/sdk:8.0 AS build
WORKDIR /src
COPY ["vexel-pdf.csproj", "."]
RUN dotnet restore "./vexel-pdf.csproj"
COPY . .
RUN dotnet build "vexel-pdf.csproj" -c Release -o /app/build

FROM build AS publish
RUN dotnet publish "vexel-pdf.csproj" -c Release -o /app/publish

FROM base AS final
WORKDIR /app
COPY --from=publish /app/publish .
ENV ASPNETCORE_URLS=http://+:8080
ENTRYPOINT ["dotnet", "VexelPdf.dll"]
