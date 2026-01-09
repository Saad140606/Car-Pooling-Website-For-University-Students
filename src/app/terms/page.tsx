import Link from "next/link";

export const metadata = {
  title: "Terms & Privacy - University Car Pooling",
};

export default function TermsPage() {
  return (
    <div className="max-w-5xl mx-auto p-6">
      <div className="mb-6">
        <h1 className="text-3xl font-bold mb-2">Terms, Regulations &amp; Privacy Policy</h1>
        <div className="flex flex-wrap items-center gap-3 text-sm text-slate-400">
          <span><strong>Effective Date:</strong> 1 January 2026</span>
          <span className="px-1">•</span>
          <span><strong>Last Updated:</strong> 10 January 2026</span>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-[220px,1fr] gap-6">
        {/* TOC */}
        <nav className="hidden md:block p-4 rounded-lg bg-slate-800/40 border border-slate-700 shadow-sm h-min sticky top-24">
          <h4 className="text-sm font-semibold mb-3 text-slate-100">On This Page</h4>
          <ul className="space-y-2 text-sm">
            <li><a className="text-accent hover:underline" href="#part-1">Part 1 — Terms &amp; Regulations</a></li>
            <li><a className="text-accent hover:underline" href="#part-2">Part 2 — Operational &amp; Ethical</a></li>
            <li><a className="text-accent hover:underline" href="#part-3">Part 3 — Privacy Policy</a></li>
          </ul>
        </nav>

        <article className="prose prose-invert bg-slate-900/40 p-6 rounded-lg border border-slate-700 shadow-sm">
          <p>This document governs the registration, access, and use of the University Car Pooling Application (“Application”, “Platform”, “Service”). The Application is intended exclusively for members of recognized academic institutions, including but not limited to FAST National University and NED University of Engineering &amp; Technology.</p>
          <p>By registering, accessing, or using this Application, you acknowledge that you have read, understood, and agreed to be legally bound by all provisions contained herein.</p>

          <section id="part-1" className="mt-6">
            <div className="flex items-center gap-3 mb-3">
              <span className="inline-flex items-center px-2 py-1 rounded-full bg-indigo-600 text-white text-xs font-semibold">Part 1</span>
              <h2 className="text-xl font-semibold m-0">Terms &amp; Regulations (Rules of Use)</h2>
            </div>

            <h3>1. Purpose of the Platform</h3>
            <p>The Application exists solely to facilitate ride coordination within the university community. It aims to:</p>
            <ul>
              <li>Improve accessibility to campus transportation</li>
              <li>Encourage cost-sharing</li>
              <li>Reduce traffic congestion</li>
              <li>Promote environmental responsibility</li>
            </ul>
            <p>The Platform does not operate as a transport company, employer, or commercial service provider.</p>

            <h3>2. Scope of Applicability</h3>
            <p>These Terms apply to all registered users, all interactions conducted through the Platform, and all ride-related communications and arrangements. Use of the Platform outside academic purposes is prohibited.</p>

            <h3>3. Definitions</h3>
            <p>For interpretation purposes:</p>
            <ul>
              <li><strong>User:</strong> Any registered individual using the Platform</li>
              <li><strong>Ride Provider:</strong> A user who voluntarily offers available vehicle seating</li>
              <li><strong>Ride Participant:</strong> A user who joins a shared ride</li>
              <li><strong>Ride Listing:</strong> Information posted to coordinate a journey</li>
              <li><strong>Platform:</strong> The digital car pooling system and services</li>
            </ul>

            <h3>4. Eligibility &amp; Verification</h3>
            <p>To register, a user must be affiliated with a recognized university, provide accurate personal and academic information, and maintain updated and truthful records. False representation may result in immediate termination.</p>

            <h3>5. Account Responsibility</h3>
            <p>One account per individual. Accounts are non-transferable. Users are fully responsible for activity under their credentials. Credential sharing is prohibited.</p>

            <h3>6. Standards of Conduct</h3>
            <p>All users must behave respectfully and professionally, avoid harassment, discrimination, or intimidation, and follow university ethical norms. Zero tolerance applies to misconduct.</p>

            <h3>7. Ride Coordination Principles</h3>
            <p>Ride coordination is voluntary and based on mutual consent. Ride Providers determine availability, while Ride Participants must respect agreed timings and locations. The Platform does not enforce ride completion.</p>

            <h3>8. Financial Arrangements</h3>
            <p>Cost-sharing is mutually agreed. The Platform does not process or guarantee payments. Disputes are private matters between users.</p>

            <h3>9. Safety &amp; Risk Acknowledgment</h3>
            <p>Users acknowledge participation is voluntary, travel involves inherent risks, and the Platform does not guarantee safety outcomes. Participation is at one’s own discretion.</p>

            <h3>10. Limitation of Liability</h3>
            <p>The Platform does not own vehicles, does not supervise rides, does not verify road conditions or behavior, and is not liable for injuries, delays, losses, or disputes.</p>

            <h3>11. Prohibited Activities</h3>
            <p>Users must not use the Platform commercially, share misleading information, engage in illegal activity, or attempt technical exploitation. Violations may result in permanent suspension.</p>

            <h3>12. Suspension &amp; Termination</h3>
            <p>The Platform reserves the right to suspend accounts without notice and permanently restrict access to protect community integrity.</p>

            <h3>13. Amendments</h3>
            <p>Terms may be updated at any time. Continued use implies acceptance.</p>
          </section>

          <section id="part-2" className="mt-8">
            <div className="flex items-center gap-3 mb-3">
              <span className="inline-flex items-center px-2 py-1 rounded-full bg-rose-600 text-white text-xs font-semibold">Part 2</span>
              <h2 className="text-xl font-semibold m-0">Detailed Operational &amp; Ethical Framework</h2>
            </div>

            <h3>14. Academic Integrity Alignment</h3>
            <p>Users must uphold institutional values, ethical conduct, and academic reputation. Any behavior harming university integrity may result in removal.</p>

            <h3>15. Ride Listings &amp; Accuracy</h3>
            <p>Ride information must be accurate, updated, and honest. Repeated cancellations or misleading details may trigger review.</p>

            <h3>16. Communication Guidelines</h3>
            <p>Platform communication must be ride-related only, remain respectful, and avoid spam or solicitation.</p>

            <h3>17. Shared Responsibility &amp; Belongings</h3>
            <p>All participants share responsibility for conduct. Personal belongings remain the sole responsibility of each user.</p>

            <h3>18. Health &amp; Behavioral Expectations</h3>
            <p>Users must ensure they do not pose risk to others. Prohibited behavior includes substance use, aggression, or unwanted advances.</p>

            <h3>19. Reporting &amp; Complaints</h3>
            <p>Users may report misconduct in good faith. False or malicious reports are prohibited.</p>

            <h3>20. No Employment or Agency</h3>
            <p>No employment, partnership, or agency relationship is created. The Platform is a facilitator only.</p>

            <h3>21. Technical Integrity</h3>
            <p>Users must not hack, reverse engineer, or interfere with services. System logs may be monitored for security.</p>

            <h3>22. Intellectual Property</h3>
            <p>All Platform content belongs to the Application. Unauthorized use is prohibited.</p>

            <h3>23. Service Availability</h3>
            <p>Downtime, maintenance, or interruptions may occur. No uninterrupted service guarantee exists.</p>

            <h3>24. Force Majeure</h3>
            <p>The Platform is not liable for events beyond reasonable control.</p>

            <h3>25. Governing Law</h3>
            <p>These Terms are governed by the laws of Pakistan. Jurisdiction lies with competent courts.</p>
          </section>

          <section id="part-3" className="mt-8">
            <div className="flex items-center gap-3 mb-3">
              <span className="inline-flex items-center px-2 py-1 rounded-full bg-emerald-600 text-white text-xs font-semibold">Part 3</span>
              <h2 className="text-xl font-semibold m-0">Privacy Policy</h2>
            </div>

            <h3>26. Data Collected</h3>
            <p>We may collect identity information, academic affiliation, ride coordination details, and technical usage data.</p>

            <h3>27. Purpose of Data Use</h3>
            <p>Data is used to enable platform functionality, ensure safety and integrity, improve services, and communicate updates.</p>

            <h3>28. Data Sharing</h3>
            <p>Shared only between relevant ride participants. Never sold or commercially distributed. Disclosed only when legally required.</p>

            <h3>29. Data Security</h3>
            <p>Reasonable safeguards are applied. Absolute security cannot be guaranteed.</p>

            <h3>30. Data Retention</h3>
            <p>Data is retained only as necessary. Users may request deletion unless restricted by law.</p>

            <h3>31. User Rights</h3>
            <p>Users may access data, update information, and request account deletion.</p>

            <h3>32. Privacy Breach Response</h3>
            <p>Reasonable steps will be taken in case of breach, including review and mitigation.</p>

            <h3>33. Policy Updates</h3>
            <p>Changes will be communicated via the Platform. Continued use implies consent.</p>
          </section>

          <hr className="my-6 border-slate-700" />
          <p className="text-sm">Registration requires explicit agreement by checking the consent box on the registration form. For questions or legal concerns, contact your university administrator.</p>
          <p className="text-sm">Return to <Link href="/auth/fast/register" className="text-accent underline">registration</Link>.</p>
        </article>
      </div>
    </div>
  );
}
