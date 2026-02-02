// app/routes.tsx
import { type RouteConfig, index, route } from "@react-router/dev/routes";

// ✅ This file should ONLY export the RouteConfig array.
// ❌ Do NOT export a React component with <Route /> here.

export default [
  index("routes/home.tsx"),
  route("/auth", "routes/auth.tsx"),
  route("/upload", "routes/upload.tsx"),

  // ✅ ADD THIS (feedback page)
  route("/resume/:id", "routes/resume.tsx"),
] satisfies RouteConfig;
