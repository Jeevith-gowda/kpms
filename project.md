# Property Management Portal – Consolidated Development Specification

> **Purpose:** This document consolidates all approved requirements for building the Property Management Portal. It is intended to be provided to **Claude Code** (or another AI coding assistant) as the primary development specification.
>
> **Security requirement:** Any API keys or credentials previously shared outside this document must be considered exposed. Do **not** hardcode secrets in source code, prompts, repositories, or frontend code. Store secrets only in environment variables or a secure secret manager, and rotate any exposed credentials.

---

## 1) Product Summary

Build an internal **Property Management Portal** for a property management company that integrates with:

- **DoorLoop** for property / lease / tenant data
- **OpenPhone** for SMS / phone communication
- **Email provider** (SMTP, SendGrid, or Microsoft 365) for email reminders

The application must support the following primary modules:

1. **Authentication & Access Control**
2. **Doors**
3. **Maintenance > Airfilters**
4. **Messages**
5. **Settings**
   - **General**
   - **Access**

---

## 2) Business Goals

### Primary goals
- Centralize property, tenant, landlord, maintenance reminder, and tenant communication workflows in one internal system.
- Synchronize active lease/property data from DoorLoop into the application database.
- Automatically send air filter change reminders based on the lease start date.
- Allow staff to manage SMS conversations and monitor tenant responses.
- Support configurable reminder frequency, channels, automation behavior, test routing, and role-based access control.

### Non-goals for V1
- Replacing DoorLoop completely
- Accounting / ledger / payment processing
- Full maintenance ticket lifecycle beyond airfilter reminder workflow
- Full telephony replacement / call center feature set

---

## 3) Core Business Rule – Airfilter Due Date

### Rule
The **quarterly due date for each property is calculated based on the lease start date of the respective property**.

### Source of truth
- **Lease Start Date** from DoorLoop is the anchor date.
- Air filter change cadence is every **3 months** from the lease start date.

### System must calculate
- **Previous Filter Change Date**
- **Next Filter Change Date**

### Current Month tab rule
A property appears in **Current Month** if:
- the calculated **Next Filter Change Date** falls within the current calendar month.

### Example
If Lease Start Date = **February 10, 2024**, then the quarterly schedule is:
- May 10, 2024
- August 10, 2024
- November 10, 2024
- February 10, 2025
- May 10, 2025
- etc.

If today is in **May 2026**:
- **Previous Filter Change Date** = February 10, 2026
- **Next Filter Change Date** = May 10, 2026
- This property is due in the current month and should appear under **Current Month**.

---

## 4) Suggested Technology Stack

### Frontend
- **Next.js** (latest stable, App Router)
- **React**
- **TypeScript**
- **Tailwind CSS**
- **shadcn/ui**
- **TanStack Query**

### Backend
#### Preferred option
- Next.js API routes / server actions

#### Alternative option
- Node.js + NestJS or Express API + Next.js frontend

### Database
- **PostgreSQL**
- **Prisma** ORM

### Scheduler / background jobs
- **BullMQ** or **node-cron**
- Redis if BullMQ is used

### Authentication
Choose one of:
- **NextAuth/Auth.js**
- **Microsoft Entra ID**
- **Clerk**

### External providers
- **DoorLoop** for leases / properties / tenants
- **OpenPhone** for SMS messaging
- **SMTP / SendGrid / Microsoft 365** for email reminders

---

## 5) Navigation Structure

Use a left sidebar navigation with these items:

- **Dashboard**
- **Doors**
- **Maintenance**
  - **Airfilters**
- **Messages**
- **Settings**
  - **General**
  - **Access**

Navigation visibility must be permission-based.

---

## 6) Authentication & Access Control

## 6.1 Login Requirement
The system must require login before allowing access to any application page.

### Login page UI wording
- **Page title:** `Sign In`
- **Subtitle:** `Sign in to access the Property Management Portal.`
- **Fields:**
  - `Email Address`
  - `Password`
- **Button:** `Sign In`

### Authentication behavior
- All application routes must require authentication except the login page.
- Unauthenticated users must be redirected to the login page.

---

## 6.2 User Roles
The system must support exactly two user roles:

- **Admin**
- **Employee**

### Default role behavior
- **Admin** → full access to all features by default
- **Employee** → limited access controlled by permissions configured in **Settings > Access**

