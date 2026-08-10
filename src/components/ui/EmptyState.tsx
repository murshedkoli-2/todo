interface EmptyStateProps {
  icon: React.ReactNode;
  title: string;
  description: string;
  action?: React.ReactNode;
}

export default function EmptyState({ icon, title, description, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-20 sm:py-28 text-center animate-fade-in">
      <div
        className="w-20 h-20 rounded-card flex items-center justify-center mb-6"
        style={{
          background: "var(--bg-card)",
          border: "1px solid var(--border)",
          boxShadow: "var(--shadow-card)",
          color: "var(--text-muted)",
        }}
      >
        {icon}
      </div>
      <h3 className="font-bold text-lg mb-2" style={{ color: "var(--text-primary)" }}>
        {title}
      </h3>
      <p className="text-sm max-w-xs mb-6 leading-relaxed" style={{ color: "var(--text-secondary)" }}>
        {description}
      </p>
      {action}
    </div>
  );
}
