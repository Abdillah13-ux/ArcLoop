type LoadingStateProps = {
  message?: string;
};

export function LoadingState({ message = "Loading..." }: LoadingStateProps) {
  return (
    <div className="state-box">
      <span className="loader" aria-hidden="true" />
      <p>{message}</p>
    </div>
  );
}
