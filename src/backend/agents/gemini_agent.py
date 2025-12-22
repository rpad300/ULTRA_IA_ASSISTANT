from typing import List, AsyncGenerator, Dict, Any, Optional, Union
import google.generativeai as genai
from google.generativeai.types import FunctionDeclaration, Tool 
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
            uploaded_files = []

            # Handle Attachments (Smart Cache)
            if attachments:
                yield {"type": "status", "text": "Analyzing attachments..."}
                for att in attachments:
                    file_path = att.get("path")
                    # mime_type = att.get("mime_type") # Auto-detect in service
                    if file_path:
                        try:
                            file_ref = await self.service.upload_file(file_path)
                            current_message_parts.append(file_ref)
                            uploaded_files.append(file_ref)
                        except Exception as upload_err:
                            logger.error(f"Failed to upload attachment {file_path}: {upload_err}")
                            yield {"type": "status", "text": f"Error loading file: {upload_err}"}

            # 2. Initialize Session
            chat = self.service.create_chat_session(
                history=history,
                system_instruction=self.system_instruction,
                tools=self.tools
            )

            # 3. Autonomous Tool Loop
            # We loop until the model stops calling functions and produces text response
            turn_active = True
            loop_count = 0
            MAX_LOOPS = 5  # Safety break

            while turn_active and loop_count < MAX_LOOPS:
                loop_count += 1
                
                # Stream Response
                stream = await chat.send_message_async(current_message_parts, stream=True)
                
                full_text_accumulator = ""
                function_call_found = False
                
                async for chunk in stream:
                    # Yield text tokens immediately
                    if chunk.text:
                        full_text_accumulator += chunk.text
                        yield {"type": "token", "text": chunk.text}
                    
                    # Check for function calls (usually at end or separate chunks)
                    # Note: chunk.parts might have function_call even if text is present (rare)
                
                # After stream finishes, inspect the final aggregated response (chat.history[-1] references model turn)
                # But safer to inspect the specific response object from the stream if possible.
                # Actually, stream object allows `await stream.response` to get the final aggregated response.
                final_response = await stream.response
                
                # Check usage metadata
                if final_response.usage_metadata:
                    usage = final_response.usage_metadata
                    logger.info(f"Token Usage (Turn {loop_count}): Prompt={usage.prompt_token_count}, Cand={usage.candidates_token_count}")
                    # We could yield this, but maybe just log for now or yield detailed status
                
                # Inspect parts for function calls
                for part in final_response.parts:
                    if fn := part.function_call:
                        function_call_found = True
                        fn_name = fn.name
                        fn_args = dict(fn.args)
                        
                        yield {"type": "status", "text": f"Executing tool: {fn_name}..."}
                        yield {"type": "tool_start", "tool": fn_name, "args": fn_args}
                        
                        # EXECUTE LOCALLY (SOTA)
                        # Here we assume self.tools contains callable objects or we have a registry.
                        # For now, since user didn't provide specific tool registry logic, 
                        # we assume we handle the result or existing mechanics.
                        # IF tools are passed as specific `genai` tools, simple Python functions work.
                        
                        tool_result = await self._execute_tool_local(fn_name, fn_args)
                            
                        # Prepare response for next loop
                        # We must send function_response
                        import google.ai.generativelanguage as glm
                        
                        # Construct FunctionResponse part
                        # Using the high-level library helper if available, or constructing dictionary
                        # The high level 'chat.send_message' accepts a dictionary for function response
                        current_message_parts = [
                            genai.protos.Part(
                                function_response=genai.protos.FunctionResponse(
                                    name=fn_name,
                                    response={"result": tool_result}
                                )
                            )
                        ]
                        
                        # Continue loop to send this result back
                        break # Process one function call at a time (simplify)
                
                if not function_call_found:
                    turn_active = False # Done, we got text only (or nothing)
            
            # 4. Final Status
            sanitized_text = self._sanitize_output(full_text_accumulator)
            yield {"type": "done", "full_text": sanitized_text}

        except Exception as e:
            logger.error(f"Agent SOTA Turn Error: {e}", exc_info=True)
            yield {"type": "error", "message": str(e)}

    def _sanitize_output(self, text: str) -> str:
        """
        Basic Output Parser to prevent leakage of internal IDs or System Prompt info.
        For production, this would use a dedicated Guardrails model.
        """
        if not text:
            return ""
            
        # Example: Prevent leaking the system prompt instruction if asked
        restricted_phrases = ["<persona>", "<context_knowledge>", "You are a helpful AI assistant"]
        sanitized = text
        for phrase in restricted_phrases:
             sanitized = sanitized.replace(phrase, "[REDACTED]")
             
        return sanitized

    async def _execute_tool_local(self, name: str, args: Dict[str, Any]) -> Any:
        """
        Executes a tool locally.
        This allows the backend to control side effects (DB writes, API calls).
        """
        logger.info(f"Executing Tool: {name} with {args}")
        
        # 1. Search in provided tools list (if they are callables)
        if self.tools:
            for tool in self.tools:
                # If tool is a function
                if hasattr(tool, '__name__') and tool.__name__ == name:
                    # Check if async
                    if asyncio.iscoroutinefunction(tool):
                        return await tool(**args)
                    return tool(**args)
                
                # If tool is a Tool object (langchain style? or custom)
                if hasattr(tool, 'name') and tool.name == name:
                     if hasattr(tool, 'run'): # Standardize on run?
                         return tool.run(**args)
        
        # Fallback/Error
        return f"Error: Tool '{name}' not found or not executable."
