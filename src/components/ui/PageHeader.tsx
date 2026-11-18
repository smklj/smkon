type PageHeaderProps = {
  eyebrow: string;
  title: string;
  description?: string;
  actions?: React.ReactNode;
};

export function PageHeader({ eyebrow, title, description, actions }: PageHeaderProps) {
  return (
    <header className="page-header">
      <div>
        <p className="eyebrow">{eyebrow}</p>
        <h1>{title}</h1>
        {description ? <p className="page-description">{description}</p> : null}
      </div>
      {actions ? <div className="page-actions">{actions}</div> : null}
    </header>
  );
}

type BadgeTone = "neutral" | "ok" | "warn" | "danger" | "info";

export function Badge({ tone = "neutral", children }: { tone?: BadgeTone; children: React.ReactNode }) {
  return <span className={`badge badge-${tone}`}>{children}</span>;
}

export function SectionHeading({ title, aside, id }: { title: string; aside?: React.ReactNode; id?: string }) {
  return (
    <div className="section-heading">
      <h2 id={id}>{title}</h2>
      {aside ? <div className="section-aside">{aside}</div> : null}
    </div>
  );
}
