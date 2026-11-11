"use client";
import { Suspense } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useData } from "./data-provider";
import { ArtworkOverlay } from "./artwork";
export function Mark({ size = 26 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      aria-hidden="true"
    >
      <path d="M3 5h7l6 17L22 5h7L18.5 29h-5L3 5Z" fill="currentColor" />
      <path
        d="m16 0 2.2 4.8L23 7l-4.8 2.2L16 14l-2.2-4.8L9 7l4.8-2.2L16 0Z"
        fill="var(--paper)"
      />
    </svg>
  );
}
export function Shell({ children }: { children: React.ReactNode }) {
  const path = usePathname(),
    { error } = useData();
  const items = [
    ["/", "Collection", "▦"],
    ["/discover/", "Discover", "◉"],
    ["/artists/", "Artists", "♧"],
  ];
  return (
    <>
      <a className="skip" href="#main">
        Skip to content
      </a>
      <header className="topbar">
        <div className="top-inner">
          <Link href="/" className="wordmark">
            <Mark />
            vorthos<span className="wordmark-dot">.</span>
          </Link>
          <nav aria-label="Main navigation">
            {items.map(([href, label]) => (
              <Link
                key={href}
                href={href}
                className={
                  path === href || path === href.slice(0, -1) ? "selected" : ""
                }
                aria-current={
                  path === href || path === href.slice(0, -1)
                    ? "page"
                    : undefined
                }
              >
                {label}
              </Link>
            ))}
          </nav>
          <span className="header-note">A gallery of Magic art</span>
        </div>
      </header>
      <main id="main">
        {error && (
          <p className="error" role="alert">
            {error}
          </p>
        )}
        {children}
      </main>
      <footer>
        <Link className="footer-logo" href="/">
          <Mark size={22} />
          Vorthos
        </Link>
        <div>
          <p>
            Vorthos is unofficial Fan Content permitted under the{" "}
            <a
              href="https://company.wizards.com/en/legal/fancontentpolicy"
              target="_blank"
              rel="noreferrer"
            >
              Fan Content Policy
            </a>
            . Not approved/endorsed by Wizards. Portions of the materials used
            are property of Wizards of the Coast. ©Wizards of the Coast LLC.
          </p>
          <p>
            Card data and images from{" "}
            <a href="https://scryfall.com" target="_blank" rel="noreferrer">
              Scryfall
            </a>
            . Each artwork is credited to its artist.
          </p>
        </div>
      </footer>
      <nav className="bottom-nav" aria-label="Mobile navigation">
        {items.map(([href, label, icon]) => (
          <Link
            key={href}
            href={href}
            className={
              path === href || path === href.slice(0, -1) ? "selected" : ""
            }
          >
            <span aria-hidden="true">
              <NavIcon href={href} />
            </span>
            {label}
          </Link>
        ))}
      </nav>
      <Suspense fallback={null}>
        <ArtworkOverlay />
      </Suspense>
    </>
  );
}

function NavIcon({ href }: { href: string }) {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {href === "/" ? (
        <>
          <rect x="3" y="3" width="7" height="7" rx="1" />
          <rect x="14" y="3" width="7" height="7" rx="1" />
          <rect x="3" y="14" width="7" height="7" rx="1" />
          <rect x="14" y="14" width="7" height="7" rx="1" />
        </>
      ) : href === "/discover/" ? (
        <>
          <circle cx="12" cy="12" r="9" />
          <path d="m16 8-2.5 5.5L8 16l2.5-5.5L16 8Z" />
        </>
      ) : (
        <>
          <circle cx="12" cy="8" r="3.5" />
          <path d="M5 21v-2a7 7 0 0 1 14 0v2" />
        </>
      )}
    </svg>
  );
}
