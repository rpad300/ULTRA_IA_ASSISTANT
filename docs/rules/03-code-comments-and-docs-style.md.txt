# CODE COMMENTS & DOCUMENTATION STYLE (GLOBAL RULES)

These rules apply to ALL code, in ALL roles, across the entire project.


## 1. Language

- All comments, docstrings, and developer-facing documentation MUST be written in English.  
- Do NOT mix languages inside comments.  
- Variable names and code can follow project conventions, but explanations are always in English.  


## 2. Comment philosophy

- Comment WHY and the intent, not obvious WHAT.  
  - Bad: `// Increment counter`  
  - Good: `// Increment retry counter to handle transient failures from the API`  
- Explain any non-trivial logic, business rules, or constraints.  
- Document assumptions and limitations explicitly.  
- If something is a workaround or temporary fix, say so and explain why.  


## 3. Where comments are required

You MUST add comments/docstrings in the following cases:

- Every public function, method, class, or exported symbol MUST have a clear docstring or header comment explaining:
  - Purpose (what it does in business terms)  
  - Inputs (parameters and expectations)  
  - Outputs / side effects (what it returns, what it changes)  

- Complex or critical private functions MUST have a short explanation of:
  - The core idea of the algorithm or approach  
  - Any important edge cases or performance considerations  

- Non-obvious configuration, security, or infra code MUST have comments explaining:
  - Why this setting or value is used  
  - Impact if it is changed  


## 4. Comment style and tone

- Write comments as if you are a professional engineer explaining the code to another senior developer.  
- Be concise, direct, and precise. Avoid filler and vague wording.  
- Use full sentences when it improves clarity, but keep them short.  
- Never write emotional, sarcastic, or “funny” comments in production code.  


## 5. Structure and formatting

- Use the standard comment/documentation style of the language and the existing project.  
- For docstrings / headers, follow a consistent structure, for example:
  - Short summary line  
  - Optional longer explanation  
  - Parameters (only for public APIs or complex functions)  
  - Return value / errors (when relevant)  

- For complex blocks (loops, conditionals, queries), add a brief comment BEFORE the block explaining the intent.  


## 6. Examples

### 6.1 Good function comment

```js
// Validates a user's access to a given resource based on role and ownership.
// This is called before any write operations to ensure authorization rules are enforced.
function canUserAccessResource(userId, resourceId) { ... }
