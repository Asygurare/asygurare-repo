"use client";

import Image from "next/image";

const LAST_UPDATED = "26 de febrero de 2026";

export default function ZoomIntegrationDocs() {
  return (
    <main className="min-h-screen bg-(--bg) px-7 pt-36 pb-20">
      <div className="max-w-4xl mx-auto">
        <header className="mb-10">
          <span className="inline-block px-4 py-1.5 bg-(--accents) border border-[#4A7766]/20 rounded-full text-white text-xs font-bold tracking-widest uppercase mb-6">
            Integration Guide
          </span>
          <div className="flex items-center gap-5 mb-6">
            <div className="h-16 w-16 rounded-2xl bg-white border border-black/5 flex items-center justify-center shadow-sm">
              <Image
                src="/logo_integrations/zoom_logo.png"
                alt="Zoom"
                width={48}
                height={48}
                className="h-10 w-10 object-contain"
              />
            </div>
            <h1 className="text-4xl md:text-6xl font-medium tracking-tight leading-[1.05] text-(--text)">
              Zoom Integration
            </h1>
          </div>
          <p className="text-base md:text-lg text-gray-600 leading-relaxed">
            Connect your Zoom account to Asygurare to view upcoming meetings in your calendar,
            sync them as tasks, and join calls with one click.
          </p>
          <p className="text-sm text-gray-500 mt-4">
            Last updated: <span className="font-medium">{LAST_UPDATED}</span>
          </p>
        </header>

        {/* Overview */}
        <section className="rounded-3xl bg-white/50 border border-black/5 p-6 md:p-8 mb-8">
          <h2 className="text-xl md:text-2xl font-semibold text-(--text) mb-4">Overview</h2>
          <p className="text-gray-700 leading-relaxed mb-4">
            The Asygurare Zoom integration uses OAuth 2.0 to securely connect your Zoom account.
            Once connected, you can:
          </p>
          <ul className="space-y-2 text-gray-700 leading-relaxed">
            <li className="flex items-start gap-2">
              <span className="text-(--accents) font-bold mt-0.5">•</span>
              View your upcoming Zoom meetings in the Asygurare calendar alongside Google Calendar, Calendly, and Cal.com events.
            </li>
            <li className="flex items-start gap-2">
              <span className="text-(--accents) font-bold mt-0.5">•</span>
              Sync Zoom meetings as internal tasks with title, date, and join link.
            </li>
            <li className="flex items-start gap-2">
              <span className="text-(--accents) font-bold mt-0.5">•</span>
              Join meetings directly from the calendar with one click.
            </li>
            <li className="flex items-start gap-2">
              <span className="text-(--accents) font-bold mt-0.5">•</span>
              Automatic deduplication prevents duplicate tasks when syncing.
            </li>
          </ul>
        </section>

        {/* Prerequisites */}
        <section className="rounded-3xl bg-white/50 border border-black/5 p-6 md:p-8 mb-8">
          <h2 className="text-xl md:text-2xl font-semibold text-(--text) mb-4">Prerequisites</h2>
          <ul className="space-y-2 text-gray-700 leading-relaxed">
            <li className="flex items-start gap-2">
              <span className="font-bold text-(--text) mt-0.5">1.</span>
              An active Asygurare account.
            </li>
            <li className="flex items-start gap-2">
              <span className="font-bold text-(--text) mt-0.5">2.</span>
              A Zoom account (Free, Pro, Business, or Enterprise).
            </li>
          </ul>
        </section>

        {/* How to Add */}
        <section className="rounded-3xl bg-white/50 border border-black/5 p-6 md:p-8 mb-8">
          <h2 className="text-xl md:text-2xl font-semibold text-(--text) mb-4">How to Add the Zoom Integration</h2>
          <ol className="space-y-4 text-gray-700 leading-relaxed">
            <li className="flex items-start gap-3">
              <span className="inline-flex items-center justify-center h-7 w-7 rounded-full bg-(--accents) text-white text-sm font-bold shrink-0">1</span>
              <div>
                <p className="font-semibold text-(--text)">Log in to Asygurare</p>
                <p className="text-gray-600 mt-1">Sign in to your Asygurare account and navigate to the <strong>Calendario</strong> (Calendar) page.</p>
              </div>
            </li>
            <li className="flex items-start gap-3">
              <span className="inline-flex items-center justify-center h-7 w-7 rounded-full bg-(--accents) text-white text-sm font-bold shrink-0">2</span>
              <div>
                <p className="font-semibold text-(--text)">Find the Zoom card</p>
                <p className="text-gray-600 mt-1">In the &quot;Integraciones de calendario&quot; section at the top of the page, locate the Zoom integration card.</p>
              </div>
            </li>
            <li className="flex items-start gap-3">
              <span className="inline-flex items-center justify-center h-7 w-7 rounded-full bg-(--accents) text-white text-sm font-bold shrink-0">3</span>
              <div>
                <p className="font-semibold text-(--text)">Click &quot;Conectar&quot;</p>
                <p className="text-gray-600 mt-1">You will be redirected to Zoom&apos;s authorization page. Sign in with your Zoom account and approve the requested permissions.</p>
              </div>
            </li>
            <li className="flex items-start gap-3">
              <span className="inline-flex items-center justify-center h-7 w-7 rounded-full bg-(--accents) text-white text-sm font-bold shrink-0">4</span>
              <div>
                <p className="font-semibold text-(--text)">You&apos;re connected</p>
                <p className="text-gray-600 mt-1">After approving, you&apos;ll be redirected back to Asygurare. The Zoom card will display &quot;Conectado&quot; with your Zoom email. Your upcoming meetings will load automatically.</p>
              </div>
            </li>
          </ol>
        </section>

        {/* How to Use */}
        <section className="rounded-3xl bg-white/50 border border-black/5 p-6 md:p-8 mb-8">
          <h2 className="text-xl md:text-2xl font-semibold text-(--text) mb-4">How to Use</h2>
          <div className="space-y-6">
            <div>
              <h3 className="font-semibold text-(--text) mb-2">Viewing meetings</h3>
              <p className="text-gray-700 leading-relaxed">
                Once connected, your upcoming Zoom meetings appear in the calendar. In the Day and Month views,
                Zoom meetings are shown with a blue indicator and a &quot;Join&quot; button that opens the meeting link directly.
              </p>
            </div>
            <div>
              <h3 className="font-semibold text-(--text) mb-2">Refreshing meetings</h3>
              <p className="text-gray-700 leading-relaxed">
                Click the &quot;Sync&quot; button on the Zoom card to fetch the latest meetings from your Zoom account.
              </p>
            </div>
            <div>
              <h3 className="font-semibold text-(--text) mb-2">Syncing meetings as tasks</h3>
              <p className="text-gray-700 leading-relaxed">
                Click &quot;A tareas&quot; on the Zoom card to import your Zoom meetings as internal tasks.
                Each meeting becomes a task with the meeting title, scheduled date, and join link in the notes.
                Existing meetings are updated (not duplicated) on subsequent syncs.
              </p>
            </div>
            <div>
              <h3 className="font-semibold text-(--text) mb-2">Reauthorizing</h3>
              <p className="text-gray-700 leading-relaxed">
                If your connection expires or you need to update permissions, click &quot;Reautorizar&quot; on the Zoom card
                to go through the authorization flow again.
              </p>
            </div>
          </div>
        </section>

        {/* How to Remove */}
        <section className="rounded-3xl bg-white/50 border border-black/5 p-6 md:p-8 mb-8">
          <h2 className="text-xl md:text-2xl font-semibold text-(--text) mb-4">How to Remove the Zoom Integration</h2>
          <ol className="space-y-4 text-gray-700 leading-relaxed">
            <li className="flex items-start gap-3">
              <span className="inline-flex items-center justify-center h-7 w-7 rounded-full bg-red-500 text-white text-sm font-bold shrink-0">1</span>
              <div>
                <p className="font-semibold text-(--text)">Go to the Calendar page</p>
                <p className="text-gray-600 mt-1">Navigate to <strong>Calendario</strong> and find the Zoom integration card.</p>
              </div>
            </li>
            <li className="flex items-start gap-3">
              <span className="inline-flex items-center justify-center h-7 w-7 rounded-full bg-red-500 text-white text-sm font-bold shrink-0">2</span>
              <div>
                <p className="font-semibold text-(--text)">Click &quot;Desconectar&quot;</p>
                <p className="text-gray-600 mt-1">A confirmation prompt will appear. Confirm to disconnect.</p>
              </div>
            </li>
            <li className="flex items-start gap-3">
              <span className="inline-flex items-center justify-center h-7 w-7 rounded-full bg-red-500 text-white text-sm font-bold shrink-0">3</span>
              <div>
                <p className="font-semibold text-(--text)">Done</p>
                <p className="text-gray-600 mt-1">
                  Your Zoom OAuth tokens are immediately deleted from our database. Zoom meetings will no longer appear in your calendar.
                  Any tasks previously synced from Zoom will remain in your task list but will no longer update.
                </p>
              </div>
            </li>
          </ol>
          <div className="mt-6 p-4 rounded-2xl bg-amber-50 border border-amber-100">
            <p className="text-sm text-amber-800 leading-relaxed">
              <strong>Note:</strong> You can also revoke access from your Zoom account by going to the{" "}
              <a
                href="https://marketplace.zoom.us/user/installed"
                target="_blank"
                rel="noreferrer"
                className="underline font-medium hover:text-amber-900"
              >
                Zoom App Marketplace
              </a>{" "}
              → Manage → Installed Apps → Asygurare → Remove.
            </p>
          </div>
        </section>

        {/* Data & Privacy */}
        <section className="rounded-3xl bg-white/50 border border-black/5 p-6 md:p-8 mb-8">
          <h2 className="text-xl md:text-2xl font-semibold text-(--text) mb-4">Data &amp; Privacy</h2>
          <ul className="space-y-2 text-gray-700 leading-relaxed">
            <li className="flex items-start gap-2">
              <span className="text-(--accents) font-bold mt-0.5">•</span>
              We only access your Zoom user email and upcoming meetings list. We do not access recordings, chat messages, or other Zoom data.
            </li>
            <li className="flex items-start gap-2">
              <span className="text-(--accents) font-bold mt-0.5">•</span>
              OAuth tokens are stored securely in our database with Row Level Security — only you can access your own connection data.
            </li>
            <li className="flex items-start gap-2">
              <span className="text-(--accents) font-bold mt-0.5">•</span>
              Meeting data is fetched in real-time and is not permanently stored. Only a meeting ID-to-task mapping is saved when you sync to tasks.
            </li>
            <li className="flex items-start gap-2">
              <span className="text-(--accents) font-bold mt-0.5">•</span>
              All data is deleted immediately when you disconnect the integration.
            </li>
            <li className="flex items-start gap-2">
              <span className="text-(--accents) font-bold mt-0.5">•</span>
              For more details, see our{" "}
              <a href="/privacy" className="underline font-medium text-(--accents) hover:opacity-80">
                Privacy Policy
              </a>.
            </li>
          </ul>
        </section>

        {/* Support */}
        <section className="rounded-3xl bg-white/50 border border-black/5 p-6 md:p-8 mb-8">
          <h2 className="text-xl md:text-2xl font-semibold text-(--text) mb-4">Support</h2>
          <p className="text-gray-700 leading-relaxed">
            If you have questions or need help with the Zoom integration, contact us at{" "}
            <a href="mailto:admin@asygurare.com" className="underline font-medium text-(--accents) hover:opacity-80">
              admin@asygurare.com
            </a>{" "}
            or visit our{" "}
            <a href="/contact" className="underline font-medium text-(--accents) hover:opacity-80">
              Contact page
            </a>.
          </p>
        </section>
      </div>
    </main>
  );
}
