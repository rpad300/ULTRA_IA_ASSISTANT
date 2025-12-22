from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any, Union
from datetime import datetime
from enum import Enum

class TrendDirection(str, Enum):
    UP = "up"
    DOWN = "down"
    NEUTRAL = "neutral"

class ActivityType(str, Enum):
    SESSION = "session"
    TASK = "task"
    THREAD = "thread"

# --- Shared Components ---

class WeeklyStats(BaseModel):
    this_week: int
    last_week: int
    trend: TrendDirection

class InsightItem(BaseModel):
    type: str = Field(..., description="Type of insight: trend, risk, info")
    title: str
    text: str
    confidence: Optional[int] = None

# --- Response Models ---

class MeetingInsightsResponse(BaseModel):
    total_meetings: int
    total_hours: float
    by_company: List[Dict[str, Any]] # Can be refined further if company stats structure is fixed
    weekly_stats: WeeklyStats
    decision_rate: float
    period_days: int

class TaskStatsResponse(BaseModel):
    total_tasks: int
    completed: int
    pending: int
    overdue: int
    completion_rate: float
    completed_on_time: int
    average_time_to_close: float
    period_days: int

class DashboardStatsResponse(BaseModel):
    meetings_this_week: int
    tasks_completed: int
    active_threads: int
    pending_decisions: int

class ActivityItem(BaseModel):
    id: str
    type: ActivityType
    text: str
    time: str
    project: str = "Unknown"

class ProjectInsightsResponse(BaseModel):
    project_id: str
    insights: List[InsightItem]
    stats: Dict[str, Any] # Flexible for project specific stats

class ContactStatsResponse(BaseModel):
    contact_id: str
    meetings_count: int
    tasks_count: int
    projects_in_common: int

class CoachingInsight(BaseModel):
    insights: List[str]
    suggestions: List[str]

class CoachingResponse(BaseModel):
    current_profile: str
    insights: Dict[str, CoachingInsight]
    note: Optional[str] = None

class ContactInteraction(BaseModel):
    type: str
    text: str
    date: str
    project: str
    sessionId: Optional[str] = None
    summary: Optional[str] = None
    status: Optional[str] = None

class ContactCommitment(BaseModel):
    id: str
    text: str
    status: str
    type: str
    date: Optional[str]
    priority: Optional[str]
    project: Optional[str]

class ContactTopic(BaseModel):
    topic: str
    mentions: int
    stance: str
