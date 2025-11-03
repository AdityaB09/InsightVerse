# build
FROM mcr.microsoft.com/dotnet/sdk:8.0 AS build
WORKDIR /src
COPY InsightVerse.Api.csproj .
RUN dotnet restore
COPY . .
RUN dotnet publish -c Release -o /out

# run
FROM mcr.microsoft.com/dotnet/aspnet:8.0
WORKDIR /app
COPY --from=build /out .
EXPOSE 8080
ENTRYPOINT ["dotnet", "InsightVerse.Api.dll"]