---

## 6.3 Secure Initial Admin Bootstrap
The application must **not** contain hardcoded default credentials.

### Approved safe approach
The system must support secure creation of the first Admin user using one of the following:

1. **Bootstrap Admin via environment variables**, or
2. **One-time setup flow**

### Initial admin requirement
- The initial admin username **may be configured as `karma`** if desired.
- The password must **not** be hardcoded in source code, prompts, or committed configuration.
- The password must be supplied securely at deployment time via environment variable or setup flow.
- The initial admin must be required to **change password on first login**.
- Bootstrap creation must only happen if **no active Admin user exists**.
- Bootstrap creation must be logged in audit history.

### Forbidden behavior
- No fixed default admin password
- No baked-in fallback credentials
- No plaintext password storage

---

## 6.4 Access Control Model
Use **role-based access control (RBAC)** with configurable permissions.

### Permission enforcement
Permissions must be enforced in both:
- **Frontend UI** (hide / disable navigation and actions)
- **Backend APIs / server actions** (block unauthorized access)

### Permission labels (exact wording)

#### Dashboard
- **View Dashboard**

#### Doors
- **View Doors**
- **Refresh Doors Data**

#### Airfilters
- **View Airfilters**
- **Send Reminder Manually**
- **Send Bulk Reminders**
- **Update Filter Changed Status**
- **Pause or Resume Reminders**
- **View Reminder History**

#### Messages
- **View Messages**
- **Send Messages**

#### Settings
- **View Settings - General**
- **View Settings - Access**
- **Manage Access Settings**

#### User Management
- **Manage Users**

### Example permission behavior
- If a user lacks **View Messages**, the **Messages** navigation item must not appear.
- If a user can view Airfilters but lacks **Send Reminder Manually**, the page can be visible but the send action must be hidden or disabled.
- Only Admin users can access **Settings > Access**.

---

## 7) Doors Module

## 7.1 Purpose
The **Doors** page shows all properties and related information stored in the application database.

## 7.2 Data stored in the local database
The system must maintain its **own internal database** of:
- properties
- units (if applicable)
- tenants
- landlords
- leases
- occupancy status
- last sync timestamps

The app must not rely solely on live rendering from DoorLoop responses.

## 7.3 Occupancy status logic
- `Leased` → property / unit has an active lease
- `Vacant` → property / unit does not have an active lease

## 7.4 Doors page UI wording
- **Page title:** `Doors`
- **Subtitle:** `View and manage properties, tenants, landlords, and occupancy status.`
- **Primary button:** `Refresh from DoorLoop`
- **Secondary text:** `Last refreshed:` `MM/DD/YYYY hh:mm A`

## 7.5 Doors page exact table column names
1. **Property Name**
2. **Property Address**
3. **Unit / Suite**
4. **Tenant Name**
5. **Tenant Phone**
6. **Landlord Name**
7. **Occupancy Status**
8. **Lease Start Date**
9. **Lease End Date**
10. **Last Synced**
11. **Actions**

## 7.6 Doors actions wording
- **View Property Details**
- **View Tenant Details**
- **View Landlord Details**
- **Open Conversation**
- **View Airfilter History**

## 7.7 Doors refresh behavior
When user clicks **Refresh from DoorLoop**:
1. Call internal API `POST /api/doors/refresh`
2. Trigger a server-side sync from DoorLoop
3. Pull latest lease / property / tenant / landlord data
4. Upsert normalized records into the internal database
5. Recalculate occupancy status
6. Refresh the Doors page data

### UI behavior for Refresh
- Show loading state while refresh runs
- Disable button during refresh
- Show success toast: `DoorLoop sync completed successfully.`
- Show error toast: `DoorLoop sync failed. Please try again.`

---

## 8) Maintenance > Airfilters Module

## 8.1 Purpose
The Airfilters module tracks quarterly filter change schedule, sends reminders, records tenant responses, and allows manual override by staff.

## 8.2 Tabs
The Airfilters page must have two tabs:
- **Current Month**
- **All Time**

### Tab behavior
#### Current Month
Show only properties whose **Next Filter Change Date** falls in the current calendar month.

#### All Time
Show all properties, regardless of due date.

Both tabs must use the same table structure.

