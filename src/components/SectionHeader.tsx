type Props = {
  title: string;
  className?: string;
};

export default function SectionHeader({ title, className = '' }: Props) {
  return (
    <div className={`game-section-header ${className}`}>
      <h2 className="game-section-header__title">{title}</h2>
    </div>
  );
}
