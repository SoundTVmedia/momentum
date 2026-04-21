import { Context } from "hono";
import Stripe from "stripe";

/**
 * Initialize Stripe client
 */
function getStripeClient(env: Env): Stripe {
  return new Stripe(env.STRIPE_SECRET_KEY, {
    apiVersion: "2025-10-29.clover",
  });
}

/**
 * Handle Stripe webhooks
 */
export async function handleStripeWebhook(c: Context) {
  const signature = c.req.header("stripe-signature");
  
  if (!signature) {
    return c.json({ error: "Missing stripe-signature header" }, 400);
  }

  try {
    const stripe = getStripeClient(c.env);
    const body = await c.req.text();
    
    // Verify webhook signature
    const event = stripe.webhooks.constructEvent(
      body,
      signature,
      c.env.STRIPE_WEBHOOK_SECRET
    );

    console.log(`Received webhook event: ${event.type}`);

    // Handle different event types
    switch (event.type) {
      case "checkout.session.completed":
        await handleCheckoutSessionCompleted(c.env.DB, event.data.object as Stripe.Checkout.Session);
        break;

      case "customer.subscription.created":
      case "customer.subscription.updated":
        await handleSubscriptionUpdate(c.env.DB, event.data.object as Stripe.Subscription);
        break;

      case "customer.subscription.deleted":
        await handleSubscriptionDeleted(c.env.DB, event.data.object as Stripe.Subscription);
        break;

      case "payment_intent.succeeded":
        await handlePaymentIntentSucceeded(c.env.DB, event.data.object as Stripe.PaymentIntent);
        break;

      case "payment_intent.payment_failed":
        await handlePaymentIntentFailed(c.env.DB, event.data.object as Stripe.PaymentIntent);
        break;

      case "charge.succeeded":
        await handleChargeSucceeded(c.env.DB, event.data.object as Stripe.Charge);
        break;

      case "transfer.created":
        await handleTransferCreated(c.env.DB, event.data.object as Stripe.Transfer);
        break;

      default:
        console.log(`Unhandled event type: ${event.type}`);
    }

    return c.json({ received: true });
  } catch (error) {
    console.error("Webhook error:", error);
    return c.json({ error: "Webhook processing failed" }, 400);
  }
}

/**
 * Handle successful checkout session
 */
async function handleCheckoutSessionCompleted(
  db: Env['DB'],
  session: Stripe.Checkout.Session
) {
  console.log(`Checkout session completed: ${session.id}`);

  const mochaUserId = session.metadata?.mocha_user_id;
  if (!mochaUserId) {
    console.error("No mocha_user_id in checkout session metadata");
    return;
  }

  // Handle subscription checkout
  if (session.mode === "subscription" && session.subscription) {
    console.log(`Creating subscription record for user ${mochaUserId}`);
    
    // Subscription will be created/updated by subscription.created event
    // Just update user profile to premium
    await db.prepare(
      `UPDATE user_profiles 
       SET is_premium = 1, updated_at = CURRENT_TIMESTAMP 
       WHERE mocha_user_id = ?`
    )
      .bind(mochaUserId)
      .run();

    // Create notification
    await db.prepare(
      `INSERT INTO notifications (mocha_user_id, type, content, created_at)
       VALUES (?, 'payment', 'Welcome to MOMENTUM Premium! 👑 Your subscription is now active.', CURRENT_TIMESTAMP)`
    )
      .bind(mochaUserId)
      .run();
  }

  // Handle one-time payment (ticket affiliate)
  if (session.mode === "payment" && session.payment_intent) {
    console.log(`Processing affiliate ticket purchase for user ${mochaUserId}`);
    // Payment intent succeeded event will handle the transaction record
  }
}

/**
 * Handle subscription creation/update
 */
