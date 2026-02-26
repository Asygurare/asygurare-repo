"use client";

const LAST_UPDATED = "26 de febrero de 2026";

export default function SSDLCPage() {
  return (
    <main className="min-h-screen bg-white px-7 pt-36 pb-20 print:pt-10 print:px-12">
      <div className="max-w-4xl mx-auto">
        <header className="mb-10">
          <h1 className="text-3xl md:text-4xl font-bold tracking-tight text-black mb-2">
            Secure Software Development Lifecycle (SSDLC)
          </h1>
          <p className="text-lg text-gray-600">Asygurare — Zoom Integration</p>
          <p className="text-sm text-gray-400 mt-2">Last updated: {LAST_UPDATED}</p>
        </header>

        <section className="mb-10">
          <h2 className="text-xl font-semibold text-black mb-3">1. Overview</h2>
          <p className="text-gray-700 leading-relaxed">
            Asygurare follows a secure-by-default development approach for all features, including third-party integrations
            such as Zoom. Security is embedded throughout the development process — from design and coding to deployment
            and monitoring.
          </p>
        </section>

        <section className="mb-10">
          <h2 className="text-xl font-semibold text-black mb-3">2. Secure Design Principles</h2>
          <ul className="space-y-3 text-gray-700 leading-relaxed">
            <li><strong>Least Privilege:</strong> The Zoom integration requests only the minimum scopes required (meeting:read:list_meetings, user:read:email). No write access to Zoom data is requested.</li>
            <li><strong>Defense in Depth:</strong> Multiple layers of security are applied — OAuth 2.0 with CSRF state validation, Row Level Security at the database level, httpOnly secure cookies, and TLS encryption in transit.</li>
            <li><strong>Data Minimization:</strong> Only essential data is stored (OAuth tokens and user email). Meeting data is fetched in real-time and not persisted.</li>
          </ul>
        </section>

        <section className="mb-10">
          <h2 className="text-xl font-semibold text-black mb-3">3. Secure Coding Practices</h2>
          <ul className="space-y-3 text-gray-700 leading-relaxed">
            <li><strong>TypeScript:</strong> The entire codebase is written in TypeScript with strict type checking, preventing common runtime errors and type-related vulnerabilities.</li>
            <li><strong>Input Validation:</strong> All user inputs and API parameters are validated and sanitized. Query parameters are bounded (e.g., pagination limits) to prevent abuse.</li>
            <li><strong>No Secret Exposure:</strong> All sensitive credentials (API keys, OAuth secrets, database keys) are stored as server-side environment variables and are never exposed to the client bundle.</li>
            <li><strong>Secure Authentication:</strong> OAuth 2.0 authorization code flow with random state parameter (CSRF protection) verified via httpOnly, secure, SameSite cookies.</li>
            <li><strong>Token Management:</strong> Access tokens are short-lived (1 hour) and automatically refreshed. Refresh tokens are preserved securely and replaced on rotation.</li>
            <li><strong>Error Handling:</strong> Error messages returned to clients are generic and do not expose internal implementation details, stack traces, or sensitive data.</li>
          </ul>
        </section>

        <section className="mb-10">
          <h2 className="text-xl font-semibold text-black mb-3">4. Infrastructure Security</h2>
          <ul className="space-y-3 text-gray-700 leading-relaxed">
            <li><strong>Hosting (Vercel):</strong> The application is deployed on Vercel with automatic TLS 1.2+ certificates, DDoS protection, and edge network distribution. All traffic is encrypted in transit.</li>
            <li><strong>Database (Supabase/AWS):</strong> PostgreSQL database hosted on Supabase (AWS infrastructure) with AES-256 encryption at rest, TLS encryption in transit, and Row Level Security (RLS) policies enforcing per-user data isolation.</li>
            <li><strong>Edge Runtime:</strong> API routes run on Vercel Edge Runtime, which provides a sandboxed V8 isolate environment with no access to the filesystem or Node.js APIs, reducing the attack surface.</li>
            <li><strong>Security Headers:</strong> The application serves OWASP-recommended HTTP security headers including Content-Security-Policy, X-Content-Type-Options, and Referrer-Policy.</li>
          </ul>
        </section>

        <section className="mb-10">
          <h2 className="text-xl font-semibold text-black mb-3">5. Access Control</h2>
          <ul className="space-y-3 text-gray-700 leading-relaxed">
            <li><strong>User Authentication:</strong> All users must authenticate via Supabase Auth before accessing any integration features. Unauthenticated requests are rejected with a 401 response.</li>
            <li><strong>Row Level Security:</strong> Database policies ensure users can only read, update, or delete their own Zoom connection data. Cross-user data access is impossible at the database level.</li>
            <li><strong>Service Role Isolation:</strong> The Supabase service role key is only used server-side and is never exposed to the browser client.</li>
          </ul>
        </section>

        <section className="mb-10">
          <h2 className="text-xl font-semibold text-black mb-3">6. Version Control &amp; Deployment</h2>
          <ul className="space-y-3 text-gray-700 leading-relaxed">
            <li><strong>Git:</strong> All source code is managed in a private Git repository with commit history and change tracking.</li>
            <li><strong>Environment Separation:</strong> Development (localhost) and production environments use separate environment variables and configuration, including distinct OAuth redirect URIs.</li>
            <li><strong>Automated Deployments:</strong> Production deployments are handled through Vercel&apos;s CI/CD pipeline with automatic builds and previews for each change.</li>
          </ul>
        </section>

        <section className="mb-10">
          <h2 className="text-xl font-semibold text-black mb-3">7. Data Retention &amp; Deletion</h2>
          <ul className="space-y-3 text-gray-700 leading-relaxed">
            <li><strong>Immediate Deletion:</strong> When a user disconnects the Zoom integration, all stored OAuth tokens and connection data are immediately deleted from the database.</li>
            <li><strong>Cascade Deletion:</strong> If a user account is deleted, all associated Zoom connection data is automatically removed via foreign key cascade constraints.</li>
            <li><strong>No Logging of Tokens:</strong> OAuth tokens are never written to application logs or error tracking systems.</li>
          </ul>
        </section>

        <section className="mb-10">
          <h2 className="text-xl font-semibold text-black mb-3">8. Incident Response</h2>
          <p className="text-gray-700 leading-relaxed">
            In the event of a security incident involving Zoom user data, Asygurare will:
            (1) immediately revoke affected OAuth tokens,
            (2) notify affected users,
            (3) notify Zoom per their developer guidelines, and
            (4) investigate and remediate the root cause.
            Users can contact <a href="mailto:admin@asygurare.com" className="underline text-blue-700">contacto@asygurare.com</a> to report security concerns.
          </p>
        </section>

        <div className="mt-16 pt-8 border-t border-gray-200 text-sm text-gray-400 print:mt-8">
          <p>Asygurare — Secure Software Development Lifecycle Document</p>
          <p>Document version 1.0 — {LAST_UPDATED}</p>
        </div>
      </div>
    </main>
  );
}
