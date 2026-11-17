export type LegalText = {
  kind: "title" | "heading" | "paragraph";
  text: string;
};

export const PRIVACY_COPY: LegalText[] = [
  {
    kind: "paragraph",
    text: "Privacy Policy",
  },
  {
    kind: "title",
    text: "NovusMail Privacy Policy",
  },
  {
    kind: "paragraph",
    text: "Last updated: June 19, 2026",
  },
  {
    kind: "paragraph",
    text: "At NovusMail, we are committed to protecting your privacy. This Privacy Policy describes how we collect, use, disclose, and safeguard your information when you use our command-deck application, which integrates with Gmail and Google Calendar.",
  },
  {
    kind: "heading",
    text: "1. Information We Collect",
  },
  {
    kind: "paragraph",
    text: "To provide our keyboard-first inbox and calendar workspace, we access and store the following data:",
  },
  {
    kind: "paragraph",
    text: "Account Identity: Your email address and display name obtained during Google Sign-In.",
  },
  {
    kind: "paragraph",
    text: "Google API Credentials: Tenant-scoped OAuth access and refresh tokens used to authenticate requests to Google APIs.",
  },
  {
    kind: "paragraph",
    text: "Workspace Cache: Temporarily cached Gmail message headers, thread details, labels, and Google Calendar events stored locally in a secure database to enable priority sync, fast search, and offline views.",
  },
  {
    kind: "heading",
    text: "2. Google API Data & Limited Use Disclosure",
  },
  {
    kind: "paragraph",
    text: "NovusMail's use and transfer of information received from Google APIs to any other app will adhere to the Google API Services User Data Policy, including the Limited Use requirements.",
  },
  {
    kind: "paragraph",
    text: "Specifically, we do not use your Google user data for serving advertisements, and we do not transfer this data to third parties unless required for security, legal compliance, or as part of providing the core workspace features.",
  },
  {
    kind: "heading",
    text: "3. How We Use Information",
  },
  {
    kind: "paragraph",
    text: "We process your data strictly to deliver the service, including:",
  },
  {
    kind: "paragraph",
    text: "Displaying your unified focus queue, message details, and calendar agenda on a single workspace interface.",
  },
  {
    kind: "paragraph",
    text: "Executing message actions (reply, archive, star, trash) and event mutations directly on your behalf.",
  },
  {
    kind: "paragraph",
    text: "Powering proposal-based AI features to draft emails or draft calendar events. All AI-generated changes require your explicit review and confirmation before leaving the application.",
  },
  {
    kind: "heading",
    text: "4. Data Security & Encryption",
  },
  {
    kind: "paragraph",
    text: "Security is foundational to NovusMail. Sensitive credentials (such as Google OAuth refresh tokens) are encrypted at rest in our database using a secure Key Encryption Key (KEK). Data in transit is secured using industry-standard Transport Layer Security (TLS/HTTPS).",
  },
  {
    kind: "heading",
    text: "5. Data Sharing & AI Providers",
  },
  {
    kind: "paragraph",
    text: "We do not sell, rent, or trade your personal information. We do not use Google API data to train artificial intelligence or machine learning models. If you use the optional AI operator to draft replies or inspect context, only the relevant email thread or calendar snippet is sent to our AI API provider to generate the draft. These providers are contractually bound not to retain or use your data for training.",
  },
  {
    kind: "heading",
    text: "6. Your Control & Account Deletion",
  },
  {
    kind: "paragraph",
    text: "You can revoke NovusMail's access to your Google Account at any time via your Google Security Settings. To request permanent deletion of your account and cached data from our systems, please contact support at vinayrpdev@gmail.com.",
  },
  {
    kind: "heading",
    text: "7. Contact Us",
  },
  {
    kind: "paragraph",
    text: "If you have any questions or concerns regarding this Privacy Policy or our data practices, please contact us at:",
  },
  {
    kind: "paragraph",
    text: "Email: vinayrpdev@gmail.com",
  },
];

