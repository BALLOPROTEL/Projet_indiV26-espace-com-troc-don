type Props = {
  eyebrow: string;
  title: string;
  text: string;
};

export function EmptyState({
  eyebrow,
  title,
  text,
}: Props) {
  return (
    <div className="empty-state">
      <span className="eyebrow">{eyebrow}</span>
      <h3>{title}</h3>
      <p>{text}</p>
    </div>
  );
}
