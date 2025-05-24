import { Webhook } from 'svix'
import { headers } from 'next/headers'
import { WebhookEvent, UserJSON } from '@clerk/nextjs/server'
import { NextRequest } from 'next/server';
import { createClient } from '@supabase/supabase-js'
import { randomUUID } from 'crypto';

// Cast req to NextRequest to satisfy verifyWebhook
// For more information, see https://clerk.com/docs/integrations/webhooks/verify-webhook-signatures#nextjs-route-handler
export async function POST(req: NextRequest) {
  // You can find this in the Clerk Dashboard -> Webhooks -> choose the webhook
  const WEBHOOK_SECRET = process.env.CLERK_WEBHOOK_SIGNING_SECRET

  if (!WEBHOOK_SECRET) {
    throw new Error('Please add CLERK_WEBHOOK_SIGNING_SECRET from Clerk Dashboard to .env or .env.local')
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseServiceKey = process.env.NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !supabaseServiceKey) {
    throw new Error('Please add NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY to .env or .env.local')
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey)

  // Get the headers
  const headerPayload = await headers();
  const svix_id = headerPayload.get("svix-id");
  const svix_timestamp = headerPayload.get("svix-timestamp");
  const svix_signature = headerPayload.get("svix-signature");

  // If there are no headers, error out
  if (!svix_id || !svix_timestamp || !svix_signature) {
    return new Response('Error occured -- no svix headers', {
      status: 400
    })
  }

  // Get the body
  const payload = await req.json()
  const body = JSON.stringify(payload);

  // Create a new Svix instance with your secret.
  const wh = new Webhook(WEBHOOK_SECRET);

  let evt: WebhookEvent

  // Verify the payload with the headers
  try {
    evt = wh.verify(body, {
      "svix-id": svix_id,
      "svix-timestamp": svix_timestamp,
      "svix-signature": svix_signature,
    }) as WebhookEvent

    const eventType = evt.type;
    console.log(`Received webhook event type: ${eventType}`);
    console.log('Webhook payload:', evt.data);

    if (eventType === 'user.created') {
      const userData = evt.data as UserJSON; // Cast to UserJSON for better type safety
      console.log('Processing user.created event for Clerk user ID:', userData.id);

      const primaryEmailObj = userData.email_addresses?.find(email => email.id === userData.primary_email_address_id);
      const email = primaryEmailObj ? primaryEmailObj.email_address : null;

      if (!email) {
        console.error('Primary email not found for user:', userData.id);
        // Decide if you want to error out or proceed without an email
        // For now, we'll log and continue, but you might want to return an error response
      }
      
      const fullName = `${userData.first_name || ''} ${userData.last_name || ''}`.trim() || null;

      const { data: supabaseUser, error: supabaseError } = await supabase
        .from('profiles')
        .insert([
          {
            id: randomUUID(), // Use the Clerk user ID, assuming it's also the Supabase auth.users.id
            email: email,
            full_name: fullName,
            clerk_id: userData.id, // Also store clerk_id for explicit mapping if needed
            // created_at and updated_at have default values in Supabase
          },
        ])
        .select();

      if (supabaseError) {
        console.error('Error creating user in Supabase:', supabaseError);
        return new Response(`Error creating user in Supabase: ${supabaseError.message}`, { status: 500 });
      }

      console.log('User successfully created in Supabase:', supabaseUser);
    } else if (eventType === 'user.updated') {
      // Handle user.updated event
      // Example: Update user's email or full_name in Supabase
      console.log('Received user.updated event. Implement update logic here.');
    } else if (eventType === 'user.deleted') {
      // Handle user.deleted event
      // Example: Delete user from Supabase or mark as deleted
      console.log('Received user.deleted event. Implement delete logic here.');
    }
    // Add more event types as needed

    return new Response('Webhook received and processed', { status: 200 })
  } catch (err: any) {
    console.error('Error verifying or processing webhook:', err);
    return new Response(`Error verifying or processing webhook: ${err.message || 'Unknown error'}`, { status: 400 })
  }
}