## 8.3 Airfilters page UI wording
- **Page title:** `Airfilters`
- **Subtitle:** `Track quarterly air filter changes, send reminders, and monitor tenant confirmations.`

### Summary cards
- **Due This Month**
- **Pending Reminders**
- **Sent Today**
- **Confirmed Changed**

### Search placeholder
- `Search by property, tenant, phone, or email`

### Filter labels
- `Reminder Status`
- `Filter Changed`
- `Occupancy Status`
- `Property`

## 8.4 Airfilters table layout (final approved layout)

### Exact table columns
1. **Property Name**
2. **Occupancy Status**
3. **Previous Filter Change Date**
4. **Next Filter Change Date**
5. **Reminder Status**
6. **Reminder Sent Date**
7. **Filter Changed**
8. **Actions**

### Property Name cell display rules
Do **not** show Tenant Name, Tenant Phone, or Tenant Email as separate columns.

Within the **Property Name** cell, display:
- Primary line (bold): **Street Name / Property Name**
- Secondary line (small font): **Tenant Name**
- Tertiary line (small font): **Tenant Phone • Tenant Email**

Example:

```text
1234 Main Street
John Doe
(704) 555-1234 • john.doe@email.com
```

### Occupancy Status badge values
- **Leased**
- **Vacant**

### Reminder Status badge values
- **Pending**
- **Sent**
- **Awaiting Tenant Confirmation**
- **Confirmed Changed**
- **Failed**
- **Skipped**
- **Manually Updated**

### Filter Changed badge values
- **Yes**
- **No**

### Actions menu wording
- **Preview Reminder**
- **Send Reminder Now**
- **Mark Filter Changed**
- **Mark as Not Changed**
- **Pause Reminders**
- **Resume Reminders**
- **View Reminder History**
- **Open Conversation**

### Bulk action button wording
- **Send All Due Reminders**

### Empty state wording (Current Month)
- `No properties are due for air filter change this month.`
- `Switch to “All Time” to view all properties and filter schedules.`

### Empty state wording (All Time)
- `No airfilter records found.`
- `Refresh property data or verify your sync configuration.`

### Success toasts
- `Reminder sent successfully.`
- `Daily reminder schedule started successfully.`
- `Filter changed status updated successfully.`

### Error toasts
- `Reminder failed to send. Please try again.`
- `Status update failed. Please try again.`

---

## 8.5 Reminder history panel
### Title
- **Reminder History**

### Exact table column names
1. **Property Name**
2. **Quarter**
3. **Due Month**
4. **Reminder Channel**
5. **Reminder Status**
6. **Sent At**
7. **Tenant Response**
8. **Tenant Response At**
9. **Filter Changed**
10. **Updated By**
11. **Audit Created At**

---

## 8.6 Reminder sending behavior
When a property becomes due:
1. Send reminder via **SMS** if SMS is enabled and tenant phone exists
2. Send reminder via **Email** if Email is enabled and tenant email exists
3. Store reminder records and delivery logs
4. Continue sending reminders according to configured frequency until stop condition is met

### Stop conditions
Recurring reminders must stop immediately when any of the following becomes true:
- **Filter Changed = Yes**
- **Reminder Status = Confirmed Changed**
- **Pause Reminders = On**
- lease becomes inactive

---

## 8.7 Automatic tenant response handling
If a tenant replies via SMS or email indicating the filter has been changed:
- link the response to the related reminder / tenant / property
- update:
  - **Filter Changed = Yes**
  - **Reminder Status = Confirmed Changed**
  - **Tenant Response**
  - **Tenant Response At**
- stop future reminders for that due cycle

### Response interpretation rule
Use configurable phrase detection for phrases such as:
- `changed`
- `done`
- `completed`
- `I changed it`
- `filter replaced`

If confidence is low, mark for **manual review** instead of auto-confirming.

---

## 8.8 Manual status update by staff
Staff must be able to manually update:
- **Filter Changed** = Yes / No
- **Reminder Status**
- **Pause Reminders** = On / Off
- **Tenant Response Notes**

---

## 9) Messages Module

## 9.1 Purpose
The Messages page allows staff to view and manage SMS conversations from OpenPhone.

