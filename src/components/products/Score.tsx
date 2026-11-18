export function Score({ value }: { value: number | null }) {
  return value === null ? (
    <span className="score score-none" title="Sem evidência verificada suficiente">sem score</span>
  ) : (
    <span className="score" title="Score baseado em evidências verificadas">{Math.round(value)}</span>
  );
}
