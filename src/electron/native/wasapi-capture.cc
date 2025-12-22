/**
 * WASAPI Loopback Capture Native Addon for Windows
 * Uses Windows Audio Session API (WASAPI) to capture system audio
 */

#include <napi.h>
#include <windows.h>
#include <mmdeviceapi.h>
#include <audioclient.h>
#include <functiondiscoverykeys_devpkey.h>
#include <stdio.h>
#include <thread>
#include <atomic>

#pragma comment(lib, "ole32.lib")
#pragma comment(lib, "oleaut32.lib")

const CLSID CLSID_MMDeviceEnumerator = __uuidof(MMDeviceEnumerator);
const IID IID_IMMDeviceEnumerator = __uuidof(IMMDeviceEnumerator);
const IID IID_IAudioClient = __uuidof(IAudioClient);
const IID IID_IAudioCaptureClient = __uuidof(IAudioCaptureClient);

class WASAPICapture : public Napi::ObjectWrap<WASAPICapture> {
public:
    static Napi::Object Init(Napi::Env env, Napi::Object exports);
    WASAPICapture(const Napi::CallbackInfo& info);
    ~WASAPICapture();

private:
    static Napi::Value Start(const Napi::CallbackInfo& info);
    static Napi::Value Stop(const Napi::CallbackInfo& info);
    static Napi::Value IsCapturing(const Napi::CallbackInfo& info);
    
    void StartCapture();
    void StopCapture();
    
    IMMDeviceEnumerator* pEnumerator;
    IMMDevice* pDevice;
    IAudioClient* pAudioClient;
    IAudioCaptureClient* pCaptureClient;
    WAVEFORMATEX* pwfx;
    
    std::thread captureThread;
    std::atomic<bool> isCapturing;
    std::atomic<bool> shouldStop;
    
    Napi::ThreadSafeFunction tsfn;
    Napi::FunctionReference onDataCallback;
    Napi::FunctionReference onErrorCallback;
    
    UINT32 bufferFrameCount;
    HANDLE hEvent;
    
    static void CaptureThread(WASAPICapture* self);
};

Napi::Object WASAPICapture::Init(Napi::Env env, Napi::Object exports) {
    Napi::Function func = DefineClass(env, "WASAPICapture", {
        InstanceMethod("start", &WASAPICapture::Start),
        InstanceMethod("stop", &WASAPICapture::Stop),
        InstanceMethod("isCapturing", &WASAPICapture::IsCapturing),
    });
    
    exports.Set("WASAPICapture", func);
    return exports;
}

WASAPICapture::WASAPICapture(const Napi::CallbackInfo& info) 
    : Napi::ObjectWrap<WASAPICapture>(info),
      pEnumerator(nullptr),
      pDevice(nullptr),
      pAudioClient(nullptr),
      pCaptureClient(nullptr),
      pwfx(nullptr),
      isCapturing(false),
      shouldStop(false),
      bufferFrameCount(0),
      hEvent(nullptr) {
    
    Napi::Env env = info.Env();
    
    if (info.Length() < 2) {
        Napi::TypeError::New(env, "Expected onData and onError callbacks")
            .ThrowAsJavaScriptException();
        return;
    }
    
    if (!info[0].IsFunction() || !info[1].IsFunction()) {
        Napi::TypeError::New(env, "Callbacks must be functions")
            .ThrowAsJavaScriptException();
        return;
    }
    
    onDataCallback = Napi::Persistent(info[0].As<Napi::Function>());
    onErrorCallback = Napi::Persistent(info[1].As<Napi::Function>());
    
    // Initialize COM
    HRESULT hr = CoInitializeEx(NULL, COINIT_MULTITHREADED);
    if (FAILED(hr)) {
        Napi::Error::New(env, "Failed to initialize COM")
            .ThrowAsJavaScriptException();
        return;
    }
    
    // Create device enumerator
    hr = CoCreateInstance(
        CLSID_MMDeviceEnumerator,
        NULL,
        CLSCTX_ALL,
        IID_IMMDeviceEnumerator,
        (void**)&pEnumerator
    );
    
    if (FAILED(hr)) {
        CoUninitialize();
        Napi::Error::New(env, "Failed to create device enumerator")
            .ThrowAsJavaScriptException();
        return;
    }
    
    // Get default audio endpoint (playback device for loopback)
    hr = pEnumerator->GetDefaultAudioEndpoint(
        eRender,
        eConsole,
        &pDevice
    );
    
    if (FAILED(hr)) {
        pEnumerator->Release();
        CoUninitialize();
        Napi::Error::New(env, "Failed to get default audio endpoint")
            .ThrowAsJavaScriptException();
        return;
    }
    
    // Create audio client
    hr = pDevice->Activate(
        IID_IAudioClient,
        CLSCTX_ALL,
        NULL,
        (void**)&pAudioClient
    );
    
    if (FAILED(hr)) {
        pDevice->Release();
        pEnumerator->Release();
        CoUninitialize();
        Napi::Error::New(env, "Failed to activate audio client")
            .ThrowAsJavaScriptException();
        return;
    }
    
    // Get mix format
    hr = pAudioClient->GetMixFormat(&pwfx);
    if (FAILED(hr)) {
        pAudioClient->Release();
        pDevice->Release();
        pEnumerator->Release();
        CoUninitialize();
        Napi::Error::New(env, "Failed to get mix format")
            .ThrowAsJavaScriptException();
        return;
    }
    
    // Create event for capture
    hEvent = CreateEvent(NULL, FALSE, FALSE, NULL);
    if (hEvent == NULL) {
        CoTaskMemFree(pwfx);
        pAudioClient->Release();
        pDevice->Release();
        pEnumerator->Release();
        CoUninitialize();
        Napi::Error::New(env, "Failed to create event")
            .ThrowAsJavaScriptException();
        return;
    }
}