## 9.2 Messages page UI wording
- **Page title:** `Messages`
- **Subtitle:** `View and manage tenant conversations.`
- **Left pane title:** `Conversations`
- **Search placeholder:** `Search by tenant name or phone number`
- **Empty state:** `Select a conversation to view messages.`
- **Composer placeholder:** `Type your message here...`
- **Button:** `Send Message`

### Message status wording
- **Sending**
- **Sent**
- **Delivered**
- **Failed**

## 9.3 Required behavior
- View conversation list
- View message thread
- Send outbound messages
- Associate conversations with property / tenant when possible
- Support tenant-response-driven airfilter updates

---

## 10) Settings Module

The Settings module has two submenus:
- **General**
- **Access**

---

## 10.1 Settings > General

### Page title
- **Settings**

### Subtitle
- `Configure reminder delivery, automation, and testing options.`

### Section 1: Reminder Frequency
- **Field label:** `Send Reminder Frequency`
- Allowed values:
  - **Every Day**
  - **Every 2 Days**
  - **Every 3 Days**
  - **Weekly**
- Default: **Every Day**

### Section 2: Reminder Channels
- **Toggle:** `Send via SMS`
- **Toggle:** `Send via Email`
- Default:
  - SMS = On
  - Email = On
- Validation:
  - At least one channel must remain enabled

### Section 3: Automatic Sending
- **Toggle:** `Send Messages Automatically`
- Default: On

### Section 4: Test Routing
- **Toggle:** `Send Every Message to Default Number`
- Default: Off
- **Field label:** `Default Test Phone Number`
- Placeholder: `Enter default phone number`

### General settings buttons
- **Save Settings**
- **Reset to Defaults**

### General settings toasts
- `Settings saved successfully.`
- `Failed to save settings. Please try again.`

### General settings behavior
#### Reminder frequency
Scheduler must support:
- Every Day → every 1 day
- Every 2 Days → every 2 days
- Every 3 Days → every 3 days
- Weekly → every 7 days

#### Channel behavior
- If SMS is On, attempt SMS for tenants with phone numbers
- If Email is On, attempt Email for tenants with email addresses
- If both are On, use both

#### Automatic sending behavior
- If **Send Messages Automatically** is On, scheduler sends due reminders automatically
- If Off, users must send reminders manually

#### Test routing behavior
- If **Send Every Message to Default Number** is On, all outgoing SMS reminders must be routed to the configured default test phone number instead of tenant numbers
- Logs/history must indicate test routing was used
- Actual tenant phone must still be stored for reference

---

## 10.2 Settings > Access

Only Admin users can access this page.

### Page title
- **Access**

### Subtitle
- `Manage user roles and configure access to system features.`

### Section 1: User Roles
#### Table title
- **Users and Roles**

#### Exact table column names
1. **User Name**
2. **Email Address**
3. **Role**
4. **Status**
5. **Last Login**
6. **Actions**

#### Role options
- **Admin**
- **Employee**

#### Status values
- **Active**
- **Inactive**

#### Actions wording
- **Edit Access**
- **Change Role**
- **Deactivate User**
- **Activate User**

### Section 2: Feature Access Matrix
#### Section title
- **Feature Access**

#### Description
- `Configure which features are available to each role.`

#### Matrix columns
1. **Permission**
2. **Admin**
3. **Employee**

#### Default rules
- Admin → all permissions enabled
- Employee → configurable by Admin

### Access buttons
- **Save Access Settings**
- **Reset Access Defaults**

### Access toasts
- `Access settings saved successfully.`
- `Failed to save access settings. Please try again.`

### Validation rules
- Only Admin can access **Settings > Access**
- At least one Admin user must remain active
- Employees must not be able to grant themselves Admin access

---

## 11) DoorLoop Integration

### Sync requirements
The system must sync lease/property/tenant data from DoorLoop into the local database.

### Expected sync behavior
- Run sync on demand via **Refresh from DoorLoop**
- Optionally run scheduled sync daily
- Normalize provider payload into app models
- Upsert properties, units, tenants, landlords, leases
- Update occupancy status
- Update last sync timestamps

### DoorLoop endpoint provided by requester (for implementation reference)
```bash
GET https://app.doorloop.com/api/leases?filter_status=ACTIVE&period=all-time&period_startDate=all-time&period_endDate=all-time
Authorization: <DOORLOOP_API_KEY>
```

