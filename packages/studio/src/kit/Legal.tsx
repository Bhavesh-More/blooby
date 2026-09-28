import type { ReactNode } from 'react';
import { BloobyMark } from './index';

/**
 * The privacy policy and terms of use, written once and routed by both apps at /privacy
 * and /terms.
 *
 * Every claim here is something the code does — if you change what is collected, where it
 * is stored or who it goes to, change the sentence here in the same commit. The facts:
 * Supabase (auth + Postgres), project JSON in AWS S3, cookieless page views
 * (services/pageViews.service.ts), MCP audit rows, the copilot through Ollama, fonts from
 * Google Fonts and Fontsource/jsDelivr, preferences in localStorage.
 */
export type LegalDoc = 'privacy' | 'terms';

const UPDATED = '29 September 2026';
const CONTACT = 'intellobyte@gmail.com';

export function LegalPage({ doc }: { doc: LegalDoc }) {
  return (
    <main className="legal">
      <div className="legal-inner">
        <header className="legal-top">
          <a className="brand" href="/" style={{ textDecoration: 'none' }}>
            <BloobyMark size={28} /><span className="brand-word">blooby</span>
          </a>
          <nav aria-label="Legal">
            <a href="/privacy" aria-current={doc === 'privacy' ? 'page' : undefined}>Privacy</a>
            <a href="/terms" aria-current={doc === 'terms' ? 'page' : undefined}>Terms</a>
          </nav>
        </header>
        <article className="legal-doc">{doc === 'privacy' ? <Privacy /> : <Terms />}</article>
        <p className="legal-foot">Questions? Write to <a href={`mailto:${CONTACT}`}>{CONTACT}</a>.</p>
      </div>
    </main>
  );
}

const Lede = ({ children }: { children: ReactNode }) => <p className="legal-lede">{children}</p>;

function Privacy() {
  return (
    <>
      <h1>Privacy policy</h1>
      <p className="legal-updated">Last updated {UPDATED}</p>
      <Lede>
        blooby is a tool for animating mascots. We keep what we need to run your account and store your
        projects, we don’t sell anything about you, and we don’t use advertising or tracking cookies.
      </Lede>

      <h2>What we collect</h2>
      <ul>
        <li><strong>Your account.</strong> Your email address, and — if you sign in with Google — the name and
          profile picture Google shares. Passwords are handled by our authentication provider and never seen by us in plain text.</li>
        <li><strong>Your projects.</strong> The animations you make: layers, keyframes, presets, state machines,
          and any SVG artwork or text you add. Their names, visibility and when they were changed.</li>
        <li><strong>What you publish.</strong> Presets, expressions and projects you choose to make public, with
          your display name, and simple counts such as views and copies.</li>
        <li><strong>Page views, without cookies.</strong> Which page was opened, the page you came from, the
          referring site’s domain and the kind of device. Visitors are counted with a one-way hash of the
          network address and browser that is re-salted every day, so we can tell two visitors apart on one
          day but cannot recognise anyone on the next. The address itself is never stored.</li>
        <li><strong>Connected AI apps.</strong> When you connect an AI app (Claude, ChatGPT, Cursor or another
          MCP client), the app’s name, the permissions you approved, hashed access tokens, and a log of the
          actions it took on your projects — so you can see and revoke what it did.</li>
        <li><strong>Copilot requests.</strong> What you type to the copilot and a description of the open project,
          sent to the language model that answers it, plus token counts for rate limits.</li>
      </ul>

      <h2>Stored on your device</h2>
      <p>The browser remembers small preferences in local storage: which panels you folded, tours you have seen,
        the “What’s new” release you last read while signed out, and sidebar state. Your sign-in session is kept
        by our authentication provider. None of this is used to follow you around the web.</p>

      <h2>Who else handles it</h2>
      <ul>
        <li><strong>Supabase</strong> — sign-in and our database.</li>
        <li><strong>Amazon Web Services (S3)</strong> — the files that hold your projects.</li>
        <li><strong>Ollama</strong> — the language models behind the copilot, when you use it.</li>
        <li><strong>Google Fonts, Fontsource and jsDelivr</strong> — the typefaces the app and your text layers
          load; your browser requests them directly, which shares your network address with those services.</li>
        <li><strong>Google</strong> — only if you choose “Continue with Google”.</li>
        <li><strong>AI apps you connect</strong> — they receive the project data needed for what you ask them to
          do, under their own privacy policies.</li>
      </ul>
      <p>We don’t sell personal information or share it for advertising.</p>

      <h2>Public work</h2>
      <p>A project you make public, and anything you publish to the library, can be viewed and copied by other
        people, and shows your display name. Link previews (the image shown when a link is shared) are made only
        for public projects.</p>

      <h2>Keeping and deleting</h2>
      <p>Your projects stay until you delete them or your account. Deleted projects are removed from storage.
        Page-view counts are kept in aggregate. To delete your account and everything in it, or to get a copy of
        your data, write to us at the address below and we’ll act within 30 days.</p>

      <h2>Your rights</h2>
      <p>Depending on where you live you may have the right to access, correct, export or delete your personal
        information, and to object to how it is used. Ask us and we’ll help; you can also complain to your local
        data-protection authority.</p>

      <h2>Children</h2>
      <p>blooby isn’t directed at children under 13, and we don’t knowingly collect their information.</p>

      <h2>Changes</h2>
      <p>If this policy changes in a way that matters, we’ll say so in the app’s “What’s new” before it applies.</p>
    </>
  );
}

