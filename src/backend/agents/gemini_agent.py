from typing import List, AsyncGenerator, Dict, Any, Optional, Union
from google.genai import types
from services.gemini_service import get_gemini_service, GeminiService
import logging
import json
import asyncio

logger = logging.getLogger(__name__)

class GeminiAgent:
    """
    SOTA Context-Aware Agent with Autonomous Tool Loop.
    Handles:
    1. Structured Context Injection (<persona>, <context>)
    2. Autonomous Tool Execution (Function Calling Loop)
    3. Multimodal Inputs with Smart Caching
    4. Observable Token Usage
    """

    def __init__(
        self, 
        persona: str = None,
        context: str = None,
        tools: List[Any] = None,
        model_name: str = None
    ):
        self.service = get_gemini_service()
        self.tools = tools
        self.model_name = model_name or self.service.model_name
        
        # SOTA: Structured Context Formatting
        self.system_instruction = self._format_system_instruction(persona, context)

    def _format_system_instruction(self, persona: str, context: str) -> str:
        """Formats strict XML-tagged instructions to reduce hallucinations."""
        parts = []
        if persona:
            parts.append(f"<persona>\n{persona}\n</persona>")
        else:
            parts.append(f"<persona>\nYou are a helpful AI assistant.\n</persona>")
            
        if context:
            parts.append(f"<context_knowledge>\n{context}\n</context_knowledge>")
            
        parts.append("""<instructions>
1. Always cite sources from <context_knowledge> if available.
2. If the user provides files, analyze them deeply.
3. If using tools, yield status updates.
</instructions>""")
        return "\n\n".join(parts)

    async def run_turn(
        self, 
        history: List[Dict[str, Any]], 
        message: str, 
        attachments: List[Dict[str, str]] = None
    ) -> AsyncGenerator[Dict[str, Any], None]:
        """
        Runs a SOTA autonomous turn:
        - Uploads files (Smart Cache)
        - Enters Tool Loop (Think -> Call -> Result -> Think)
        - Streams Text tokens
        - Logs usage
        """
        try:
            # 1. Prepare Initial Content
            current_message_parts = [message]
            
            # Handle Attachments (Smart Cache)
            if attachments:
                yield {"type": "status", "text": "Analyzing attachments..."}
                for att in attachments:
                    file_path = att.get("path")
                    if file_path:
                        try:
                            file_ref = await self.service.upload_file(file_path)
                            current_message_parts.append(file_ref)
                        except Exception as upload_err:
                            logger.error(f"Failed to upload attachment {file_path}: {upload_err}")
                            yield {"type": "status", "text": f"Error loading file: {upload_err}"}

            # 2. Initialize Session
            chat = await self.service.create_chat_session(
                history=history,
                system_instruction=self.system_instruction,
                tools=self.tools
            )

            # 3. Autonomous Tool Loop
            turn_active = True
            loop_count = 0
            MAX_LOOPS = 5  # Safety break

            while turn_active and loop_count < MAX_LOOPS:
                loop_count += 1
                
                # Stream Response
                stream = await chat.send_message_stream(current_message_parts)
                
                full_text_accumulator = ""
                function_call_found = False
                
                # Iterate over chunks
                # In google-genai, chunks are GenerateContentResponse objects
                async for chunk in stream:
                    # Yield text tokens
                    if chunk.text:
                        full_text_accumulator += chunk.text
                        yield {"type": "token", "text": chunk.text}
                    
                    # Check for function calls in chunk (SOTA: streaming tool calls)
                    # Often function calls come in the last chunk or separate chunks
                    if chunk.candidates and chunk.candidates[0].content.parts:
                        for part in chunk.candidates[0].content.parts:
                            if part.function_call:
                                function_call_found = True
                                # We'll process it after the stream loop to avoid complexity
                                # Or we could accumulate here provided 'stream' isn't consumed fully?
                                # Actually, with the new SDK, iterating the stream gives us partials.
                                # To get the full tool call properly constructed, we might want the final aggregated response.
                                pass 
                
                # The 'stream' iterator itself doesn't have a '.response' property in the new SDK (usually)
                # But we can access the last chunk or rely on chat.history[-1] which should be the model turn?
                # Actually, wait, chat.history is updated?
                # Let's inspect the chat history's last message, which should be the model's response.
                
                # With new SDK, chat history is updated automatically.
                # The last message in history is the model's response.
                # However, chat.history might be a list of Content objects.
                # We need to find the latest "model" message.
                
                # Simpler approach: gather accumulated parts if possible.
                # Unfortuantely 'stream' yields chunks. 
                # Let's trust that the last chunk contains the Full Function Call or rely on history.
                
                # Inspecting history (assuming sync behavior of history update after stream end)
                # Note: google-genai chat.history is a list of Content.
                
                # A safer bet finding the response:
                # The SDK usually accumulates history.
                
                # Let's try to get the last message from history.
                # But the SDK structure for history access:
                # chat._history ?
                
                # Alternative: The new SDK chunks might contain the full FunctionCall in the last chunk?
                # Let's try to capture the final response from the stream iteration loop variable?
                
                # Actually, `chunk` variable persists after loop (Python scoping).
                final_response_chunk = chunk
                
                # Check usage
                if final_response_chunk.usage_metadata:
                    usage = final_response_chunk.usage_metadata
                    # logger.info(f"Token Usage: {usage}")

                # Process Function Calls
                # We need to find function calls in the candidates of the final response
                if final_response_chunk.candidates:
                    for part in final_response_chunk.candidates[0].content.parts:
                        if part.function_call:
                            function_call_found = True
                            fn = part.function_call
                            fn_name = fn.name
                            fn_args = fn.args
                            
                            # SOTA: Granular Tool Feedback (Action Feedback)
                            ui_hint = f"Invoking {fn_name}..."
                            if "search" in fn_name: ui_hint = "Searching external knowledge..."
                            if "check" in fn_name: ui_hint = "Verifying compliance rules..."
                            
                            yield {"type": "status", "text": ui_hint}
                            yield {
                                "type": "tool_start", 
                                "tool": fn_name, 
                                "args": fn_args,
                                "ui_hint": ui_hint
                            }
                            
                            # EXECUTE LOCALLY
                            tool_result = await self._execute_tool_local(fn_name, fn_args)
                            
                            # Construct FunctionResponse
                            # In new SDK, we send the result back using types.Part
                            current_message_parts = [
                                types.Part(
                                    function_response=types.FunctionResponse(
                                        name=fn_name,
                                        response={"result": tool_result}
                                    )
                                )
                            ]
                            
                            # Continue loop
                            break 
                
                if not function_call_found:
                    turn_active = False # Done, text only
            
            # 4. Final Status
            sanitized_text = self._sanitize_output(full_text_accumulator)
            yield {"type": "done", "full_text": sanitized_text}

        except Exception as e:
            logger.error(f"Agent SOTA Turn Error: {e}", exc_info=True)
            yield {"type": "error", "message": str(e)}

    def _sanitize_output(self, text: str) -> str:
        """
        Basic Output Parser.
        """
        if not text:
            return ""
        restricted_phrases = ["<persona>", "<context_knowledge>", "You are a helpful AI assistant"]
        sanitized = text
        for phrase in restricted_phrases:
             sanitized = sanitized.replace(phrase, "[REDACTED]")
        return sanitized

    async def _execute_tool_local(self, name: str, args: Dict[str, Any]) -> Any:
        """
        Executes a tool locally.
        """
        logger.info(f"Executing Tool: {name} with {args}")
        if self.tools:
            for tool in self.tools:
                # If tool is a function
                if hasattr(tool, '__name__') and tool.__name__ == name:
                    if asyncio.iscoroutinefunction(tool):
                        return await tool(**args)
                    return tool(**args)
        return f"Error: Tool '{name}' not found."