WASAPICapture::~WASAPICapture() {
    StopCapture();
    
    if (hEvent) CloseHandle(hEvent);
    if (pwfx) CoTaskMemFree(pwfx);
    if (pCaptureClient) pCaptureClient->Release();
    if (pAudioClient) pAudioClient->Release();
    if (pDevice) pDevice->Release();
    if (pEnumerator) pEnumerator->Release();
    
    CoUninitialize();
}

Napi::Value WASAPICapture::Start(const Napi::CallbackInfo& info) {
    Napi::Env env = info.Env();
    
    if (isCapturing) {
        return Napi::Boolean::New(env, true);
    }
    
    // Initialize audio client for loopback
    HRESULT hr = pAudioClient->Initialize(
        AUDCLNT_SHAREMODE_SHARED,
        AUDCLNT_STREAMFLAGS_LOOPBACK,
        0,
        0,
        pwfx,
        NULL
    );
    
    if (FAILED(hr)) {
        std::string error = "Failed to initialize audio client: " + std::to_string(hr);
        onErrorCallback.Call({Napi::String::New(env, error)});
        return Napi::Boolean::New(env, false);
    }
    
    // Get buffer size
    hr = pAudioClient->GetBufferSize(&bufferFrameCount);
    if (FAILED(hr)) {
        onErrorCallback.Call({Napi::String::New(env, "Failed to get buffer size")});
        return Napi::Boolean::New(env, false);
    }
    
    // Get capture client
    hr = pAudioClient->GetService(
        IID_IAudioCaptureClient,
        (void**)&pCaptureClient
    );
    
    if (FAILED(hr)) {
        onErrorCallback.Call({Napi::String::New(env, "Failed to get capture client")});
        return Napi::Boolean::New(env, false);
    }
    
    // Start capture
    hr = pAudioClient->Start();
    if (FAILED(hr)) {
        pCaptureClient->Release();
        pCaptureClient = nullptr;
        onErrorCallback.Call({Napi::String::New(env, "Failed to start audio client")});
        return Napi::Boolean::New(env, false);
    }
    
    isCapturing = true;
    shouldStop = false;
    
    // Start capture thread
    captureThread = std::thread(CaptureThread, this);
    
    return Napi::Boolean::New(env, true);
}

Napi::Value WASAPICapture::Stop(const Napi::CallbackInfo& info) {
    Napi::Env env = info.Env();
    StopCapture();
    return Napi::Boolean::New(env, true);
}

Napi::Value WASAPICapture::IsCapturing(const Napi::CallbackInfo& info) {
    Napi::Env env = info.Env();
    return Napi::Boolean::New(env, isCapturing);
}

void WASAPICapture::StopCapture() {
    if (!isCapturing) return;
    
    shouldStop = true;
    
    if (pAudioClient) {
        pAudioClient->Stop();
    }
    
    if (captureThread.joinable()) {
        captureThread.join();
    }
    
    if (pCaptureClient) {
        pCaptureClient->Release();
        pCaptureClient = nullptr;
    }
    
    isCapturing = false;
}

void WASAPICapture::CaptureThread(WASAPICapture* self) {
    UINT32 packetLength = 0;
    BYTE* pData = nullptr;
    DWORD flags = 0;
    
    while (!self->shouldStop) {
        HRESULT hr = self->pCaptureClient->GetNextPacketSize(&packetLength);
        
        if (FAILED(hr)) {
            self->onErrorCallback.Call({
                Napi::String::New(self->tsfn.Env(), "Failed to get next packet size")
            });
            break;
        }
        
        while (packetLength > 0 && !self->shouldStop) {
            hr = self->pCaptureClient->GetBuffer(
                &pData,
                &packetLength,
                &flags,
                NULL,
                NULL
            );
            
            if (FAILED(hr)) {
                self->onErrorCallback.Call({
                    Napi::String::New(self->tsfn.Env(), "Failed to get buffer")
                });
                break;
            }
            
            if (!(flags & AUDCLNT_BUFFERFLAGS_SILENT)) {
                // Convert to PCM16 and send to JavaScript
                UINT32 dataSize = packetLength * self->pwfx->nBlockAlign;
                
                // Create buffer for JavaScript
                Napi::Buffer<uint8_t> buffer = Napi::Buffer<uint8_t>::New(
                    self->tsfn.Env(),
                    (uint8_t*)pData,
                    dataSize
                );
                
                // Call JavaScript callback
                self->onDataCallback.Call({buffer});
            }
            
            hr = self->pCaptureClient->ReleaseBuffer(packetLength);
            if (FAILED(hr)) {
                self->onErrorCallback.Call({
                    Napi::String::New(self->tsfn.Env(), "Failed to release buffer")
                });
                break;
            }
            
            hr = self->pCaptureClient->GetNextPacketSize(&packetLength);
            if (FAILED(hr)) {
                break;
            }
        }
        
        Sleep(10); // Small delay to prevent CPU spinning
    }
}

Napi::Object Init(Napi::Env env, Napi::Object exports) {
    return WASAPICapture::Init(env, exports);
}

NODE_API_MODULE(wasapi_capture, Init)