export const TERMS_COPY: LegalText[] = [
  {
    kind: "paragraph",
    text: "Terms of Service",
  },
  {
    kind: "title",
    text: "NovusMail Terms of Service",
  },
  {
    kind: "paragraph",
    text: "Last updated: June 19, 2026",
  },
  {
    kind: "paragraph",
    text: "Welcome to NovusMail. By accessing or using our command-deck application, you agree to be bound by these Terms of Service. If you do not agree to these terms, please do not use the application.",
  },
  {
    kind: "heading",
    text: "1. Description of Service",
  },
  {
    kind: "paragraph",
    text: "NovusMail is a keyboard-first, multi-panel workspace built to consolidate and streamline your Gmail and Google Calendar workflows. Features include local-first priority sorting, lightning-fast full-text search, command palette actions, and proposal-based AI assistance.",
  },
  {
    kind: "heading",
    text: "2. Account Credentials & Google Integration",
  },
  {
    kind: "paragraph",
    text: "Access to NovusMail requires authenticating via Google Sign-In and authorizing access to your Gmail and Google Calendar scopes. You are responsible for:",
  },
  {
    kind: "paragraph",
    text: "Maintaining the confidentiality of your Google Account and password.",
  },
  {
    kind: "paragraph",
    text: "Ensuring the accuracy of the email address associated with your workspace tenant.",
  },
  {
    kind: "paragraph",
    text: "All activities and actions executed within NovusMail using your credentials.",
  },
  {
    kind: "heading",
    text: "3. User Control & Explicit Approvals",
  },
  {
    kind: "paragraph",
    text: "Our core product philosophy is to keep you in control of your queue:",
  },
  {
    kind: "paragraph",
    text: "AI Assistant Proposals: Any action drafted or proposed by the AI operator (such as drafting an email response or planning a new calendar event) is strictly a proposal.",
  },
  {
    kind: "paragraph",
    text: 'Explicit Approval: No email will be sent and no calendar event will be created or mutated without your explicit manual confirmation (e.g., clicking "Approve" or pressing the corresponding shortcut).',
  },
  {
    kind: "paragraph",
    text: "You are solely responsible for reviewing the accuracy and content of any AI-drafted material before giving your approval.",
  },
  {
    kind: "heading",
    text: "4. Acceptable Use Policy",
  },
  {
    kind: "paragraph",
    text: "You agree not to use NovusMail to:",
  },
  {
    kind: "paragraph",
    text: "Violate any local, state, national, or international laws.",
  },
  {
    kind: "paragraph",
    text: "Transmit unsolicited email, spam, bulk marketing, or harassing materials.",
  },
  {
    kind: "paragraph",
    text: "Attempt to compromise, disrupt, or bypass the application's security systems, rate limiters, or database.",
  },
  {
    kind: "paragraph",
    text: "Infringe upon the intellectual property rights of others.",
  },
  {
    kind: "heading",
    text: "5. Disclaimers & Limitation of Liability",
  },
  {
    kind: "paragraph",
    text: 'THE SERVICE IS PROVIDED ON AN "AS IS" AND "AS AVAILABLE" BASIS. WE EXPRESSLY DISCLAIM ALL WARRANTIES OF ANY KIND. WE SHALL NOT BE LIABLE FOR ANY INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR EXEMPLARY DAMAGES, INCLUDING BUT NOT LIMITED TO DAMAGES FOR LOSS OF PROFITS, GOODWILL, USE, DATA, OR OTHER INTANGIBLE LOSSES RESULTING FROM THE USE OR THE INABILITY TO USE THE SERVICE.',
  },
  {
    kind: "paragraph",
    text: "We are not responsible for any issues arising from Google API service limits, synchronization delays, or sudden changes to Google Developer terms of service.",
  },
  {
    kind: "heading",
    text: "6. Termination",
  },
  {
    kind: "paragraph",
    text: "We reserve the right to suspend or terminate your access to the workspace at any time, with or without cause or notice, effective immediately, if we believe you have breached these Terms of Service.",
  },
  {
    kind: "heading",
    text: "7. Contact Information",
  },
  {
    kind: "paragraph",
    text: "For any questions, issues, or notices regarding these Terms of Service, please contact:",
  },
  {
    kind: "paragraph",
    text: "Email: vinayrpdev@gmail.com",
  },
];
