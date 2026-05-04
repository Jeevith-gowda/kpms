# Property Management Portal – Phase 2 Feature Specification (Updated)

> **Purpose:** This document defines **Phase 2** enhancements for the Property Management Portal. It is intended to be used in **Antigravity** to implement the next set of features on top of the current application.
>
> **Current baseline:** Phase 1 already includes login/access control, Doors sync, Airfilters workflow, Messages, Settings, reminder automation, webhook/message sync, mobile responsiveness, and PWA support.
>
> **Security requirement:** Do **not** hardcode any API keys or model identifiers in source code. Store all secrets and deployment-specific values in environment variables or a secure secret manager.

---

## 1) Phase 2 Overview

Phase 2 introduces **AI-assisted and AI-automated messaging** inside the **Messages** module, along with automatic association of tenant replies to airfilter requests.

### Phase 2 Features Included in This Document
1. **Feature 1:** LLM-powered AI-generated reply suggestions in Messages
2. **Feature 2:** Configurable automatic AI responses to incoming messages
3. **Feature 3:** Automatic detection of tenant replies related to airfilter change requests and automatic status updates in the system

---

## 2) Shared Provider and Configuration Requirements

All AI response generation and message understanding in Phase 2 must use **Groq inference**.

### Required environment variables
```env
GROQ_API_KEY=replace_me
GROQ_MODEL_NAME=replace_me
```

### Optional environment variables
```env
GROQ_BASE_URL=https://api.groq.com/openai/v1
GROQ_TIMEOUT_MS=30000
GROQ_MAX_RETRIES=2
AI_AUTO_REPLY_ENABLED=true
AI_AUTO_REPLY_MAX_HISTORY_MESSAGES=20
AI_AUTO_REPLY_TEMPERATURE=0.3
```

### Configuration behavior
- `GROQ_API_KEY` must be used server-side only
- `GROQ_MODEL_NAME` must be configurable without code changes
- If Groq configuration is missing, AI features must fail gracefully
- Existing manual message functionality must continue working regardless of AI status

---

## 3) Feature 1 – AI Reply Suggestions in Messages

## 3.1 Summary
Inside the **Messages** page, add a second AI-assisted response box next to the existing manual message box.

### Existing box
- Used for normal manual typing and sending
- Must continue working exactly as it does today

### New AI box
- Displays an AI-generated draft response
- Draft must be editable before sending
- User can copy, modify, or directly send after review
- AI generation must use the current conversation context

---

## 3.2 Messages Page UX Changes

### Existing composer area
Keep the current manual composer exactly as-is.

### New layout requirement
In the message compose area, add **2 response boxes**:

#### Box 1 – Manual Response
##### Title
**Manual Reply**

##### Placeholder
**Type your message here...**

##### Primary button
**Send Message**

---

#### Box 2 – AI Suggested Reply
##### Title
**AI Suggested Reply**

##### Placeholder before generation
**Click “Generate AI Reply” to create a suggested response.**

##### Buttons
- **Generate AI Reply**
- **Regenerate**
- **Use in Manual Reply**
- **Send AI Reply**

##### Behavior
- The AI draft appears in a text area
- The user can edit the AI draft directly in this box
- The user can either:
  - click **Use in Manual Reply** to copy it into the manual composer, or
  - click **Send AI Reply** to send the edited AI draft directly

### Loading state wording
- **Generating AI reply...**

### Empty state wording
- **No AI reply generated yet.**

### Error state wording
- **Unable to generate AI reply. Please try again.**

---

## 3.3 AI Draft Generation Rules

The generated response should be based on:
- current conversation thread
- latest inbound tenant message
- prior assistant/staff messages in the thread
- linked property / tenant metadata when available
- business context
- property management company tone and response style

### Response style requirements
The AI draft should be:
- professional
- concise
- helpful
- context-aware
- safe to review before sending

### Response constraints
The AI draft should avoid:
- making unsupported promises
- legal or financial guarantees
- unsupported maintenance commitments
- revealing internal-only data

### Human review requirement for Feature 1
When automatic AI responses are disabled, AI-generated responses must **not** be sent automatically. A user must review, edit if needed, and send manually.

---

## 3.4 Prompting Strategy

The server-side prompt should include:
- system prompt defining assistant tone and business rules
- conversation history (bounded to a safe token window)
- property / tenant metadata if available
- instruction to generate a tenant-facing SMS-style response draft
- business context relevant to the message category

