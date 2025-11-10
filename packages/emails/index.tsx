// Email templates will be added here
// For v1, these are simple placeholders

export function WelcomeEmail({ name }: { name: string }) {
  return (
    <div>
      <h1>Welcome, {name}!</h1>
      <p>Thank you for joining our wine club.</p>
    </div>
  );
}

export function SubscriptionConfirmationEmail({
  name,
  planName,
}: {
  name: string;
  planName: string;
}) {
  return (
    <div>
      <h1>Subscription Confirmed</h1>
      <p>Hi {name},</p>
      <p>Your subscription to {planName} has been confirmed.</p>
    </div>
  );
}

export function PaymentFailedEmail({ name }: { name: string }) {
  return (
    <div>
      <h1>Payment Failed</h1>
      <p>Hi {name},</p>
      <p>We were unable to process your payment. Please update your payment method.</p>
    </div>
  );
}

