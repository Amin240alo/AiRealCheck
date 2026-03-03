# AIRealCheck Setup

**Local Development**
1. Backend starten:

```bash
python -m Backend.server
```

2. Frontend starten (Repo-Root):

```bash
python -m http.server 5500
```

Dann `http://127.0.0.1:5500` öffnen. Auth-Seiten sind Client-Routing (bitte innerhalb der App navigieren).

**Database**
Set `DATABASE_URL` for SQLAlchemy and `DATABASE_URL_PSQL` for `psql` (must be `postgresql://...`).

```bash
psql "$DATABASE_URL_PSQL" -f Backend/migrations/001_init.sql
```

If you already have a DB, apply the display name migration:

```bash
psql "$DATABASE_URL_PSQL" -f Backend/migrations/002_add_display_name.sql
```

Minimal `.env` settings:

```env
DATABASE_URL=postgresql+psycopg2://user:pass@localhost:5432/airealcheck
DATABASE_URL_PSQL=postgresql://user:pass@localhost:5432/airealcheck
AIREALCHECK_JWT_SECRET=change_me
AIREALCHECK_ACCESS_TOKEN_MINUTES=15
AIREALCHECK_REFRESH_TOKEN_DAYS=30
AIREALCHECK_VERIFY_TOKEN_HOURS=48
AIREALCHECK_RESET_TOKEN_HOURS=2
AIREALCHECK_ANALYSIS_COST=1
AIREALCHECK_PUBLIC_API_URL=http://localhost:5001
AIREALCHECK_PUBLIC_WEB_URL=http://localhost:5500
AIREALCHECK_ENABLE_GUEST_ANALYZE=false
AIREALCHECK_COOKIE_SECURE=false
```

**Frontend Config (CONFIG)**
`CONFIG` wird vom Frontend geladen:

```json
{
  "api_base": "http://127.0.0.1:5001",
  "enable_guest_analyze": false
}
```

`enable_guest_analyze` sollte zu `AIREALCHECK_ENABLE_GUEST_ANALYZE` passen.

**SMTP / E-Mail**
Required for verification and password reset mails. For local dev, MailHog is a good lightweight option:

```bash
docker run -p 1025:1025 -p 8025:8025 mailhog/mailhog
```

Then open `http://127.0.0.1:8025` to view captured emails and use:

```env
SMTP_HOST=localhost
SMTP_PORT=1025
SMTP_USE_TLS=false
SMTP_USE_SSL=false
```

Production example:

```env
SMTP_HOST=smtp.example.com
SMTP_PORT=587
SMTP_USER=mailer@example.com
SMTP_PASS=supersecret
SMTP_FROM=AIRealCheck <mailer@example.com>
SMTP_USE_TLS=true
SMTP_USE_SSL=false
```

**Google OAuth (optional)**
Environment placeholders for future OAuth wiring:

```env
GOOGLE_OAUTH_CLIENT_ID=
GOOGLE_OAUTH_CLIENT_SECRET=
GOOGLE_OAUTH_REDIRECT_URI=http://localhost:5001/auth/google/callback
```

**Notes**
- `/auth/register` creates a verification token and sends an email.
- Verification/reset links use `AIREALCHECK_PUBLIC_WEB_URL` if set, otherwise the API URL.
- `/auth/verify?token=...` verifies the email.
- `/auth/forgot` + `/auth/reset` handle password resets.
- `/auth/login` returns an access token and sets a refresh cookie.