### Suggested system prompt behavior
The AI assistant should:
- respond as a professional property management assistant
- keep responses short and clear
- acknowledge tenant messages appropriately
- request clarification when needed
- avoid fabricating facts not present in conversation or property context

---

## 3.5 Exact UI Wording

### New section heading
**Reply Assistant**

### Manual box title
**Manual Reply**

### AI box title
**AI Suggested Reply**

### AI buttons
- **Generate AI Reply**
- **Regenerate**
- **Use in Manual Reply**
- **Send AI Reply**

### Success toasts
- **AI reply generated successfully.**
- **AI reply copied to manual composer.**
- **AI reply sent successfully.**

### Error toasts
- **AI reply generation failed. Please try again.**
- **AI reply could not be sent. Please try again.**

---

## 4) Feature 2 – Configurable Automatic AI Responses

## 4.1 Summary
Add a configurable setting in **Settings > General** to enable or disable automatic AI responses to incoming messages.

### Required behavior
- When enabled, the system should automatically send AI-generated responses to incoming messages based on:
  - the message content
  - conversation history
  - linked property / tenant context
  - business context
- When disabled, AI-generated responses should still be available, but only as editable drafts in the **AI Suggested Reply** box described in Feature 1

---

## 4.2 Settings Page Changes

Add a new section under **Settings > General**.

### Section title
**AI Auto Responses**

### Section description
**Control whether the system should automatically send AI-generated responses to incoming messages.**

### Exact toggle label
**Enable Auto Responses to Messages**

### Default state
- Off

### Supporting description
**When enabled, the system will automatically generate and send responses to incoming messages using business context. When disabled, AI responses will be generated as editable drafts only.**

### Save behavior
- The setting must be saved in application settings and applied immediately to new incoming messages

---

## 4.3 Auto Response Behavior

### When enabled
For each eligible incoming message:
1. Load the conversation context
2. Load linked property / tenant metadata when available
3. Build the AI prompt using business context
4. Generate a reply draft using Groq
5. Send the AI-generated reply automatically through the normal outbound messaging pipeline
6. Log the generated response and sent message linkage

### When disabled
For each conversation:
- AI-generated text should only appear in the **AI Suggested Reply** box
- User must review and send manually
- No automatic AI send should occur

---

## 4.4 Business Context Requirement

Auto responses must use **business context**.

### Business context includes
- property management business tone
- linked property details when available
- linked tenant details when available
- conversation category if available
- relevant operational context from the system

### Examples of business-context-aware AI behavior
- maintenance-related questions should receive maintenance-oriented responses
- airfilter-related responses should align with the airfilter workflow
- general tenant inquiries should receive tenant-support-style responses

---

## 4.5 Auto Response Eligibility Rules

The system should only auto-respond when:
- the incoming message is from a tenant / known conversation
- the auto response setting is enabled
- the conversation is not paused or blocked from AI responses
- there is sufficient context to generate a safe business response

### Auto response should not send automatically when:
- the message is ambiguous and confidence is low
- the conversation is flagged for manual handling
- the message relates to airfilter confirmation and should instead trigger status update logic under Feature 3
- the AI generation process fails

### Fallback behavior
If auto-response is enabled but the system decides not to auto-send:
- generate a draft if possible
- place it in the **AI Suggested Reply** box for manual review
- record the event for traceability

---

## 4.6 Messages UI Indications for Auto Responses

### New badges / indicators
When a message is sent automatically by AI, show a clear indicator such as:
- **AI Auto Response Sent**

### Optional metadata labels
- **Generated by AI**
- **Sent Automatically**

### Toasts
- **AI auto response sent successfully.**
- **AI auto response was not sent and requires manual review.**
- **AI auto response failed. Please review manually.**

---

## 4.7 Permissions / Access Control for Feature 2

Add new permission labels:
- **Enable or Disable AI Auto Responses**
- **View AI Auto Response Activity**

### Permission behavior
- Only users with **Enable or Disable AI Auto Responses** can change the global setting in **Settings > General**
- Users with **View AI Auto Response Activity** can view audit/history related to automatic AI sends
- Admin should have both permissions enabled by default
- Employee access should be configurable in **Settings > Access**

### Settings > Access additions under Messages / Settings
Add these permission labels:
- **Generate AI Replies**
- **Send AI Replies**
- **Enable or Disable AI Auto Responses**
- **View AI Auto Response Activity**

---

## 4.8 Data Model Additions for Feature 2

