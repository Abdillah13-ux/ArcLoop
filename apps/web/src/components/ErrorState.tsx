type ErrorStateProps = {
  title?: string;
  message: string;
};

export function ErrorState({ title = "Request needs attention", message }: ErrorStateProps) {
  return (
    <div className="state-box error-state" role="alert">
      <h2>{title}</h2>
      <p>{message}</p>
    </div>
  );
}
