import type { PropsWithChildren, ReactNode } from "react";

type CopyButtonProps = {
  value: string;
  label?: string;
};

export function formatStateLabel(state: string) {
  return state
    .toLowerCase()
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export function shortValue(value: string, prefixLength = 6, suffixLength = 4) {
  if (value.length <= prefixLength + suffixLength + 3) {
    return value;
  }

  return `${value.slice(0, prefixLength)}...${value.slice(-suffixLength)}`;
}

export function formatUsdcAmount(value: string | number | bigint | null | undefined) {
  if (value === null || value === undefined || value === "") {
    return "Not available";
  }

  const stringValue = String(value);

  if (stringValue.includes(".")) {
    return `${Number(stringValue).toLocaleString(undefined, {
      maximumFractionDigits: 6
    })} USDC`;
  }

  try {
    const amount = BigInt(stringValue);
    const whole = amount / 1_000_000n;
    const fractional = amount % 1_000_000n;
    const fractionalText = fractional.toString().padStart(6, "0").replace(/0+$/, "");

    return `${whole.toLocaleString()}${fractionalText ? `.${fractionalText}` : ""} USDC`;
  } catch {
    return `${stringValue} USDC`;
  }
}

export function CopyButton({ value, label = "Copy" }: CopyButtonProps) {
  async function handleCopy() {
    await navigator.clipboard?.writeText(value);
  }

  return (
    <button className="icon-button" type="button" onClick={() => void handleCopy()} title={label}>
      <span aria-hidden="true">Copy</span>
    </button>
  );
}

export function AddressText({ value }: { value: string }) {
  return (
    <span className="inline-value">
      <span title={value}>{shortValue(value)}</span>
      <CopyButton value={value} />
    </span>
  );
}

export function ExplorerLink({ href, label = "Open" }: { href: string; label?: string }) {
  return (
    <a className="mini-link" href={href} rel="noreferrer" target="_blank">
      {label}
    </a>
  );
}

export function InfoRow({
  action,
  label,
  value
}: {
  action?: ReactNode;
  label: string;
  value: ReactNode;
}) {
  return (
    <div className="detail-row">
      <span>{label}</span>
      <strong>
        {value}
        {action}
      </strong>
    </div>
  );
}

export function ProgressBar({
  label,
  max,
  value
}: {
  label: string;
  max: number;
  value: number;
}) {
  const safeMax = Math.max(max, 1);
  const safeValue = Math.min(Math.max(value, 0), safeMax);
  const percent = Math.round((safeValue / safeMax) * 100);

  return (
    <div className="progress-block">
      <div className="progress-label">
        <span>{label}</span>
        <strong>{safeValue} / {safeMax}</strong>
      </div>
      <div className="progress-track" aria-label={label} aria-valuemax={safeMax} aria-valuemin={0} aria-valuenow={safeValue} role="progressbar">
        <span style={{ width: `${percent}%` }} />
      </div>
    </div>
  );
}

export function StatusBadge({ status }: { status: string }) {
  return <span className={`status-pill status-${status.toLowerCase()}`}>{formatStateLabel(status)}</span>;
}

export function AdvancedDetails({ children, summary = "Advanced details" }: PropsWithChildren<{ summary?: string }>) {
  return (
    <details className="advanced-details">
      <summary>{summary}</summary>
      <div>{children}</div>
    </details>
  );
}

export function ProgressSteps({ current }: { current: string | null }) {
  const steps = [
    ["CHALLENGE_CREATED", "Preparing transaction"],
    ["WAITING_FOR_USER_APPROVAL", "Waiting for wallet confirmation"],
    ["CHALLENGE_COMPLETE", "Submitting transaction"],
    ["TRANSACTION_SUBMITTED", "Waiting for confirmation"],
    ["TRANSACTION_CONFIRMED", "Done"]
  ];
  const currentIndex = Math.max(0, steps.findIndex(([key]) => key === current));
  const failed = current === "TRANSACTION_FAILED" || current === "TRANSACTION_TIMEOUT";

  return (
    <ol className="progress-steps">
      {steps.map(([key, label], index) => (
        <li
          className={[
            index <= currentIndex && !failed ? "is-complete" : "",
            key === current ? "is-current" : "",
            failed && index === currentIndex ? "is-failed" : ""
          ].filter(Boolean).join(" ")}
          key={key}
        >
          <span>{index + 1}</span>
          <strong>{label}</strong>
        </li>
      ))}
    </ol>
  );
}

export function TxStatusPanel({
  actions,
  children,
  status,
  title
}: PropsWithChildren<{
  actions?: ReactNode;
  status: string | null;
  title: string;
}>) {
  return (
    <section className="tx-panel" role="status">
      <div className="card-heading">
        <h2>{title}</h2>
        {status ? <StatusBadge status={status} /> : null}
      </div>
      {status ? <ProgressSteps current={status} /> : null}
      <div className="tx-panel-body">{children}</div>
      {actions ? <div className="button-row">{actions}</div> : null}
    </section>
  );
}

export function Modal({
  actions,
  children,
  status,
  title
}: PropsWithChildren<{
  actions?: ReactNode;
  status?: string;
  title: string;
}>) {
  return (
    <div className="modal-card" role="status">
      <div className="card-heading">
        <h2>{title}</h2>
        {status ? <StatusBadge status={status} /> : null}
      </div>
      <div className="modal-body">{children}</div>
      {actions ? <div className="button-row">{actions}</div> : null}
    </div>
  );
}
