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
 * Get or create Stripe customer for user
 */
async function getOrCreateStripeCustomer(
  stripe: Stripe,
  db: Env['DB'],
  mochaUserId: string,
  email: string,
  name?: string | null
): Promise<string> {
  // Check if user already has a Stripe customer ID
  const profile = await db.prepare(
    "SELECT stripe_customer_id FROM user_profiles WHERE mocha_user_id = ?"
  )
    .bind(mochaUserId)
    .first();

  if (profile && profile.stripe_customer_id) {
    return profile.stripe_customer_id as string;
  }

  // Create new Stripe customer
  const customer = await stripe.customers.create({
    email,
    name: name || undefined,
    metadata: {
      mocha_user_id: mochaUserId,
    },
  });

  // Store customer ID in database
  await db.prepare(
    "UPDATE user_profiles SET stripe_customer_id = ?, updated_at = CURRENT_TIMESTAMP WHERE mocha_user_id = ?"
  )
    .bind(customer.id, mochaUserId)
    .run();

  return customer.id;
}

/**
 * Create premium subscription checkout session
 */
export async function createPremiumCheckoutSession(c: Context) {
  const mochaUser = c.get("user");
  
  if (!mochaUser) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  try {
    const stripe = getStripeClient(c.env);
    
    // Get or create Stripe customer
    const customerId = await getOrCreateStripeCustomer(
      stripe,
      c.env.DB,
      mochaUser.id,
      mochaUser.google_user_data.email,
      mochaUser.google_user_data.name
    );

    // Create checkout session
    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      mode: "subscription",
      payment_method_types: ["card"],
      line_items: [
        {
          price_data: {
            currency: "usd",
            product_data: {
              name: "MOMENTUM Premium",
              description: "Annual premium membership with exclusive perks",
            },
            unit_amount: 12000, // $120.00
            recurring: {
              interval: "year",
            },
          },
          quantity: 1,
        },
      ],
      success_url: `${c.req.header("origin") || ''}/dashboard?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${c.req.header("origin") || ''}/dashboard`,
      metadata: {
        mocha_user_id: mochaUser.id,
        plan_type: "premium",
      },
    });

    return c.json({ 
      sessionId: session.id,
      url: session.url 
    });
  } catch (error) {
    console.error("Error creating checkout session:", error);
    return c.json({ error: "Failed to create checkout session" }, 500);
  }
}

/**
 * Create ticket affiliate checkout session
 */
export async function createAffiliateCheckoutSession(c: Context) {
  const mochaUser = c.get("user");
  
  if (!mochaUser) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  try {
    const body = await c.req.json();
    const { 
      event_name, 
      event_date, 
      ticket_price, 
      quantity, 
      referrer_user_id 
    } = body;

    if (!event_name || !ticket_price || !quantity) {
      return c.json({ error: "Missing required fields" }, 400);
    }

    const stripe = getStripeClient(c.env);
    
    // Get or create Stripe customer
    const customerId = await getOrCreateStripeCustomer(
      stripe,
      c.env.DB,
      mochaUser.id,
      mochaUser.google_user_data.email,
      mochaUser.google_user_data.name
    );

    // Get referrer commission rate (default 5%)
    let commissionRate = 0.05;
    if (referrer_user_id) {
      const referrerProfile = await c.env.DB.prepare(
        "SELECT commission_rate FROM user_profiles WHERE mocha_user_id = ?"
      )
        .bind(referrer_user_id)
        .first();
      
      if (referrerProfile && referrerProfile.commission_rate) {
        commissionRate = referrerProfile.commission_rate as number;
      }
    }

    // Calculate Momentum platform fee (5%)
    const platformFeeAmount = Math.round(ticket_price * quantity * 0.05);

    // Create checkout session
    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      mode: "payment",
      payment_method_types: ["card"],
      line_items: [
        {
          price_data: {
            currency: "usd",
            product_data: {
              name: `${event_name} - Tickets`,
              description: event_date ? `Event Date: ${event_date}` : undefined,
            },
            unit_amount: ticket_price,
          },
          quantity: quantity,
        },
      ],
      payment_intent_data: {
        application_fee_amount: platformFeeAmount,
        metadata: {
          mocha_user_id: mochaUser.id,
          event_name,
          event_date: event_date || '',
          ticket_quantity: quantity.toString(),
          referrer_user_id: referrer_user_id || '',
          commission_rate: commissionRate.toString(),
        },
      },
      success_url: `${c.req.header("origin") || ''}/dashboard?purchase_success=true`,
      cancel_url: `${c.req.header("origin") || ''}/discover`,
      metadata: {
        mocha_user_id: mochaUser.id,
        type: "ticket_affiliate",
        event_name,
        referrer_user_id: referrer_user_id || '',
      },
    });

    return c.json({ 
      sessionId: session.id,
      url: session.url 
    });
  } catch (error) {
    console.error("Error creating affiliate checkout session:", error);
    return c.json({ error: "Failed to create checkout session" }, 500);
  }
}

