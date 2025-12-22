using AudioStreamingService;
using Serilog;
using Microsoft.AspNetCore.Mvc;

var builder = WebApplication.CreateBuilder(args);

// 1. Setup Serilog
Log.Logger = new LoggerConfiguration()
    .MinimumLevel.Information()
    .MinimumLevel.Override("Microsoft", Serilog.Events.LogEventLevel.Warning)
    .MinimumLevel.Override("Microsoft.Hosting.Lifetime", Serilog.Events.LogEventLevel.Information) // Keep startup/shutdown logs
    .WriteTo.Console()
    .WriteTo.File(Path.Combine(AppDomain.CurrentDomain.BaseDirectory, "service.log"), rollingInterval: RollingInterval.Day)
    .CreateLogger();

builder.Host.UseSerilog();

// 2. Register Services
builder.Services.AddSingleton<AudioStreamingWorker>();
// Register as HostedService to run in background
builder.Services.AddHostedService(sp => sp.GetRequiredService<AudioStreamingWorker>());

// 3. Configure Kestrel
builder.WebHost.ConfigureKestrel(options =>
{
    // Bind to port 8001 (Legacy compatibility)
    options.ListenLocalhost(8001);
});

// 4. Add CORS
builder.Services.AddCors();

var app = builder.Build();

// 5. Middleware
app.UseCors(policy => policy
    .AllowAnyOrigin() // In production, restrict this
    .AllowAnyMethod()
    .AllowAnyHeader());

// 6. API Endpoints
// GET /status
app.MapGet("/api/audio-service/status", (AudioStreamingWorker worker) => 
    Results.Ok(worker.GetStatus()));

// GET /devices
app.MapGet("/api/audio-service/devices", (AudioStreamingWorker worker) => 
    Results.Ok(new { devices = worker.GetDevices() }));

// POST /start
app.MapPost("/api/audio-service/start", async (AudioStreamingWorker worker, [FromBody] StartStreamingRequest request) =>
{
    try
    {
        // Require API Key
        if (string.IsNullOrEmpty(request.ApiKey))
        {
             return Results.BadRequest(new { error = "AssemblyAI API key is required" });
        }

        worker.SetConfiguration(
            request.ApiKey, 
            request.Language, 
            request.Keyterms, 
            request.SessionId, 
            request.MicrophoneDeviceId, 
            request.SystemDeviceId
        );
        
        await worker.StartStreamingAsync();
        return Results.Ok(new { success = true, message = "Streaming started" });
    }
    catch (Exception ex)
    {
        Log.Error(ex, "Failed to start streaming");
        return Results.Json(new { error = ex.Message, details = ex.ToString() }, statusCode: 500);
    }
});

// POST /stop
app.MapPost("/api/audio-service/stop", (AudioStreamingWorker worker) =>
{
    try
    {
        worker.StopStreaming();
        return Results.Ok(new { success = true, message = "Streaming stopped" });
    }
    catch (Exception ex)
    {
        return Results.Json(new { error = ex.Message }, statusCode: 500);
    }
});

// PUT /device
app.MapPut("/api/audio-service/device", async (AudioStreamingWorker worker, [FromBody] SetDeviceRequest request) =>
{
    try
    {
        if (string.IsNullOrEmpty(request.DeviceId))
        {
            return Results.BadRequest(new { error = "DeviceId is required" });
        }

        await worker.UpdateMicrophoneDevice(request.DeviceId);
        return Results.Ok(new { success = true, deviceId = request.DeviceId });
    }
    catch (Exception ex)
    {
        Log.Error(ex, "Failed to update device");
        return Results.Json(new { error = ex.Message }, statusCode: 500);
    }
});

// POST /gain
app.MapPost("/api/audio-service/gain", (AudioStreamingWorker worker, [FromBody] GainRequest request) =>
{
    worker.SetGain(request.Gain);
    return Results.Ok(new { success = true, gain = request.Gain });
});

// POST /test/start
app.MapPost("/api/audio-service/test/start", async (AudioStreamingWorker worker, [FromBody] StartTestRequest request) =>
{
    try
    {
        var path = request.FilePath;
        if (string.IsNullOrEmpty(path))
        {
             // Default to generic test location
             path = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.MyDocuments), "ULTRA_Assistant_AudioTest.wav");
        }
        
        // Try to load API Key from Environment if not already set in worker
        var apiKey = Environment.GetEnvironmentVariable("ASSEMBLYAI_API_KEY");
        if (!string.IsNullOrEmpty(apiKey))
        {
             // Pre-configure worker with API Key for test
             // We pass null for others to preserve/reset as needed, or we just rely on the SetConfiguration behavior
             // Actually SetConfiguration overwrites everything. 
             // Let's assume for Test Mode we only care about the Key and Devices.
             worker.SetConfiguration(apiKey, "pt", request.Keyterms, "TEST_SESSION", request.MicrophoneDeviceId, request.SystemDeviceId);
        }
        else
        {
             Log.Warning("ASSEMBLYAI_API_KEY not found in environment variables. Test will proceed without transcription.");
        }
        
        await worker.StartTestRecordingAsync(path, request.MicrophoneDeviceId, request.SystemDeviceId, request.TranscriptionService);
        return Results.Ok(new { success = true, path = path, message = "Test Recording Started" });
    }
    catch (Exception ex)
    {
         Log.Error(ex, "Failed to start test recording");
         return Results.Json(new { error = ex.Message, details = ex.ToString() }, statusCode: 500);
    }
});

// POST /test/stop
app.MapPost("/api/audio-service/test/stop", (AudioStreamingWorker worker) =>
{
    try
    {
        worker.StopTestRecording();
        return Results.Ok(new { success = true, message = "Test Recording Stopped" });
    }
    catch (Exception ex)
    {
         return Results.Json(new { error = ex.Message }, statusCode: 500);
    }
});

Log.Information("Audio Streaming Service (ASP.NET Core) starting on port 8001...");

try 
{
    await app.RunAsync();
}
catch (Exception ex)
{
    Log.Fatal(ex, "Service terminated unexpectedly");
}
finally
{
    Log.CloseAndFlush();
}

// DTOs
public record StartStreamingRequest(
    string? ApiKey, 
    string? Language, 
    List<string>? Keyterms, 
    string? SessionId,
    string? MicrophoneDeviceId,
    string? SystemDeviceId
);

public record StartTestRequest(string? FilePath, string? MicrophoneDeviceId, string? SystemDeviceId, List<string>? Keyterms, string? TranscriptionService);
public record SetDeviceRequest(string DeviceId);
public record GainRequest(float Gain);
