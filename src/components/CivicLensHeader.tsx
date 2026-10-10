type ActiveTab = "report" | "track" | "authority" | "rewards";

type Props = { active: ActiveTab };

const navigation: { key: ActiveTab; href: string; label: string }[] = [
  { key: "report", href: "/", label: "Report an issue" },
  { key: "track", href: "/track", label: "Track reports" },
  { key: "authority", href: "/dashboard", label: "Authority dashboard" },
  { key: "rewards", href: "/rewards", label: "Rewards" },
];

export default function CivicLensHeader({ active }: Props) {
  return (
    <header className="cl-global-header">
      <a href="/" className="cl-global-brand" aria-label="CivicLens home">
        <img
          src="/brand/civiclens-logo.png"
          alt="CivicLens logo"
          className="cl-global-logo"
          width={104}
          height={72}
        />
        <span className="cl-global-divider" aria-hidden="true" />
        <span className="cl-global-brand-copy">
          <strong>CIVIC INTELLIGENCE</strong>
          <small>SEE THE ISSUE. SPARK ACTION.</small>
        </span>
      </a>
      <nav className="cl-global-nav" aria-label="Main navigation">
        {navigation.map((item) => (
          <a
            key={item.key}
            href={item.href}
            className={active === item.key ? "active" : undefined}
            aria-current={active === item.key ? "page" : undefined}
          >
            {item.label}
          </a>
        ))}
      </nav>
    </header>
  );
}