/**
 * Get subscription status
 */
export async function getSubscriptionStatus(c: Context) {
  const mochaUser = c.get("user");
  
  if (!mochaUser) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  try {
    const subscription = await c.env.DB.prepare(
      `SELECT * FROM subscriptions 
       WHERE mocha_user_id = ? 
       AND status IN ('active', 'trialing')
       ORDER BY created_at DESC 
       LIMIT 1`
    )
      .bind(mochaUser.id)
      .first();

    return c.json({ 
      subscription: subscription || null,
      isPremium: !!subscription
    });
  } catch (error) {
    console.error("Error fetching subscription status:", error);
    return c.json({ error: "Failed to fetch subscription status" }, 500);
  }
}

/**
 * Cancel subscription
 */
export async function cancelSubscription(c: Context) {
  const mochaUser = c.get("user");
  
  if (!mochaUser) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  try {
    // Get active subscription
    const subscription = await c.env.DB.prepare(
      `SELECT stripe_subscription_id FROM subscriptions 
       WHERE mocha_user_id = ? 
       AND status IN ('active', 'trialing')
       ORDER BY created_at DESC 
       LIMIT 1`
    )
      .bind(mochaUser.id)
      .first();

    if (!subscription) {
      return c.json({ error: "No active subscription found" }, 404);
    }

    const stripe = getStripeClient(c.env);
    
    // Cancel at period end
    await stripe.subscriptions.update(
      subscription.stripe_subscription_id as string,
      {
        cancel_at_period_end: true,
      }
    );

    // Update database
    await c.env.DB.prepare(
      `UPDATE subscriptions 
       SET cancel_at_period_end = 1, updated_at = CURRENT_TIMESTAMP 
       WHERE stripe_subscription_id = ?`
    )
      .bind(subscription.stripe_subscription_id)
      .run();

    return c.json({ success: true });
  } catch (error) {
    console.error("Error canceling subscription:", error);
    return c.json({ error: "Failed to cancel subscription" }, 500);
  }
}

/**
 * Get earnings and transaction history
 */
export async function getEarnings(c: Context) {
  const mochaUser = c.get("user");
  
  if (!mochaUser) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  try {
    // Get user profile with earnings
    const profile = await c.env.DB.prepare(
      "SELECT earnings_balance, commission_rate FROM user_profiles WHERE mocha_user_id = ?"
    )
      .bind(mochaUser.id)
      .first();

    // Get affiliate sales
    const affiliateSales = await c.env.DB.prepare(
      `SELECT * FROM affiliate_sales 
       WHERE referrer_user_id = ? 
       ORDER BY created_at DESC 
       LIMIT 50`
    )
      .bind(mochaUser.id)
      .all();

    // Get payout requests
    const payoutRequests = await c.env.DB.prepare(
      `SELECT * FROM payout_requests 
       WHERE mocha_user_id = ? 
       ORDER BY requested_at DESC 
       LIMIT 20`
    )
      .bind(mochaUser.id)
      .all();

    return c.json({
      earningsBalance: profile?.earnings_balance || 0,
      commissionRate: profile?.commission_rate || 0.05,
      affiliateSales: affiliateSales.results || [],
      payoutRequests: payoutRequests.results || [],
    });
  } catch (error) {
    console.error("Error fetching earnings:", error);
    return c.json({ error: "Failed to fetch earnings" }, 500);
  }
}