function Terms() {
  return (
    <>
      <h1>Terms of use</h1>
      <p className="legal-updated">Last updated {UPDATED}</p>
      <Lede>
        Make great animations, keep what you make, and be decent to other people. The longer version is below —
        by using blooby you agree to it.
      </Lede>

      <h2>Your account</h2>
      <p>Keep your sign-in details to yourself; you’re responsible for what happens under your account. Tell us
        straight away if you think someone else has access to it.</p>

      <h2>What you make is yours</h2>
      <p>You own the projects, artwork and animations you create. You give us permission to store, process and
        display them only as needed to run blooby for you — and, for anything you make public or publish to the
        library, to show it to other people and let them view and copy it inside blooby.</p>
      <p>Exports (Lottie, .lottie, GIF, video, PNG and the React Native pack) are yours to use anywhere, including
        commercially. The built-in presets and mascots may be used in what you make and export.</p>

      <h2>What you mustn’t do</h2>
      <ul>
        <li>Upload or publish anything you don’t have the right to use, or that is unlawful, hateful, harassing,
          sexually explicit, or that infringes someone else’s rights.</li>
        <li>Try to break, overload or get around the limits of the service, or access other people’s projects
          without permission.</li>
        <li>Use connected AI apps or automation to do any of the above.</li>
      </ul>
      <p>We may remove content or suspend accounts that break these rules.</p>

      <h2>AI features</h2>
      <p>The copilot and connected AI apps suggest and make changes for you. Check what they do — you can undo any
        edit. You’re responsible for the prompts you send and for the permissions you grant an AI app, and you
        can revoke them at any time from the AI apps page.</p>

      <h2>The service</h2>
      <p>blooby is provided as is. We work to keep it running and your work safe, but we can’t promise it will
        always be available or free of bugs — keep your own copies of anything important (Download project file,
        in the editor’s ⋯ menu). We may change or discontinue features, and will give notice where we reasonably can.</p>

      <h2>Liability</h2>
      <p>To the extent the law allows, we aren’t liable for indirect or consequential losses, or for lost data or
        profits, arising from your use of blooby.</p>

      <h2>Open source</h2>
      <p>blooby’s source code is published on GitHub under the MIT licence; these terms cover the hosted service.</p>

      <h2>Ending</h2>
      <p>You can stop using blooby and ask us to delete your account at any time. We may end access for a serious or
        repeated breach of these terms.</p>

      <h2>Changes</h2>
      <p>We may update these terms; we’ll announce meaningful changes in “What’s new” before they apply. Continuing
        to use blooby after that means you accept them.</p>
    </>
  );
}