> Use a server-side adapter. Never expose API keys in client code.

---

## 12) OpenPhone and Email Integration

## 12.1 SMS requirements
- Send reminder messages through OpenPhone
- Receive inbound SMS replies
- Link SMS replies to corresponding tenant / reminder

## 12.2 Email requirements
- Send email reminders through configurable provider
- Receive email replies when supported by provider/webhook
- If email reply capture is not supported, allow manual staff update

## 12.3 Delivery logging
Every reminder send attempt must be logged with:
- channel
- sent time
- provider message id (if available)
- delivery status
- actual intended recipient
- delivered-to recipient
- whether test routing was used
- error message if any

---

## 13) Data Model (Consolidated)

Below is the consolidated data model. Use Prisma models matching this structure.

## 13.1 users
- `id`
- `name`
- `email`
- `passwordHash` (or external identity reference)
- `role` (`ADMIN`, `EMPLOYEE`)
- `status` (`ACTIVE`, `INACTIVE`)
- `mustChangePassword` (boolean)
- `lastLoginAt` (nullable datetime)
- `createdAt`
- `updatedAt`

## 13.2 permissions
- `id`
- `permissionKey`
- `permissionLabel`
- `createdAt`

## 13.3 role_permissions
- `id`
- `role` (`ADMIN`, `EMPLOYEE`)
- `permissionKey`
- `isEnabled` (boolean)
- `updatedByUserId` (nullable)
- `updatedAt`

## 13.4 properties
- `id`
- `externalId`
- `name`
- `address1`
- `address2`
- `city`
- `state`
- `zip`
- `occupancyStatus` (`LEASED`, `VACANT`)
- `createdAt`
- `updatedAt`

## 13.5 units
- `id`
- `externalId`
- `propertyId`
- `unitNumber`
- `occupancyStatus` (`LEASED`, `VACANT`)
- `createdAt`
- `updatedAt`

## 13.6 landlords
- `id`
- `externalId`
- `fullName`
- `companyName` (nullable)
- `phone`
- `email`
- `address1`
- `address2`
- `city`
- `state`
- `zip`
- `createdAt`
- `updatedAt`

## 13.7 tenants
- `id`
- `externalId`
- `firstName`
- `lastName`
- `fullName`
- `primaryPhone`
- `email`
- `createdAt`
- `updatedAt`

## 13.8 leases
- `id`
- `externalId`
- `propertyId`
- `unitId`
- `tenantId`
- `landlordId` (nullable)
- `status`
- `startDate`
- `endDate`
- `isActive`
- `lastSyncedAt`
- `createdAt`
- `updatedAt`

## 13.9 conversations
- `id`
- `externalId`
- `tenantId` (nullable)
- `propertyId` (nullable)
- `phoneNumber`
- `inboxStatus`
- `lastMessageAt`
- `createdAt`
- `updatedAt`

## 13.10 messages
- `id`
- `externalId`
- `conversationId`
- `direction` (`INBOUND`, `OUTBOUND`)
- `body`
- `status`
- `provider`
- `sentAt`
- `rawPayload` (JSON)
- `createdAt`
- `updatedAt`

## 13.11 app_settings
- `id`
- `reminderFrequency` (`EVERY_DAY`, `EVERY_2_DAYS`, `EVERY_3_DAYS`, `WEEKLY`)
- `sendViaSms` (boolean)
- `sendViaEmail` (boolean)
- `sendMessagesAutomatically` (boolean)
- `sendEveryMessageToDefaultNumber` (boolean)
- `defaultTestPhoneNumber` (nullable string)
- `updatedByUserId` (nullable)
- `updatedAt`
- `createdAt`