### Update app_settings
Add fields:
- `enableAutoResponsesToMessages` (boolean)
- `updatedByUserId` (already present or reuse existing field)

### ai_reply_generations additions
Add fields:
- `wasAutoSent` (boolean)
- `autoSendDecision` (nullable string)
- `autoSendDecisionReason` (nullable text)

### Optional ai_message_activity table
If separate activity tracking is preferred:
- `id`
- `conversationId`
- `sourceMessageId`
- `generatedReplyId`
- `wasAutoSent`
- `status`
- `decisionReason`
- `createdAt`

---

## 4.9 Acceptance Criteria for Feature 2

- Settings page includes **Enable Auto Responses to Messages** toggle
- When enabled, eligible incoming messages receive automatic AI-generated responses based on message content and business context
- When disabled, AI-generated messages appear only in the **AI Suggested Reply** box and require manual review/send
- Auto-generated sends use the existing outbound messaging pipeline
- Automatic sends are auditable and clearly labeled in the UI/history
- Permissions control who can manage the auto-response setting and who can view AI auto-response activity

---

## 5) Feature 3 – Automatic Airfilter Reply Association and Status Update

## 5.1 Summary
The system should automatically find tenant responses associated with **airfilter change request messages**, capture the response status, and update the system accordingly.

This feature is intended to close the loop between outbound airfilter reminder messages and tenant responses.

---

## 5.2 Core Requirement

The system must be able to:
1. identify that an incoming tenant response is associated with an airfilter reminder request
2. interpret the response
3. update airfilter reminder status automatically when appropriate
4. stop further reminder automation when the filter change is confirmed

---

## 5.3 Association Logic

A tenant response should be associated to an airfilter request using one or more of the following:
- same conversation thread as the outbound airfilter reminder
- matching tenant and property linkage
- matching most recent unresolved airfilter reminder for that tenant/property
- message timing relative to the most recent outbound airfilter reminder

### Preferred association order
1. direct conversation linkage to an airfilter reminder outbound message
2. tenant + property match to an unresolved current reminder cycle
3. latest unresolved reminder in the same phone/email thread

---

## 5.4 Response Interpretation Rules

The system should detect whether a reply indicates:
- filter changed / completed
- not yet changed
- unclear / ambiguous

### Positive confirmation examples
- "changed"
- "done"
- "completed"
- "I changed it"
- "filter replaced"
- "changed with photo"

### Negative or incomplete examples
- "not yet"
- "will do it"
- "tomorrow"
- "later"

### Ambiguous examples
- "ok"
- "thanks"
- "got it"

### Interpretation behavior
- Positive confirmation → auto-update status to changed when confidence is sufficient
- Negative / incomplete → keep reminder unresolved
- Ambiguous → mark for manual review

---

## 5.5 Automatic Status Update Behavior

When a tenant response is confidently associated with an airfilter reminder and indicates the filter was changed:
- set **Filter Changed = Yes**
- update **Reminder Status = Confirmed Changed**
- store **Tenant Response** text
- store **Tenant Response At** timestamp
- store response confidence / interpretation outcome
- stop future reminders for the current due cycle

### When response indicates not changed yet
- keep **Filter Changed = No**
- keep reminder active
- continue reminder workflow according to settings unless paused manually

### When response is ambiguous
- do not auto-confirm
- set item for **manual review**
- optionally expose a flag such as **Needs Review**

---

## 5.6 Airfilters UI / History Changes for Feature 3

### Reminder History additions
Ensure history can show:
- associated tenant response text
- interpretation result
- whether response was auto-associated
- whether status was auto-updated
- who reviewed it if manual review occurred

### Optional status indicators
- **Needs Review**
- **Auto-Confirmed**

### Toasts
- **Airfilter status updated automatically from tenant response.**
- **Tenant response was associated but requires manual review.**
- **Airfilter response could not be associated automatically.**

---

## 5.7 Permissions / Access Control for Feature 3

Add new permission labels:
- **Review Airfilter Response Matches**
- **Approve Airfilter Auto Updates**

### Permission behavior
- Users with **Review Airfilter Response Matches** can view and resolve ambiguous response matches
- Users with **Approve Airfilter Auto Updates** can manually approve suggested updates when needed
- Admin should have both enabled by default
- Employee access should be configurable under **Settings > Access**

### Settings > Access additions under Airfilters
Add:
- **Review Airfilter Response Matches**
- **Approve Airfilter Auto Updates**

---

## 5.8 Data Model Additions for Feature 3

