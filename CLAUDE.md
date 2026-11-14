<principles>
<python> 
Use uv for everything: uv run, uv pip, uv venv.
use uvx ty check for type checking.
use ruff check to lint code.
</python>

<project-skills>
Always browse global skills and MCP servers before using web search. When working with a previously unseen tech or package, first convert the documentation to a local skill.
</project-skills>

<spec-driven-development>
For every project, iterate and improve on a detailed SPEC.md or SPEC.pdf that explains the project's technical architecture, design decisions, and core technologies. When starting a new project, after compaction, or when http://SPEC.md or SPEC.pdf is missing/stale and substantial work is requested: invoke /spec skill to interview the user. The spec persists across compactions and prevents context loss. Update http://SPEC.md or SPEC.pdf as the project evolves. If stuck or losing track of goals, re-read SPEC.md or SPEC.pdf or re-interview.
</spec-driven-development>

<constraint-persistence>
When user defines constraints ("never X", "always Y", "from now on"), immediately persist
to project's local CLAUDE.md. Acknowledge, write, confirm.
</constraint-persistence>

<epistemology>
Never guess any numerical inputs or values, always benchmark instead of estimate.
When uncertain, measure. Say "this needs to be measured" rather than inventing statistics.
</epistemology>

<scaling>
Validate at small scale before scaling up. Run a sub-minute version first to verify the
full pipeline works. When scaling, only the scale parameter should change.
</scaling>

<interaction>
Clarify unclear requests, confirm by writing to SPEC.md or SPEC.pdf, then proceed autonomously. First consult SPEC.md or SPEC.pdf and only ask for help when scripts timeout (>2min), sudo is needed, or genuine blockers arise. 
</interaction>

<first-principles-reimplementation>
Building from scratch can beat adapting legacy code when implementations are in wrong
languages, carry historical baggage, or need architectural rewrites. Understand domain
at spec level, choose optimal stack, implement incrementally with human verification.
</first-principles-reimplementation>

<workflow>
leverage git heavily. for every large task (like features, bugfixes, refactors), make a new git branch and have frequent commits for each subtask solved. 
always have runnable snippets to test out modules. make them persistent.
always make sure tests run before commits.
if tests are broken, or too cumbersome, make a separate PR and fix them.
only after tests are fixed, do you resume to the original task.
always run the linter and type checker before commiting code.
</workflow>

</principles>