## 13.12 airfilter_reminders
- `id`
- `propertyId`
- `unitId` (nullable)
- `leaseId` (nullable)
- `tenantId` (nullable)
- `landlordId` (nullable)
- `quarterKey` (example: `2026-Q2`)
- `dueMonthKey` (example: `2026-05`)
- `previousFilterChangeDate` (nullable)
- `nextFilterChangeDate`
- `dueDate`
- `status` (`PENDING`, `SENT`, `AWAITING_TENANT_CONFIRMATION`, `CONFIRMED_CHANGED`, `FAILED`, `SKIPPED`, `MANUALLY_UPDATED`)
- `pauseReminders` (boolean)
- `filterChanged` (boolean)
- `filterChangedAt` (nullable datetime)
- `filterChangedByUserId` (nullable)
- `lastReminderSentAt` (nullable datetime)
- `nextReminderScheduledAt` (nullable datetime)
- `tenantResponseText` (nullable text)
- `tenantResponseAt` (nullable datetime)
- `tenantResponseChannel` (`SMS`, `EMAIL`, nullable)
- `messageId` (nullable)
- `sentAt` (nullable)
- `skippedAt` (nullable)
- `errorMessage` (nullable)
- `createdAt`
- `updatedAt`

## 13.13 reminder_deliveries
- `id`
- `airfilterReminderId`
- `channel` (`SMS`, `EMAIL`)
- `status`
- `providerMessageId` (nullable)
- `sentAt`
- `actualRecipient` (nullable)
- `deliveredToRecipient` (nullable)
- `usedTestRouting` (boolean)
- `errorMessage` (nullable)
- `createdAt`

## 13.14 tenant_responses
- `id`
- `airfilterReminderId`
- `channel` (`SMS`, `EMAIL`)
- `responseText`
- `responseDetectedAsChanged` (boolean)
- `responseConfidence` (nullable decimal)
- `responseReviewedByUserId` (nullable)
- `responseReviewedAt` (nullable datetime)
- `createdAt`

## 13.15 airfilter_reminder_audit
- `id`
- `airfilterReminderId`
- `previousStatus` (nullable)
- `newStatus`
- `notes` (nullable)
- `providerResponseId` (nullable)
- `createdByUserId` (nullable)
- `createdAt`

---

## 14) API Design

## 14.1 Auth APIs
- `POST /api/auth/login`
- `POST /api/auth/logout`
- `GET /api/auth/me`

## 14.2 Doors APIs
- `GET /api/doors`
- `GET /api/doors/:propertyId`
- `POST /api/doors/refresh`

## 14.3 Airfilters APIs
- `GET /api/maintenance/airfilters?view=current-month|all-time`
- `POST /api/maintenance/airfilters/send/:reminderId`
- `POST /api/maintenance/airfilters/send-bulk`
- `PATCH /api/maintenance/airfilters/:reminderId/status`
- `PATCH /api/maintenance/airfilters/:reminderId/filter-changed`
- `PATCH /api/maintenance/airfilters/:reminderId/pause-reminders`
- `GET /api/maintenance/airfilters/history`

## 14.4 Messages APIs
- `GET /api/messages/conversations`
- `GET /api/messages/conversations/:conversationId`
- `POST /api/messages/send`
- `POST /api/messages/webhook`
- `POST /api/email/webhook`

## 14.5 Settings APIs
- `GET /api/settings`
- `PUT /api/settings`
- `GET /api/settings/access`
- `PUT /api/settings/access`

## 14.6 User APIs
- `GET /api/users`
- `PATCH /api/users/:userId/role`
- `PATCH /api/users/:userId/status`

---

## 15) Scheduler and Automation

## 15.1 Reminder scheduler
Run a scheduled job that evaluates due reminders and follow-up reminders using the saved settings.

### Scheduler logic
1. Load `app_settings`
2. Find all active reminders where:
   - property is currently due
   - `filterChanged = false`
   - `pauseReminders = false`
   - status is not `CONFIRMED_CHANGED`
3. Determine if a reminder is due to send based on:
   - reminder frequency
   - `lastReminderSentAt`
   - `nextReminderScheduledAt`
   - `sendMessagesAutomatically`
4. Send via enabled channels
5. Apply test routing if enabled
6. Store delivery logs
7. Calculate and save next reminder schedule

### Reminder frequency mapping
- Every Day → every 1 day
- Every 2 Days → every 2 days
- Every 3 Days → every 3 days
- Weekly → every 7 days

---

## 16) Testing Requirements

### Unit tests
- quarter/date calculation from lease start date
- current month due logic
- permission evaluation
- reminder frequency scheduling
- response interpretation logic

### Integration tests
- DoorLoop sync flow
- OpenPhone send flow
- email send flow
- access control enforcement
- recurring reminder job