### tenant_responses additions
Add fields if not already present:
- `associatedAirfilterReminderId` (nullable)
- `associationMethod` (nullable string)
- `associationConfidence` (nullable decimal)
- `interpretedStatus` (nullable string)
- `autoUpdatedSystem` (boolean)
- `needsManualReview` (boolean)

### airfilter_reminders additions
Add fields if useful:
- `requiresManualReview` (boolean)
- `autoUpdatedFromResponse` (boolean)
- `autoUpdatedAt` (nullable datetime)

### Optional airfilter_response_matches table
If separate matching records are preferred:
- `id`
- `tenantResponseId`
- `airfilterReminderId`
- `matchConfidence`
- `matchMethod`
- `interpretedStatus`
- `wasAutoApplied`
- `reviewedByUserId` (nullable)
- `reviewedAt` (nullable)
- `createdAt`

---

## 5.9 Backend Requirements for Feature 3

### Required components
- response association service
- airfilter response interpretation service
- status update handler
- audit logging for automatic status changes

### Suggested processing flow
1. receive inbound message or email reply
2. identify whether conversation relates to an airfilter request
3. locate associated unresolved airfilter reminder
4. interpret response text
5. decide:
   - auto-update
   - keep pending
   - manual review
6. persist audit trail
7. refresh related UI/state

---

## 5.10 Acceptance Criteria for Feature 3

- System can identify responses associated with airfilter reminder messages
- System can capture status from tenant responses and update the airfilter workflow automatically when confidence is sufficient
- Confirmed responses stop future reminder sends for that due cycle
- Ambiguous responses are flagged for manual review
- Audit/history clearly shows how the response was associated and whether the system auto-updated the status
- Permissions control who can review and approve ambiguous airfilter response matches

---

## 6) Phase 2 Permissions Summary

Add the following new permission labels to **Settings > Access**:

### Messages
- **Generate AI Replies**
- **Send AI Replies**
- **Enable or Disable AI Auto Responses**
- **View AI Auto Response Activity**

### Airfilters
- **Review Airfilter Response Matches**
- **Approve Airfilter Auto Updates**

---

## 7) API / Backend Endpoint Suggestions

### AI Reply Generation
- `POST /api/messages/ai-reply`

### AI Auto Response Settings
- `GET /api/settings`
- `PUT /api/settings`

### Airfilter Response Matching
- `POST /api/messages/process-inbound-response`
- `GET /api/maintenance/airfilters/response-matches`
- `PATCH /api/maintenance/airfilters/response-matches/:matchId/review`

### Optional AI Activity APIs
- `GET /api/messages/ai-activity`

---

## 8) Final Build Instructions for Antigravity

Use the following as the direct implementation prompt:

```text
Enhance the existing Property Management Portal with the following Phase 2 features:

Feature 1:
- Add AI-assisted reply drafting in the Messages module.
- Keep the existing manual message composer unchanged.
- Add a second reply box called "AI Suggested Reply".
- Use Groq inference to generate reply drafts from the current conversation context.
- Configure Groq using environment variables:
  - GROQ_API_KEY
  - GROQ_MODEL_NAME
- Do not expose Groq credentials in frontend code.
- Add buttons:
  - Generate AI Reply
  - Regenerate
  - Use in Manual Reply
  - Send AI Reply
- AI-generated drafts must be editable before sending.

Feature 2:
- In Settings > General, add a configurable option called "Enable Auto Responses to Messages".
- When enabled, the system should automatically send AI-generated responses to incoming messages based on message content, business context, and conversation context.
- When disabled, AI-generated replies should only be available as editable drafts in the AI Suggested Reply box.
- Add audit/activity tracking for automatic AI responses.

Feature 3:
- System should automatically find tenant responses associated with airfilter change request messages.
- It should capture the response status and update the airfilter workflow automatically when appropriate.
- If tenant response clearly indicates the filter has been changed, update status to confirmed and stop future reminders for that cycle.
- If the response is ambiguous, require manual review.

Additional requirements:
- Add RBAC permissions for AI reply generation/sending, AI auto-response management, and airfilter response review/approval.
- Reuse the existing outbound messaging pipeline for sending AI replies and auto responses.
- Use exact UI wording and exact permission labels from this specification.
- Preserve all existing Phase 1 behavior.
```

---

## 9) Notes

- This Phase 2 document currently includes **Feature 1, Feature 2, and Feature 3**.
- More Phase 2 features can be appended incrementally.
- Keep Phase 1 behavior intact while adding these features.