async function handleSubscriptionUpdate(
  db: Env['DB'],
  subscription: Stripe.Subscription
) {
  console.log(`Subscription update: ${subscription.id}`);

  const mochaUserId = subscription.metadata?.mocha_user_id;
  if (!mochaUserId) {
    console.error("No mocha_user_id in subscription metadata");
    return;
  }

  const customerId = typeof subscription.customer === 'string' 
    ? subscription.customer 
    : subscription.customer.id;

  // Upsert subscription record
  const currentPeriodStart = (subscription as any).current_period_start 
    ? new Date(((subscription as any).current_period_start as number) * 1000).toISOString()
    : new Date().toISOString();
  const currentPeriodEnd = (subscription as any).current_period_end
    ? new Date(((subscription as any).current_period_end as number) * 1000).toISOString()
    : new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(); // Default to 1 year from now

  await db.prepare(
    `INSERT INTO subscriptions (
      mocha_user_id, 
      stripe_customer_id, 
      stripe_subscription_id, 
      status, 
      plan_type,
      current_period_start, 
      current_period_end,
      cancel_at_period_end,
      created_at, 
      updated_at
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    ON CONFLICT(stripe_subscription_id) DO UPDATE SET
      status = excluded.status,
      current_period_start = excluded.current_period_start,
      current_period_end = excluded.current_period_end,
      cancel_at_period_end = excluded.cancel_at_period_end,
      updated_at = CURRENT_TIMESTAMP`
  )
    .bind(
      mochaUserId,
      customerId,
      subscription.id,
      subscription.status,
      'premium',
      currentPeriodStart,
      currentPeriodEnd,
      subscription.cancel_at_period_end ? 1 : 0
    )
    .run();

  // Update user profile premium status
  const isPremium = ['active', 'trialing'].includes(subscription.status) ? 1 : 0;
  await db.prepare(
    `UPDATE user_profiles 
     SET is_premium = ?, updated_at = CURRENT_TIMESTAMP 
     WHERE mocha_user_id = ?`
  )
    .bind(isPremium, mochaUserId)
    .run();
}

/**
 * Handle subscription deletion/cancellation
 */
async function handleSubscriptionDeleted(
  db: Env['DB'],
  subscription: Stripe.Subscription
) {
  console.log(`Subscription deleted: ${subscription.id}`);

  // Update subscription status
  await db.prepare(
    `UPDATE subscriptions 
     SET status = 'canceled', updated_at = CURRENT_TIMESTAMP 
     WHERE stripe_subscription_id = ?`
  )
    .bind(subscription.id)
    .run();

  // Get user ID
  const subRecord = await db.prepare(
    "SELECT mocha_user_id FROM subscriptions WHERE stripe_subscription_id = ?"
  )
    .bind(subscription.id)
    .first();

  if (subRecord) {
    // Update user profile
    await db.prepare(
      `UPDATE user_profiles 
       SET is_premium = 0, updated_at = CURRENT_TIMESTAMP 
       WHERE mocha_user_id = ?`
    )
      .bind(subRecord.mocha_user_id)
      .run();

    // Create notification
    await db.prepare(
      `INSERT INTO notifications (mocha_user_id, type, content, created_at)
       VALUES (?, 'payment', 'Your MOMENTUM Premium subscription has ended.', CURRENT_TIMESTAMP)`
    )
      .bind(subRecord.mocha_user_id)
      .run();
  }
}

/**
 * Handle successful payment intent
 */
