# Property Management Portal

Internal property management system integrating DoorLoop, OpenPhone, and email.

## Stack

- **Next.js 15** (App Router) + React + TypeScript
- **Tailwind CSS** + custom shadcn/ui components
- **Prisma ORM** + **MongoDB Atlas**
- **JWT** sessions (jose)
- **node-cron** background scheduler

## Setup

### 1. Clone and install

```bash
git clone <repo>
cd kpms
npm install
```

### 2. Configure environment

```bash
cp .env.example .env
```

Edit `.env` with your values:

| Variable | Description |
|---|---|
| `DATABASE_URL` | MongoDB Atlas connection string |
| `JWT_SECRET` | Long random string for JWT signing |
| `BOOTSTRAP_ADMIN_EMAIL` | Email for initial admin account |
| `BOOTSTRAP_ADMIN_PASSWORD` | Password for initial admin (will need to change on first login) |
| `BOOTSTRAP_ADMIN_NAME` | Display name (default: `karma`) |
| `DOORLOOP_API_KEY` | DoorLoop API key |
| `OPENPHONE_API_KEY` | OpenPhone API key |
| `OPENPHONE_PHONE_NUMBER_ID` | OpenPhone phone number ID |
| `SMTP_HOST` / `SMTP_PORT` / `SMTP_USER` / `SMTP_PASS` | SMTP credentials |

### 3. Generate Prisma client

```bash
npx prisma generate
```

### 4. Run development server

```bash
npm run dev
```

Visit [http://localhost:3000](http://localhost:3000). You will be redirected to `/login`.

On first boot, the server automatically:
1. Seeds all permissions into the database
2. Creates the bootstrap Admin user (if `BOOTSTRAP_ADMIN_EMAIL` and `BOOTSTRAP_ADMIN_PASSWORD` are set)

### 5. First login

- Sign in with the bootstrap admin email/password
- You will be forced to change the password immediately

## Production

```bash
npm run build
npm start
```

## Webhooks

Configure your OpenPhone account to send webhooks to:
```
POST https://your-domain.com/api/messages/webhook
```

This handles inbound SMS replies and auto-confirms air filter changes when tenants reply with phrases like "changed", "done", etc.

## Permissions

Admin users have all permissions by default. Employee permissions are configurable under **Settings > Access**.

Available permissions:
- View Dashboard
- View Doors / Refresh Doors Data
- View Airfilters / Send Reminder Manually / Send Bulk Reminders / Update Filter Changed Status / Pause or Resume Reminders / View Reminder History
- View Messages / Send Messages
- View Settings - General / View Settings - Access / Manage Access Settings
- Manage Users