/**
 * Request payout
 */
export async function requestPayout(c: Context) {
  const mochaUser = c.get("user");
  
  if (!mochaUser) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  try {
    const body = await c.req.json();
    const { amount } = body;

    if (!amount || amount <= 0) {
      return c.json({ error: "Invalid amount" }, 400);
    }

    // Check user's earnings balance
    const profile = await c.env.DB.prepare(
      "SELECT earnings_balance, stripe_account_id FROM user_profiles WHERE mocha_user_id = ?"
    )
      .bind(mochaUser.id)
      .first();

    if (!profile) {
      return c.json({ error: "User profile not found" }, 404);
    }

    const earningsBalance = (profile.earnings_balance as number) || 0;

    if (amount > earningsBalance) {
      return c.json({ error: "Insufficient balance" }, 400);
    }

    // Minimum payout of $20
    if (amount < 2000) {
      return c.json({ error: "Minimum payout is $20" }, 400);
    }

    if (!profile.stripe_account_id) {
      return c.json({ error: "Stripe account not connected" }, 400);
    }

    // Create payout request
    await c.env.DB.prepare(
      `INSERT INTO payout_requests (mocha_user_id, amount, stripe_account_id, requested_at, created_at, updated_at)
       VALUES (?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`
    )
      .bind(mochaUser.id, amount, profile.stripe_account_id)
      .run();

    // Deduct from earnings balance
    await c.env.DB.prepare(
      `UPDATE user_profiles 
       SET earnings_balance = earnings_balance - ?, updated_at = CURRENT_TIMESTAMP 
       WHERE mocha_user_id = ?`
    )
      .bind(amount, mochaUser.id)
      .run();

    return c.json({ success: true });
  } catch (error) {
    console.error("Error requesting payout:", error);
    return c.json({ error: "Failed to request payout" }, 500);
  }
}

/**
 * Create Stripe Connect account link for ambassadors/influencers
 */
export async function createConnectAccountLink(c: Context) {
  const mochaUser = c.get("user");
  
  if (!mochaUser) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  try {
    const stripe = getStripeClient(c.env);
    
    // Check if user is ambassador or influencer
    const profile = await c.env.DB.prepare(
      "SELECT role, stripe_account_id FROM user_profiles WHERE mocha_user_id = ?"
    )
      .bind(mochaUser.id)
      .first();

    if (!profile || !['ambassador', 'influencer'].includes(profile.role as string)) {
      return c.json({ error: "Only ambassadors and influencers can connect accounts" }, 403);
    }

    let accountId = profile.stripe_account_id as string;

    // Create Stripe Connect account if doesn't exist
    if (!accountId) {
      const account = await stripe.accounts.create({
        type: "express",
        email: mochaUser.google_user_data.email,
        capabilities: {
          transfers: { requested: true },
        },
        metadata: {
          mocha_user_id: mochaUser.id,
        },
      });

      accountId = account.id;

      // Store account ID
      await c.env.DB.prepare(
        `UPDATE user_profiles 
         SET stripe_account_id = ?, updated_at = CURRENT_TIMESTAMP 
         WHERE mocha_user_id = ?`
      )
        .bind(accountId, mochaUser.id)
        .run();
    }

    // Create account link for onboarding
    const accountLink = await stripe.accountLinks.create({
      account: accountId,
      refresh_url: `${c.req.header("origin")}/dashboard`,
      return_url: `${c.req.header("origin")}/dashboard?stripe_connect=success`,
      type: "account_onboarding",
    });

    return c.json({ 
      url: accountLink.url 
    });
  } catch (error) {
    console.error("Error creating connect account link:", error);
    return c.json({ error: "Failed to create connect account link" }, 500);
  }
}

/**
 * Admin: Process payout requests
 */
