export interface CrossMeetingPattern {
    id: string;
    description: string;
    confidence: number; // 0-1
    type: 'pattern' | 'contradiction' | 'insight';
    meetings: string[]; // IDs/Names of meetings
    relatedMeetings?: string[]; // Alias or additional info
    timestamp: number;
    relatedTopics: string[];
    affectedContacts: string[];
}

// Add other intelligence types as needed
export interface IntelligenceSliceState {
    crossMeetingPatterns: CrossMeetingPattern[];
    isAnalyzingPatterns: boolean;
}