### UI tests
- login flow
- Doors refresh
- Airfilters Current Month / All Time tabs
- Settings General
- Settings Access
- permission-based navigation visibility

---

## 17) Acceptance Criteria (Consolidated)

### Authentication & Access
- User must sign in before using the system
- System supports exactly two user roles: **Admin** and **Employee**
- Admin has full access by default
- Employee access is limited and configurable
- **Settings > Access** exists
- Only Admin can manage access settings
- Unauthorized users cannot access restricted pages, actions, or APIs

### Doors
- User can open **Doors**
- System displays properties from local DB
- User can click **Refresh from DoorLoop**
- System syncs latest data and updates Doors list

### Airfilters
- System calculates due dates using lease start date + 3 months cadence
- **Current Month** shows only currently due properties
- **All Time** shows all properties
- Tenant Name / Phone / Email appear inside the **Property Name** column and not as separate columns
- System automatically sends reminders using SMS and/or Email according to Settings
- System continues reminders until tenant confirms or staff updates status or reminders are paused
- Staff can manually update filter changed status and reminder status

### Settings > General
- User can configure reminder frequency
- User can enable/disable SMS and Email
- Both SMS and Email are enabled by default
- User can enable/disable automatic sending
- User can enable test routing to default phone number

### Settings > Access
- Admin can manage roles and permissions
- At least one Admin user remains active
- Permission changes affect navigation, actions, and backend authorization

---

## 18) Final Build Instructions for Claude Code

Use the following as the direct development prompt:

```text
Build a production-quality internal Property Management Portal using Next.js, React, TypeScript, Tailwind CSS, shadcn/ui, Prisma, and PostgreSQL.

The application integrates with DoorLoop for property/lease data, OpenPhone for SMS messaging, and a configurable email provider for email reminders.

Main navigation:
- Dashboard
- Doors
- Maintenance
  - Airfilters
- Messages
- Settings
  - General
  - Access

Core requirements:
1. Add login to the system.
2. Support exactly two roles: Admin and Employee.
3. Admin has full access by default.
4. Employee access is controlled through Settings > Access.
5. Enforce permissions in both UI and backend.
6. Build a Doors page with Refresh from DoorLoop.
7. Build Airfilters page with Current Month and All Time tabs.
8. Calculate quarterly due dates from lease start date.
9. In the Airfilters table, show Tenant Name, Tenant Phone, and Tenant Email inside the Property Name cell in smaller font, not as separate columns.
10. Automatically send reminders via SMS and Email when due, based on General settings.
11. Continue reminders according to configured frequency until tenant confirms change, staff updates status, or reminders are paused.
12. Add Settings > General with reminder frequency, channel toggles, automatic sending, and default test phone routing.
13. Add Settings > Access with users/roles table and feature access matrix.
14. Use exact UI wording, exact column names, and exact permission labels from this specification.
15. Do not hardcode any credentials or secrets. Support secure bootstrap creation of the first Admin user, and require password change on first login.
16. Build auditable history for reminders, deliveries, tenant responses, role changes, and settings changes.

Deliverables:
- full project structure
- Prisma schema
- API routes/server actions
- auth implementation
- permission enforcement
- frontend pages/components
- scheduler/background jobs
- .env.example
- README with setup and run steps
```

---

## 19) Final Notes

- Prioritize clean architecture over quick shortcuts.
- All provider integrations must be server-side only.
- Secrets must be stored in environment variables only.
- No hardcoded default credentials.
- The system must support secure bootstrap creation of the first Admin.
- Use audit/history tables for all sensitive actions and automation flows.

---

## 20) Recent Updates & Bug Fixes (May 2026 Session)

During the final configuration and testing phase, the following enhancements and fixes were applied to the application:

### Webhooks & Messaging Sync
- **Webhook Payload Structure:** Updated the webhook API to correctly parse deeply nested payloads (`data.object`) arriving from OpenPhone/Quo.
- **Outbound Message Tracking:** Built a helper function to automatically log outbound automated Airfilter reminders into the `Message` and `Conversation` tables, allowing staff to view the outbound messages natively in the KPMS Messages page.
- **Phone Number Normalization:** Resolved a bug where webhooks sending numbers with a `+1` prefix created duplicate separate conversation threads. Phone numbers are now normalized and matched using the last 10 digits.
- **External Outbound Sync:** Updated the webhook configuration to listen to both `message.received` and `message.sent` events. This ensures that when a staff member replies to a tenant directly from the Quo mobile app, it syncs back to the KPMS Messages page.