export async function processPayout(c: Context) {
  const mochaUser = c.get("user");
  
  if (!mochaUser) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  // Check if user is admin
  const userProfile = await c.env.DB.prepare(
    "SELECT is_admin FROM user_profiles WHERE mocha_user_id = ?"
  )
    .bind(mochaUser.id)
    .first();

  if (!userProfile || !userProfile.is_admin) {
    return c.json({ error: "Admin access required" }, 403);
  }

  try {
    const payoutId = c.req.param('payoutId');
    const body = await c.req.json();
    const { action, rejection_reason } = body;

    if (!action || !['approve', 'reject'].includes(action)) {
      return c.json({ error: "Invalid action" }, 400);
    }

    // Get payout request
    const payout = await c.env.DB.prepare(
      "SELECT * FROM payout_requests WHERE id = ? AND status = 'pending'"
    )
      .bind(payoutId)
      .first();

    if (!payout) {
      return c.json({ error: "Payout request not found or already processed" }, 404);
    }

    if (action === 'approve') {
      const stripe = getStripeClient(c.env);

      // Create transfer to connected account
      const transfer = await stripe.transfers.create({
        amount: payout.amount as number,
        currency: payout.currency as string,
        destination: payout.stripe_account_id as string,
        metadata: {
          payout_request_id: payout.id.toString(),
          mocha_user_id: payout.mocha_user_id as string,
        },
      });

      // Update payout request
      await c.env.DB.prepare(
        `UPDATE payout_requests 
         SET status = 'completed', 
             stripe_transfer_id = ?,
             processed_at = CURRENT_TIMESTAMP,
             processed_by = ?,
             updated_at = CURRENT_TIMESTAMP
         WHERE id = ?`
      )
        .bind(transfer.id, mochaUser.id, payoutId)
        .run();

      // Create notification
      await c.env.DB.prepare(
        `INSERT INTO notifications (mocha_user_id, type, content, created_at)
         VALUES (?, 'payment', 'Your payout of $' || ? || ' has been processed! 💰', CURRENT_TIMESTAMP)`
      )
        .bind(
          payout.mocha_user_id,
          ((payout.amount as number) / 100).toFixed(2)
        )
        .run();
    } else {
      // Reject payout - refund balance
      await c.env.DB.prepare(
        `UPDATE user_profiles 
         SET earnings_balance = earnings_balance + ?, updated_at = CURRENT_TIMESTAMP 
         WHERE mocha_user_id = ?`
      )
        .bind(payout.amount, payout.mocha_user_id)
        .run();

      // Update payout request
      await c.env.DB.prepare(
        `UPDATE payout_requests 
         SET status = 'rejected',
             rejection_reason = ?,
             processed_at = CURRENT_TIMESTAMP,
             processed_by = ?,
             updated_at = CURRENT_TIMESTAMP
         WHERE id = ?`
      )
        .bind(rejection_reason || null, mochaUser.id, payoutId)
        .run();

      // Create notification
      await c.env.DB.prepare(
        `INSERT INTO notifications (mocha_user_id, type, content, created_at)
         VALUES (?, 'payment', ?, CURRENT_TIMESTAMP)`
      )
        .bind(
          payout.mocha_user_id,
          rejection_reason 
            ? `Your payout request was declined. Reason: ${rejection_reason}`
            : 'Your payout request was declined.'
        )
        .run();
    }

    return c.json({ success: true });
  } catch (error) {
    console.error("Error processing payout:", error);
    return c.json({ error: "Failed to process payout" }, 500);
  }
}

/**
 * Admin: Get pending payout requests
 */
export async function getPendingPayouts(c: Context) {
  const mochaUser = c.get("user");
  
  if (!mochaUser) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  const userProfile = await c.env.DB.prepare(
    "SELECT is_admin FROM user_profiles WHERE mocha_user_id = ?"
  )
    .bind(mochaUser.id)
    .first();

  if (!userProfile || !userProfile.is_admin) {
    return c.json({ error: "Admin access required" }, 403);
  }

  try {
    const payouts = await c.env.DB.prepare(
      `SELECT 
        payout_requests.*,
        user_profiles.display_name,
        user_profiles.role
      FROM payout_requests
      LEFT JOIN user_profiles ON payout_requests.mocha_user_id = user_profiles.mocha_user_id
      WHERE payout_requests.status = 'pending'
      ORDER BY payout_requests.requested_at ASC`
    ).all();

    return c.json({ payouts: payouts.results || [] });
  } catch (error) {
    console.error("Error fetching pending payouts:", error);
    return c.json({ error: "Failed to fetch pending payouts" }, 500);
  }
}
