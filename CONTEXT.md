# Zona de Damas - Session Context

## Last Session: 2026-02-18

## Project Status
- API: Running on port 3001 (NestJS + Prisma + MySQL/XAMPP)
- Web: Running on port 3000 (Next.js 14)
- Database: MySQL via XAMPP (MariaDB), database name: "zonadedamas"
- Auth: Working (login with admin@zonadedamas.com / Admin123!)
- Sidebar: Working (all 8 navigation items visible)

## What Was Done
1. Fixed `AuditModule` - added `@Global()` decorator to resolve DI error
2. Fixed `next.config.ts` -> `next.config.js` (Next.js 14 doesn't support .ts config)
3. Fixed login endpoint to return user permissions (needed for sidebar)
4. Fixed sidebar permission format: changed `:` to `.` separator to match DB
5. Ran seed successfully (demo tenant, users, employees, services, clients)
6. Initial commit pushed to GitHub: https://github.com/seriba23/Zonadedamas

## Known Issues Still Pending
- **Availability Picker broken**: Frontend sends `{ date, serviceIds }` but backend expects `{ startDate, endDate, locationId, serviceIds }`. The response format also doesn't match.
- **Build artifacts not in .gitignore**: `apps/api/jest.config.js`, `seed.js`, `.d.ts`, `.map`, `.tsbuildinfo` files are untracked but should be gitignored.

## How to Start the Project
```bash
# 1. Start XAMPP (Apache + MySQL must be running)

# 2. Install dependencies (only needed first time or after pulling)
cd C:\xampp\htdocs\Zonadedamas
npm install

# 3. Start the API (terminal 1)
cd C:\xampp\htdocs\Zonadedamas\apps\api
npm run dev
# If port 3001 is busy: npx kill-port 3001

# 4. Start the Web frontend (terminal 2)
cd C:\xampp\htdocs\Zonadedamas\apps\web
npm run dev

# 5. Open browser
# Dashboard: http://localhost:3000/login
# Login: admin@zonadedamas.com / Admin123!
```

## Demo Credentials
- **Email:** admin@zonadedamas.com
- **Password:** Admin123!
- **Role:** Owner (all permissions)

## Pages Available
- `/login` - Login
- `/calendar` - Calendar/appointments
- `/clients` - Client management
- `/services` - Service catalog
- `/staff` - Employee management
- `/resources` - Resource management
- `/pos` - Point of sale
- `/reports` - Reports
- `/settings/roles` - Roles & permissions
- `/book/demo-salon` - Public booking page
