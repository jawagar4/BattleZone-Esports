import { APP_NAME } from '../components/Navbar';

// Starter text only. Have it reviewed by a lawyer and adapt it to your business before launch.
export default function Legal({ kind }) {
  const terms = kind === 'terms';
  return (
    <div className="container bz-page" style={{ maxWidth: 820 }}>
      <h1 className="mb-1">{terms ? 'Terms and conditions' : 'Privacy policy'}</h1>
      <p className="text-muted">Starter template for {APP_NAME}. Review with legal counsel before going live.</p>
      {terms ? (
        <div className="bz-card d-grid gap-3">
          <section><h5>Eligibility</h5><p className="text-muted mb-0">Players must meet the age requirement of the game and tournament they enter. Teams are responsible for the accuracy of their roster and player IDs.</p></section>
          <section><h5>Entry fees and refunds</h5><p className="text-muted mb-0">A slot is confirmed only after the entry fee is verified. Refunds follow the refund policy shown on each tournament page.</p></section>
          <section><h5>Fair play</h5><p className="text-muted mb-0">Cheating, emulators where banned, impersonation and abuse can lead to disqualification and account suspension.</p></section>
          <section><h5>Organiser role</h5><p className="text-muted mb-0">Matches are hosted inside third-party games by organisers. The platform manages registration, payments, schedules and notifications only.</p></section>
        </div>
      ) : (
        <div className="bz-card d-grid gap-3">
          <section><h5>What we collect</h5><p className="text-muted mb-0">Your name, email, phone number, team and player details, and payment status. Card and UPI details are handled by Razorpay and never stored by us.</p></section>
          <section><h5>How we use it</h5><p className="text-muted mb-0">To run registrations, verify payments, send schedules and reminders, and keep tournaments fair.</p></section>
          <section><h5>Your choices</h5><p className="text-muted mb-0">You can update your profile at any time. Contact support to request deletion of your account.</p></section>
        </div>
      )}
    </div>
  );
}