### Airfilter Reminders & Due Dates
- **Updated Reminder Wording:** Modified the automated text to explicitly request a dated photo: *"Hi [Name], this is a reminder to change the air filter at [Address]. When finished, please reply 'changed' along with a photo of the new filter showing the current date. Thank you! - KPMS"*
- **Strict Date Filtering:** Changed the "Due" calculation for automated Cron jobs and Bulk Sends from evaluating the *entire calendar month* to strictly sending only if the date is due on or before the *exact current day*.
- **Pending Reminders Removed:** Removed the "Pending Reminders" stat card from the Airfilters summary UI to simplify the dashboard interface.
- **Bulk Send Confirmation Modal:** Added a pre-flight confirmation modal when clicking "Send All Due Reminders". It evaluates the exact list of recipients based on the current date, showing their names, addresses, and contact info before the user commits to sending.

### UI / UX Enhancements
- **Messages Auto-Refresh:** Added a 5-second auto-polling interval to the React Query hooks on the Messages page. Incoming and outgoing messages now instantly appear without a page reload.
- **Mobile Responsiveness:** Refactored the Messages page to be fully mobile responsive. The split-pane layout now intelligently stacks on small screens, showing the conversation list first, and opening full-width with a "Back" button when a thread is selected.

### Deployment Configuration & Fixes (Vercel & MongoDB)
- **Vercel Cron Limit Fix:** Updated ercel.json to schedule the background reminders daily at 14:00 UTC (  14 * * *) to comply with the Vercel Hobby tier limits (1 execution per day).
- **Prisma Vercel Caching Fix:** Updated the uild script in package.json to "prisma generate && next build" and added a postinstall script to ensure the Prisma client is properly generated and not aggressively cached by Vercel.
- **Next.js Static Generation Fix:** Appended export const dynamic = 'force-dynamic'; to the top of all API routes. This prevents the Next.js builder from attempting to statically execute database queries during the Vercel build phase (which causes Failed to collect page data errors).
- **MongoDB Atlas Firewall:** Verified that MongoDB Atlas Network Access must be set to allow IP  .0.0.0/0 (Allow Access From Anywhere) to successfully connect from Vercel's dynamic IP environment.
- **Webhook Production URL:** Configured the OpenPhone/Quo webhook to point to the live Vercel domain (https://[domain].vercel.app/api/messages/webhook), ensuring both message.received and message.sent events are active.

### Mobile Experience & PWA Support
- **Progressive Web App (PWA):** Added manifest.json and root layout meta tags (ppleWebApp, ormatDetection) to make the application fully installable on iOS and Android devices, allowing it to run in standalone full-screen mode without browser chrome.
- **Responsive App Layout:** Refactored the core application layout (layout.tsx and sidebar.tsx) to support a mobile-first design. On smaller screens, the fixed sidebar converts into a hidden off-canvas drawer that can be toggled via a top app-bar hamburger menu, ensuring the main content is never horizontally squeezed.

### Phase 2: AI Automation & Responses
- **Feature 1 (AI Reply Suggestions):** Added an AI Assistant composer box in the Messages UI that uses Groq inference to draft context-aware replies based on the conversation history and property/tenant context. Users can edit and send these drafts directly or copy them to the manual composer.
- **Feature 2 (AI Auto Responses):** Implemented a configurable setting in Settings > General to automatically send AI-generated replies to inbound tenant messages when no airfilter confirmation logic handles it. Auto-generations are saved with wasAutoSent auditing.
- **Feature 3 (Airfilter Automatic Associations):** Updated the webhook parser to understand ambiguous and negative tenant responses using negative/positive phrase heuristics. Positive confirmations (e.g. "changed", "done") with high confidence automatically update the active airfilter reminder status to CONFIRMED_CHANGED and stop the reminder sequence. Ambiguous responses correctly flag the reminder to equiresManualReview.
- **Phase 2 Permissions:** Added granular Role-Based Access Control (RBAC) permissions for generating AI replies, sending AI replies, enabling auto-responses, and approving airfilter auto-updates.
