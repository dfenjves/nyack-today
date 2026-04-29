import Link from 'next/link'

const discoverLinks = [
  { label: "Today's events", href: '/' },
  { label: 'Always-on', href: '/activities' },
  { label: 'Submit event', href: '/submit' },
]

const aboutLinks = [
  { label: 'Newsletter', href: '/#subscribe-section' },
  { label: 'Contact', href: 'mailto:hello@nyacktoday.com' },
]

export default function Footer() {
  return (
    <footer style={{ background: '#1E3A2F', color: '#8FBD9E' }}>
      <div
        className="max-w-[1100px] mx-auto"
        style={{ padding: 'clamp(32px, 5vw, 48px) clamp(20px, 4vw, 48px) 32px' }}
      >
        <div className="flex flex-col md:flex-row gap-10 md:gap-12 justify-between items-start">
          <div style={{ maxWidth: 320 }}>
            <div style={{
              fontFamily: 'var(--font-display)',
              fontSize: 22, fontWeight: 600, color: '#F5F0E8', letterSpacing: '-0.01em',
              marginBottom: 14,
            }}>
              Nyack Today
            </div>
            <p style={{ fontSize: 12, color: '#8FBD9E', lineHeight: 1.6 }}>
              A community events guide for Nyack and the surrounding Hudson Valley.
              Independently maintained — submit anything we&rsquo;re missing.
            </p>
          </div>

          <div className="flex gap-10 md:gap-14 flex-wrap">
            <FooterCol title="Discover" links={discoverLinks} />
            <FooterCol title="About" links={aboutLinks} />
          </div>
        </div>

        <div
          style={{
            marginTop: 40,
            paddingTop: 20,
            borderTop: '0.5px solid rgba(245,240,232,0.12)',
            display: 'flex',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: 12,
            fontSize: 11,
            color: '#5C8266',
            letterSpacing: '0.04em',
          }}
        >
          <span>© {new Date().getFullYear()} Nyack Today</span>
          <span>Made on the Hudson</span>
        </div>
      </div>
    </footer>
  )
}

function FooterCol({ title, links }: { title: string; links: { label: string; href: string }[] }) {
  return (
    <div>
      <div style={{
        fontSize: 10, letterSpacing: '0.16em', textTransform: 'uppercase',
        color: '#5C8266', marginBottom: 12, fontWeight: 500,
      }}>
        {title}
      </div>
      <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 8 }}>
        {links.map((l) => (
          <li key={l.label}>
            <Link href={l.href} style={{ fontSize: 13, color: '#C5DFC9', textDecoration: 'none' }}>
              {l.label}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  )
}
