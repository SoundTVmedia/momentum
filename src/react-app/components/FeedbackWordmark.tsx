export default function FeedbackWordmark({ className = '' }: { className?: string }) {
  return (
    <span className={`feedback-wordmark ${className}`.trim()} aria-hidden>
      <span className="feedback-wordmark__feed">FEED</span>
      <span className="feedback-wordmark__back">BACK</span>
    </span>
  );
}
