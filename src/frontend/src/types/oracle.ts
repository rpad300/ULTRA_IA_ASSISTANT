
export type MessageType =
    | "audio"
    | "config"
    | "transcript"
    | "voice_identification"
    | "status"
    | "error"
    | "ping"
    | "pong"
    | "session_update"
    | "Begin"
    | "Turn"
    | "insight"
    | "telemetry"
    | "speaker_assignment"
    | "side_widgets_update";

export interface BaseMessage {
    type: MessageType;
    timestamp?: string;
    correlation_id?: string;
}

export interface WordLevelDetail {
    word: string;
    start: number;
    end: number;
    confidence: number;
    speaker?: string;
    stability: number;
}

export interface TranscriptMessage extends BaseMessage {
    type: "transcript";
    text: string;
    is_final: boolean;
    speaker: string;
    confidence: number;
    words?: WordLevelDetail[];
    trace_id?: string; // UUID of the speech segment
}

export interface InsightMessage extends BaseMessage {
    type: "insight";
    insight_type: "conflict" | "solution" | "action";
    text: string;
    confidence: number;
    trace_id?: string; // Links insight to a specific transcript bubble
    source_link?: string;
    related_fact?: string;
}

export interface TelemetryMessage extends BaseMessage {
    type: "telemetry";
    rms: number;
    db: number;
    is_clipping: boolean;
    snr: number;
    vad_prob: number;
}

export interface VoiceIdMessage extends BaseMessage {
    type: "voice_identification";
    contact_id?: string;
    contact_name: string;
    score: number;
    is_auto_created: boolean;
    is_overlap: boolean;
    trace_id: string;
}

export interface StatusMessage extends BaseMessage {
    type: "status";
    status: string;
    message: string;
    connection_id?: string;
    model?: string;
}

// Store Types
export interface SpeakerMap {
    [guestId: string]: string; // "Guest 1" -> "Pedro"
}

export interface ConnectionState {
    status: "disconnected" | "connecting" | "connected" | "error";
    latency: number;
    error?: string;
}
