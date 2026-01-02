// This is a Vercel serverless function.
// It responds to requests at the path /api/config
// It securely provides the public Supabase URL and Anon key to the frontend.

export const config = {
  runtime: 'edge',
};

export default function handler(request) {
  // Ensure you have these environment variables set in your Vercel project settings.
  // The names must be exactly SUPABASE_URL and SUPABASE_ANON_KEY
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    // If the variables are not set, return an error.
    return new Response(
      JSON.stringify({ error: 'Missing Supabase environment variables on the server.' }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }

  // If the variables are present, return them to the client.
  return new Response(
    JSON.stringify({
      url: supabaseUrl,
      anon: supabaseAnonKey,
    }),
    {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    }
  );
}
