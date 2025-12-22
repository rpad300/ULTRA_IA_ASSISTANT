import logging
import asyncio
from typing import Optional, List, Dict, Any
from datetime import datetime, timedelta
import json

from db.repositories.base_repository import BaseRepository
from services.intelligence_service import get_intelligence_service
from services.redis_service import get_redis_service
from schemas.analytics import (
    MeetingInsightsResponse, 
    TaskStatsResponse, 
    DashboardStatsResponse,
    ActivityItem, 
    ActivityType,
    CoachingResponse,
    WeeklyStats,
    TrendDirection,
    ContactStatsResponse,
    ProjectInsightsResponse,
    InsightItem,
    ContactInteraction,
    ContactCommitment,
    ContactTopic
)

logger = logging.getLogger(__name__)

class AnalyticsService:
    """
    Service for Aggregation, Insights and Reporting.
    Uses BaseRepository pattern for data access and IntelligenceService for AI insights.
    """
    
    def __init__(self):
        self.intelligence = get_intelligence_service()
        # Dependency injection for DB client is handled via global getter for now
        # to support the existing pattern, but methods will use get_async_supabase_client()

    async def _get_client(self):
        from db.supabase_client import get_async_supabase_client
        return await get_async_supabase_client()

    async def get_dashboard_stats(self, company_id: Optional[str], project_id: Optional[str]) -> DashboardStatsResponse:
        """
        Fetch dashboard stats using RPC if available, otherwise parallel client-side aggregation.
        Cached for 5 minutes.
        """
        # 0. Cache Lookup
        cache = await get_redis_service()
        cache_key = f"dashboard_stats:{company_id}:{project_id}"
        cached_data = await cache.get_json(cache_key)
        
        if cached_data:
            return DashboardStatsResponse(**cached_data)

        # Sanitize dev-company-id to None to avoid DB errors
        if company_id == "dev-company-id":
            company_id = None

        client = await self._get_client()
        stats = None
        
        # 1. Try RPC (Optimization)
        try:
            params = {}
            if company_id: params['filter_company_id'] = company_id
            if project_id: params['filter_project_id'] = project_id
            
            response = await client.rpc('get_dashboard_summary', params).execute()
            if response.data:
                stats = DashboardStatsResponse(**response.data)
        except Exception as e:
            logger.debug(f"RPC get_dashboard_summary failed (using fallback): {e}")

        # 2. Fallback: Parallel Fetching
        if not stats:
            try:
                week_start = datetime.now() - timedelta(days=datetime.now().weekday())
                week_start_iso = week_start.isoformat()
                
                # Prepare queries
                sessions_query = client.table("sessions").select("id", count="exact").gte("created_at", week_start_iso)
                tasks_query = client.table("tasks").select("id", count="exact").eq("status", "done").gte("updated_at", week_start_iso)
                threads_query = client.table("threads").select("id", count="exact").eq("status", "active")
                
                if company_id:
                    # Note: Sessions join filter difficult here without inner join syntax in count 
                    # so we stick to simpler counts or accept slight inaccuracy in fallback
                    tasks_query = tasks_query.eq("company_id", company_id)
                    threads_query = threads_query.eq("company_id", company_id)
                if project_id:
                    tasks_query = tasks_query.eq("project_id", project_id)
                    threads_query = threads_query.eq("project_id", project_id)

                # Execution
                t1 = sessions_query.execute()
                t2 = tasks_query.execute()
                t3 = threads_query.execute()
                
                r1, r2, r3 = await asyncio.gather(t1, t2, t3, return_exceptions=True)
                
                meetings = r1.count if not isinstance(r1, Exception) and r1.count else 0
                tasks = r2.count if not isinstance(r2, Exception) and r2.count else 0
                threads = r3.count if not isinstance(r3, Exception) and r3.count else 0
                
                stats = DashboardStatsResponse(
                    meetings_this_week=meetings,
                    tasks_completed=tasks,
                    active_threads=threads,
                    pending_decisions=0
                )
            except Exception as e:
                logger.error(f"Error in get_dashboard_stats fallback: {e}")
                raise e

        # 3. Set Cache (Async)
        if stats:
             await cache.set_json(cache_key, stats.model_dump(), ttl_seconds=300)
             
        return stats

    async def get_meetings_insights(self, company_id: Optional[str], project_id: Optional[str], days: int) -> MeetingInsightsResponse:
        """
        Get meeting statistics with RPC optimization.
        Cached for 60 minutes.
        """
        # 0. Cache Lookup
        cache = await get_redis_service()
        cache_key = f"meeting_insights:{company_id}:{project_id}:{days}"
        cached_data = await cache.get_json(cache_key)
        
        if cached_data:
            return MeetingInsightsResponse(**cached_data)

        # Sanitize dev-company-id
        if company_id == "dev-company-id":
            company_id = None

        client = await self._get_client()
        stats = None
        
        # 1. Try RPC
        try:
            params = {'filter_days': days}
            if company_id: params['filter_company_id'] = company_id
            if project_id: params['filter_project_id'] = project_id
            
            response = await client.rpc('get_meeting_stats', params).execute()
            if response.data:
                # Ensure by_company is a list
                data = response.data
                if data.get('by_company') is None:
                    data['by_company'] = []
                elif isinstance(data['by_company'], str):
                     # Handle potential double-escaped JSON
                     pass
                stats = MeetingInsightsResponse(**data)
        except Exception as e:
            logger.debug(f"RPC get_meeting_stats failed (using fallback): {e}")
            
        # 2. Fallback (Logic from Controller)
        # Simplified for brevity in planning, but ensures functionality
        cutoff = (datetime.now() - timedelta(days=days)).isoformat()
        
        query = client.table("sessions").select("*, threads!inner(company_id)").gte("created_at", cutoff)
        if company_id: query = query.eq("threads.company_id", company_id)
        if project_id: query = query.eq("threads.project_id", project_id)
        
        response = await query.execute()
        sessions = response.data or []
        
        total = len(sessions)
        hours = 0
        summary_count = 0
        by_company_map = {}
        
        week_start = datetime.now() - timedelta(days=7)
        this_week = 0
        last_week = 0
        
        for s in sessions:
            # Hours
            if s.get("started_at") and s.get("ended_at"):
                try:
                    start = datetime.fromisoformat(s["started_at"].replace('Z', '+00:00'))
                    end = datetime.fromisoformat(s["ended_at"].replace('Z', '+00:00'))
                    hours += (end - start).total_seconds() / 3600
                except: pass
            
            # Decision Rate
            if s.get("summary_file_id"):
                summary_count += 1
                
            # Weekly
            try:
                created = datetime.fromisoformat(s["created_at"].replace('Z', '+00:00'))
                if created >= week_start.replace(tzinfo=created.tzinfo):
                    this_week += 1
                elif created >= (week_start - timedelta(days=7)).replace(tzinfo=created.tzinfo):
                    last_week += 1
            except: pass
            
            # Company
            cid = s.get("threads", {}).get("company_id")
            if cid:
                if cid not in by_company_map:
                    by_company_map[cid] = {"company_id": cid, "meetings": 0, "hours": 0}
                by_company_map[cid]["meetings"] += 1

        weekly_stats = WeeklyStats(
            this_week=this_week,
            last_week=last_week,
            trend=TrendDirection.UP if this_week > last_week else TrendDirection.DOWN if this_week < last_week else TrendDirection.NEUTRAL
        )
        
        if not stats:
            # Fallback wrapper
            stats = MeetingInsightsResponse(
                total_meetings=total,
                total_hours=round(hours, 2),
                by_company=list(by_company_map.values()),
                weekly_stats=weekly_stats,
                decision_rate=summary_count / total if total else 0,
                period_days=days
            )
        
        # 3. Cache Result
        if stats:
            await cache.set_json(cache_key, stats.model_dump(), ttl_seconds=3600)
            
        return stats

    async def get_tasks_insights(self, company_id: Optional[str], project_id: Optional[str], days: int) -> TaskStatsResponse:
        # Sanitize dev-company-id
        if company_id == "dev-company-id":
            company_id = None

        client = await self._get_client()
        
        # 1. Try RPC
        try:
            params = {'filter_days': days}
            if company_id: params['filter_company_id'] = company_id
            if project_id: params['filter_project_id'] = project_id
            
            response = await client.rpc('get_task_stats', params).execute()
            if response.data:
                return TaskStatsResponse(**response.data)
        except Exception as e:
            logger.debug(f"RPC get_task_stats failed: {e}")

        # 2. Fallback
        cutoff = (datetime.now() - timedelta(days=days)).isoformat()
        query = client.table("tasks").select("*").gte("created_at", cutoff)
        if company_id: query = query.eq("company_id", company_id)
        if project_id: query = query.eq("project_id", project_id)
        
        response = await query.execute()
        tasks = response.data or []
        
        total = len(tasks)
        completed = 0
        pending = 0
        overdue = 0
        on_time = 0
        close_time_sum = 0
        
        now = datetime.now()
        
        for t in tasks:
            status = t.get("status")
            if status == "done":
                completed += 1
                # On Time & Close Time
                if t.get("updated_at") and t.get("created_at"):
                    try:
                        created = datetime.fromisoformat(t["created_at"].replace('Z', '+00:00'))
                        updated = datetime.fromisoformat(t["updated_at"].replace('Z', '+00:00'))
                        close_time_sum += (updated - created).days
                        
                        if t.get("due_date"):
                            due = datetime.fromisoformat(t["due_date"])
                            if updated.replace(tzinfo=None) <= due.replace(tzinfo=None):
                                on_time += 1
                    except: pass
            elif status == "open":
                pending += 1
                if t.get("due_date"):
                    try:
                        due = datetime.fromisoformat(t["due_date"])
                        if due < now:
                            overdue += 1
                    except: pass

        return TaskStatsResponse(
            total_tasks=total,
            completed=completed,
            pending=pending,
            overdue=overdue,
            completed_on_time=on_time,
            completion_rate=on_time / total if total else 0,
            average_time_to_close=close_time_sum / completed if completed else 0,
            period_days=days
        )

    async def get_coaching_insights(self, company_id: Optional[str], profile_type: Optional[str]) -> CoachingResponse:
        """
        Uses IntelligenceService to generate real insights across meetings.
        """
        # Get Intelligence Service
        if not self.intelligence:
            return CoachingResponse(
                current_profile=profile_type or "unknown",
                insights={},
                note="Intelligence Service unavailable."
            )
            
        # Use Intelligence Service to find patterns
        # We'll map the cross-meeting patterns to the "Coaching" format
        try:
            patterns = await self.intelligence.generate_cross_meeting_patterns(company_id=company_id, limit=10)
            
            # Format patterns into CoachingResponse
            # This is a simplification; a real implementation would segment by profile type
            mapped_insights = {
                "BA": {"insights": [], "suggestions": []},
                "PO": {"insights": [], "suggestions": []},
                "PM": {"insights": [], "suggestions": []}
            }
            
            for p in patterns:
                # Distribute generic patterns 
                target = "PM"  # Default
                if "requirement" in p.get("description", "").lower(): target = "BA"
                if "priority" in p.get("description", "").lower(): target = "PO"
                
                mapped_insights[target]["insights"].append(p.get("description", "Pattern detected"))
            
            return CoachingResponse(
                current_profile=profile_type or "all",
                insights=mapped_insights,
                note=f"Generated from {len(patterns)} detected patterns."
            )
            
        except Exception as e:
            logger.error(f"Error fetching coaching insights: {e}")
            return CoachingResponse(
                current_profile=profile_type or "unknown",
                insights={},
                note="Error generating insights."
            )

    async def get_today_schedule(self, company_id: Optional[str], project_id: Optional[str]) -> List[ActivityItem]:
        # Sanitize dev-company-id
        if company_id == "dev-company-id":
            company_id = None
            
        client = await self._get_client()
        today_start = datetime.now().replace(hour=0, minute=0, second=0, microsecond=0)
        today_end = today_start + timedelta(days=1)
        
        try:
             # Pre-fetch project IDs if company filter is on to avoid complex join filter issues
            project_ids = None
            if company_id and not project_id:
                p_res = await client.table("projects").select("id").eq("company_id", company_id).execute()
                project_ids = [p["id"] for p in p_res.data] if p_res.data else []
                if not project_ids: return []

            query = client.table("sessions").select(
                "id, type, started_at, threads!inner(title, project_id, projects!inner(name, company_id))"
            )
            
            if project_id:
                query = query.eq("threads.project_id", project_id)
            elif project_ids is not None:
                # PostgREST in_ filter
                query = query.in_("threads.project_id", project_ids)
            
            response = await query.gte("started_at", today_start.isoformat()).lt("started_at", today_end.isoformat()).order("started_at").execute()
            
            activities = []
            if response.data:
                for s in response.data:
                    # Double check company_id if needed (redundant if project_ids correct)
                    thread = s.get("threads", {})
                    project = thread.get("projects", {})
                    
                    # Formatting
                    time_str = ""
                    if s.get("started_at"):
                        try:
                            dt = datetime.fromisoformat(s["started_at"].replace('Z', '+00:00'))
                            time_str = dt.strftime("%H:%M")
                        except: pass
                        
                    activities.append(ActivityItem(
                        id=s.get("id"),
                        type=ActivityType.SESSION,
                        text=f"{thread.get('title', 'Meeting')} ({s.get('type', 'main')})",
                        time=time_str,
                        project=project.get("name", "Unknown")
                    ))
            return activities

        except Exception as e:
            logger.error(f"Error in get_today_schedule: {e}")
            return []

    async def get_urgent_tasks(self, company_id: Optional[str], project_id: Optional[str], limit: int) -> List[ActivityItem]:
        # Sanitize dev-company-id
        if company_id == "dev-company-id":
            company_id = None

        client = await self._get_client()
        today = datetime.now().date()
        tomorrow = today + timedelta(days=1)
        
        try:
            query = client.table("tasks").select("*, projects(name)").eq("status", "open")
            if company_id: query = query.eq("company_id", company_id)
            if project_id: query = query.eq("project_id", project_id)
            
            # Fetch more to filter by priority/date in memory if needed, 
            # though we can improve query. For now, matching legacy logic but cleaner.
            response = await query.order("due_date").limit(limit * 2).execute()
            
            tasks = []
            if response.data:
                count = 0
                for t in response.data:
                    if count >= limit: break
                    
                    is_urgent = False
                    if t.get("priority") == "high": is_urgent = True
                    
                    due_str = "No due date"
                    if t.get("due_date"):
                        try:
                            due = datetime.fromisoformat(t["due_date"]).date() if isinstance(t["due_date"], str) else t["due_date"]
                            if due <= tomorrow: is_urgent = True
                            
                            if due == today: due_str = "Today"
                            elif due == tomorrow: due_str = "Tomorrow"
                            elif due < today: due_str = "Overdue"
                            else: due_str = due.strftime("%Y-%m-%d")
                        except: pass
                    
                    if is_urgent:
                        proj_name = t.get("projects", {}).get("name") if t.get("projects") else "Unknown"
                        tasks.append(ActivityItem(
                            id=t.get("id"),
                            type=ActivityType.TASK,
                            text=f"{t.get('description')} ({due_str})",
                            time=due_str, # Using time field for due status
                            project=proj_name
                        ))
                        count += 1
            return tasks
        except Exception as e:
            logger.error(f"Error in get_urgent_tasks: {e}")
            return []

    async def get_recent_activity(self, company_id: Optional[str], project_id: Optional[str], limit: int) -> List[ActivityItem]:
        # Sanitize dev-company-id
        if company_id == "dev-company-id":
            company_id = None

        client = await self._get_client()
        activities = []
        
        try:
            # Parallel fetch
            # Sessions
            q1 = client.table("sessions").select("id, created_at, threads!inner(title, project_id, projects!inner(name, company_id))")
            if project_id: q1 = q1.eq("threads.project_id", project_id)
            elif company_id: q1 = q1.eq("threads.company_id", company_id) # Optimization via inner join
            
            # Tasks
            q2 = client.table("tasks").select("id, description, status, updated_at, project_id, projects(name)")
            if company_id: q2 = q2.eq("company_id", company_id)
            if project_id: q2 = q2.eq("project_id", project_id)
            
            # Threads
            q3 = client.table("threads").select("id, title, created_at, project_id, projects!inner(name)")
            if company_id: q3 = q3.eq("company_id", company_id)
            if project_id: q3 = q3.eq("project_id", project_id)

            r1, r2, r3 = await asyncio.gather(
                q1.order("created_at", desc=True).limit(limit).execute(),
                q2.order("updated_at", desc=True).limit(limit).execute(),
                q3.order("created_at", desc=True).limit(limit).execute(),
                return_exceptions=True
            )
            
            # Process Sessions
            if not isinstance(r1, Exception) and r1.data:
                for s in r1.data:
                    activities.append(ActivityItem(
                        id=s["id"], type=ActivityType.SESSION,
                        text=f"Meeting: {s['threads']['title']}",
                        time=self._format_time_ago(s['created_at']),
                        project=s['threads']['projects']['name']
                    ))

            # Process Tasks
            if not isinstance(r2, Exception) and r2.data:
                for t in r2.data:
                    status = "completed" if t['status'] == 'done' else 'updated'
                    p_name = t['projects']['name'] if t.get('projects') else "Unknown"
                    activities.append(ActivityItem(
                        id=t["id"], type=ActivityType.TASK,
                        text=f"Task {status}: {t['description']}",
                        time=self._format_time_ago(t['updated_at']),
                        project=p_name
                    ))

            # Process Threads
            if not isinstance(r3, Exception) and r3.data:
                for t in r3.data:
                    p_name = t['projects']['name'] if t.get('projects') else "Unknown"
                    activities.append(ActivityItem(
                        id=t["id"], type=ActivityType.THREAD,
                        text=f"New thread: {t['title']}",
                        time=self._format_time_ago(t['created_at']),
                        project=p_name
                    ))

            # Sort and Limit
            activities.sort(key=lambda x: x.time, reverse=False) 
            return activities[:limit]

        except Exception as e:
            logger.error(f"Error in get_recent_activity: {e}")
            return []

    async def get_contact_stats(self, contact_id: str) -> ContactStatsResponse:
        client = await self._get_client()
        try:
             # Basic implementation
             contact = (await client.table("contacts").select("*").eq("id", contact_id).execute()).data
             if not contact: raise Exception("Contact not found")
             
             meetings = (await client.table("session_speakers").select("*", count="exact").eq("contact_id", contact_id).execute()).count or 0
             tasks = (await client.table("tasks").select("*", count="exact").eq("owner_contact_id", contact_id).execute()).count or 0
             
             unique_projects = 0 # Placeholder for complex logic involving threads
             
             return ContactStatsResponse(
                 contact_id=contact_id,
                 meetings_count=meetings,
                 tasks_count=tasks,
                 projects_in_common=unique_projects
             )
        except Exception as e:
            logger.error(f"Error in get_contact_stats: {e}")
            raise e

    async def get_project_insights(self, project_id: str) -> ProjectInsightsResponse:
        # Placeholder for full implementation
         return ProjectInsightsResponse(
             project_id=project_id,
             insights=[],
             stats={}
         )

    def _format_time_ago(self, timestamp_str: str) -> str:
        if not timestamp_str: return ""
        try:
            dt = datetime.fromisoformat(timestamp_str.replace('Z', '+00:00'))
            now = datetime.now(dt.tzinfo)
            diff = now - dt
            if diff.days > 0: return f"{diff.days}d ago"
            if diff.seconds >= 3600: return f"{diff.seconds//3600}h ago"
            if diff.seconds >= 60: return f"{diff.seconds//60}m ago"
            return "Just now"
        except: return timestamp_str

    async def get_contact_interactions(self, contact_id: str, limit: int) -> List[ContactInteraction]:
        client = await self._get_client()
        interactions = []
        try:
            # 1. Sessions
            s_res = await client.table("session_speakers").select(
                "session_id, sessions!inner(id, type, created_at, started_at, ended_at, summary_file_id, threads!inner(title, project_id, projects!inner(name)))"
            ).eq("contact_id", contact_id).limit(limit * 2).execute()
            
            if s_res.data:
                for item in s_res.data:
                    session = item.get("sessions", {})
                    thread = session.get("threads", {})
                    project = thread.get("projects", {})
                    
                    interactions.append(ContactInteraction(
                        type="meeting",
                        text=session.get("type", "Meeting"),
                        date=session.get("started_at") or session.get("created_at", ""),
                        project=project.get("name", "Unknown") if project else "Unknown",
                        sessionId=session.get("id"),
                        summary="Session completed" if session.get("summary_file_id") else None
                    ))

            # 2. Tasks
            t_res = await client.table("tasks").select(
                "id, description, status, due_date, created_at, project_id, projects(name)"
            ).eq("owner_contact_id", contact_id).order("created_at", desc=True).limit(limit).execute()
            
            if t_res.data:
                for t in t_res.data:
                    p_name = "Unknown"
                    if t.get("projects"):
                        p = t.get("projects")
                        if isinstance(p, list) and len(p) > 0: p_name = p[0].get("name", "Unknown")
                        elif isinstance(p, dict): p_name = p.get("name", "Unknown")
                    
                    interactions.append(ContactInteraction(
                        type="task",
                        text=t.get("description", "Task"),
                        date=t.get("created_at", ""),
                        project=p_name,
                        sessionId=t.get("id"),
                        status=t.get("status")
                    ))
            
            # Sort
            interactions.sort(key=lambda x: x.date or "", reverse=True)
            return interactions[:limit]
            
        except Exception as e:
            logger.error(f"Error in get_contact_interactions: {e}")
            return []

    async def get_contact_commitments(self, contact_id: str) -> List[ContactCommitment]:
        client = await self._get_client()
        try:
            response = await client.table("tasks").select(
                "id, description, status, priority, due_date, type, created_at, project_id, projects(name)"
            ).eq("owner_contact_id", contact_id).order("due_date", desc=False).execute()
            
            commitments = []
            if response.data:
                for t in response.data:
                     p_name = t.get("projects", {}).get("name") if t.get("projects") else None
                     commitments.append(ContactCommitment(
                         id=t.get("id"),
                         text=t.get("description"),
                         status="completed" if t.get("status") == "done" else "pending",
                         type="task",
                         date=t.get("due_date") or t.get("created_at"),
                         priority=t.get("priority"),
                         project=p_name
                     ))
            return commitments
        except Exception as e:
            logger.error(f"Error in get_contact_commitments: {e}")
            return []

    async def get_contact_topics(self, contact_id: str) -> List[ContactTopic]:
        client = await self._get_client()
        try:
            res = await client.table("session_speakers").select(
                "session_id, sessions!inner(thread_id, threads!inner(title, project_id, projects!inner(name)))"
            ).eq("contact_id", contact_id).execute()
            
            data = res.data or []
            project_counts = {}
            title_words = {}
            
            for item in data:
                thread = item.get("sessions", {}).get("threads", {})
                project = thread.get("projects", {})
                
                # Projects
                if project and project.get("name"):
                    p_name = project.get("name")
                    project_counts[p_name] = project_counts.get(p_name, 0) + 1
                
                # Keywords
                title = thread.get("title", "")
                if title:
                    for word in title.split():
                        if len(word) > 4:
                            w = word.lower().strip(".:,;()")
                            title_words[w] = title_words.get(w, 0) + 1
            
            topics = []
            for proj, count in project_counts.items():
                topics.append(ContactTopic(topic=f"Project: {proj}", mentions=count, stance="Active Collaborator"))
            
            sorted_words = sorted(title_words.items(), key=lambda x: x[1], reverse=True)[:5]
            for word, count in sorted_words:
                topics.append(ContactTopic(topic=word.capitalize(), mentions=count, stance="Frequent Discussion"))
                
            topics.sort(key=lambda x: x.mentions, reverse=True)
            return topics
        except Exception as e:
            logger.error(f"Error in get_contact_topics: {e}")
            return []

def get_analytics_service():
    return AnalyticsService()
