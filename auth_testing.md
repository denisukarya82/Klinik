# Auth Testing Playbook — SIM Klinik Bidan

Admin: denisukarya003@gmail.com / bidan123 (role admin, auto-seeded)

## API
curl -c cookies.txt -X POST http://localhost:8001/api/auth/login -H "Content-Type: application/json" -d '{"email":"denisukarya003@gmail.com","password":"bidan123"}'
curl -b cookies.txt http://localhost:8001/api/auth/me

Login returns user object + sets access_token/refresh_token cookies. /me returns same user.

## Password reset (local test)
Set FRONTEND_URL="http://localhost:3000" in /app/backend/.env, restart backend — reset link is logged.
Register a readable test account first, then forgot-password, grab link from backend log, reset-password.
Restore https FRONTEND_URL after.

## Indexes
users.email unique, password_reset_tokens.expires_at TTL + token_hash unique,
login_attempts.email/identifier, password_reset_requests.email + created_at TTL.
