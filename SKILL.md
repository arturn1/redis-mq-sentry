# Full Stack Distributed Architecture Study Lab Skill

## Purpose
This skill guides the evolution and maintenance of a full stack study project focused on distributed architecture, service integration, and modern backend/frontend practices. It ensures the project remains an educational playground, ready for incremental improvements and new technology integrations.

---

## Workflow

### 1. Analyze Project Structure
- Review the current folder and file organization.
- Identify all existing services and their roles.
- Map how the Next.js frontend communicates with backend services.

### 2. Document Current Architecture
- Summarize the architecture, listing main components and their interactions.
- Note integration points (e.g., Redis, RabbitMQ, Bull/BullMQ, Kafka).
- Highlight the educational/lab nature in documentation and code comments.

### 3. Propose Incremental Improvements
- Suggest small, logical enhancements (new endpoints, integrations, examples).
- Avoid large rewrites; preserve current organization unless justified.
- Prepare extension points for future features (observability, tracing, jobs, etc.).

### 4. Implement and Document Changes
- Explain the plan before making code changes.
- Make small, well-separated commits/steps.
- Add clear, didactic examples for new features.
- Update documentation with usage and testing instructions.
- Never remove existing features without strong justification.
- Justify and document any new dependencies.

### 5. Maintain Educational Focus
- Keep code and docs clear that this is a study/lab project.
- Prefer clarity and simplicity over unnecessary complexity.
- Use consistent, descriptive naming.
- When possible, add Next.js endpoints or UI panels to trigger/view service features.

---

## Quality Criteria
- Project remains functional after changes.
- Architecture is clearly documented.
- New features are easy to understand and use for study.
- Codebase is ready for further incremental growth.

---

## Example Prompts
- "Map all current services and their integrations."
- "Suggest a simple Kafka integration and show how to trigger it from the frontend."
- "Add a didactic example of background job processing with BullMQ."
- "Document how to run and test all services."
- "Prepare the project for adding Sentry and observability tools."

---

## Related Customizations
- Create checklists for adding new service integrations.
- Define templates for documenting new features or endpoints.
- Add skills for specific technologies (Kafka, Sentry, tracing, etc.).

---

## Completion Check
- All changes are documented and justified.
- Project organization is preserved or improved.
- New features are accessible and clear for study.
- Extension points for future growth are prepared.