async function handlePaymentIntentSucceeded(
  db: Env['DB'],
  paymentIntent: Stripe.PaymentIntent
) {
  console.log(`Payment intent succeeded: ${paymentIntent.id}`);

  const mochaUserId = paymentIntent.metadata?.mocha_user_id;
  if (!mochaUserId) {
    console.error("No mocha_user_id in payment intent metadata");
    return;
  }

  // Create transaction record
  const transactionType = paymentIntent.metadata?.type || 'ticket_purchase';
  
  await db.prepare(
    `INSERT INTO transactions (
      mocha_user_id,
      type,
      amount,
      currency,
      stripe_payment_intent_id,
      status,
      description,
      metadata,
      created_at,
      updated_at
    )
    VALUES (?, ?, ?, ?, ?, 'succeeded', ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`
  )
    .bind(
      mochaUserId,
      transactionType,
      paymentIntent.amount,
      paymentIntent.currency,
      paymentIntent.id,
      paymentIntent.description || null,
      JSON.stringify(paymentIntent.metadata)
    )
    .run();

  // Get transaction ID
  const transaction = await db.prepare(
    "SELECT id FROM transactions WHERE stripe_payment_intent_id = ?"
  )
    .bind(paymentIntent.id)
    .first();

  // Handle affiliate commission for ticket sales
  if (transactionType === 'ticket_affiliate' && transaction) {
    const referrerUserId = paymentIntent.metadata?.referrer_user_id;
    const commissionRateStr = paymentIntent.metadata?.commission_rate;
    
    if (referrerUserId && commissionRateStr) {
      const commissionRate = parseFloat(commissionRateStr);
      const commissionAmount = Math.round(paymentIntent.amount * commissionRate);

      // Create affiliate sale record
      await db.prepare(
        `INSERT INTO affiliate_sales (
          referrer_user_id,
          transaction_id,
          commission_amount,
          commission_rate,
          event_name,
          event_date,
          ticket_quantity,
          created_at,
          updated_at
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`
      )
        .bind(
          referrerUserId,
          transaction.id,
          commissionAmount,
          commissionRate,
          paymentIntent.metadata?.event_name || null,
          paymentIntent.metadata?.event_date || null,
          paymentIntent.metadata?.ticket_quantity ? parseInt(paymentIntent.metadata.ticket_quantity) : null
        )
        .run();

      // Add to referrer's earnings balance
      await db.prepare(
        `UPDATE user_profiles 
         SET earnings_balance = earnings_balance + ?, updated_at = CURRENT_TIMESTAMP 
         WHERE mocha_user_id = ?`
      )
        .bind(commissionAmount, referrerUserId)
        .run();

      // Create notification for referrer
      await db.prepare(
        `INSERT INTO notifications (mocha_user_id, type, content, created_at)
         VALUES (?, 'payment', 'You earned $' || ? || ' in commission! 💰', CURRENT_TIMESTAMP)`
      )
        .bind(
          referrerUserId,
          (commissionAmount / 100).toFixed(2)
        )
        .run();
    }
  }

  // Create notification for buyer
  await db.prepare(
    `INSERT INTO notifications (mocha_user_id, type, content, created_at)
     VALUES (?, 'payment', 'Payment successful! Your order is confirmed. ✅', CURRENT_TIMESTAMP)`
  )
    .bind(mochaUserId)
    .run();
}

/**
 * Handle failed payment intent
 */
async function handlePaymentIntentFailed(
  db: Env['DB'],
  paymentIntent: Stripe.PaymentIntent
) {
  console.log(`Payment intent failed: ${paymentIntent.id}`);

  const mochaUserId = paymentIntent.metadata?.mocha_user_id;
  if (!mochaUserId) {
    return;
  }

  // Create transaction record
  await db.prepare(
    `INSERT INTO transactions (
      mocha_user_id,
      type,
      amount,
      currency,
      stripe_payment_intent_id,
      status,
      description,
      metadata,
      created_at,
      updated_at
    )
    VALUES (?, ?, ?, ?, ?, 'failed', ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`
  )
    .bind(
      mochaUserId,
      paymentIntent.metadata?.type || 'ticket_purchase',
      paymentIntent.amount,
      paymentIntent.currency,
      paymentIntent.id,
      paymentIntent.description || null,
      JSON.stringify(paymentIntent.metadata)
    )
    .run();

  // Create notification
  await db.prepare(
    `INSERT INTO notifications (mocha_user_id, type, content, created_at)
     VALUES (?, 'payment', 'Payment failed. Please check your payment method and try again.', CURRENT_TIMESTAMP)`
  )
    .bind(mochaUserId)
    .run();
}

/**
 * Handle successful charge (for additional tracking)
 */
async function handleChargeSucceeded(
  db: Env['DB'],
  charge: Stripe.Charge
) {
  console.log(`Charge succeeded: ${charge.id}`);

  // Update transaction with charge ID if exists
  if (charge.payment_intent) {
    const paymentIntentId = typeof charge.payment_intent === 'string'
      ? charge.payment_intent
      : charge.payment_intent.id;

    await db.prepare(
      `UPDATE transactions 
       SET stripe_charge_id = ?, updated_at = CURRENT_TIMESTAMP 
       WHERE stripe_payment_intent_id = ?`
    )
      .bind(charge.id, paymentIntentId)
      .run();
  }
}

/**
 * Handle transfer creation (payouts to connected accounts)
 */
async function handleTransferCreated(
  db: Env['DB'],
  transfer: Stripe.Transfer
) {
  console.log(`Transfer created: ${transfer.id}`);

  const payoutRequestId = transfer.metadata?.payout_request_id;
  
  if (payoutRequestId) {
    await db.prepare(
      `UPDATE payout_requests 
       SET stripe_transfer_id = ?, updated_at = CURRENT_TIMESTAMP 
       WHERE id = ?`
    )
      .bind(transfer.id, payoutRequestId)
      .run();
  }
}
