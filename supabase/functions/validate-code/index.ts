import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.4'

// Dynamic CORS - allow known origins
const allowedOrigins = [
  'https://id-preview--6affbc0d-4b19-468e-83f8-5a6a9f72626a.lovable.app',
  'https://photo-transformation-studio.lovable.app',
  'http://localhost:5173',
  'http://localhost:3000'
]

function getCorsHeaders(req: Request) {
  const origin = req.headers.get('Origin') || ''
  const allowOrigin = allowedOrigins.includes(origin) ? origin : allowedOrigins[0]
  
  return {
    'Access-Control-Allow-Origin': allowOrigin,
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
    'Access-Control-Allow-Credentials': 'true',
  }
}

Deno.serve(async (req) => {
  const corsHeaders = getCorsHeaders(req)
  
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!
    
    // Create service role client for database operations
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey)
    
    // Validate JWT token from Authorization header
    const authHeader = req.headers.get('Authorization')
    let authenticatedUserId: string | null = null
    
    if (authHeader?.startsWith('Bearer ')) {
      const token = authHeader.replace('Bearer ', '')
      
      // Create client with user's token to validate
      const supabaseAuth = createClient(supabaseUrl, supabaseAnonKey, {
        global: { headers: { Authorization: authHeader } }
      })
      
      const { data, error } = await supabaseAuth.auth.getUser()
      if (!error && data?.user) {
        authenticatedUserId = data.user.id
        console.log('Authenticated user:', authenticatedUserId)
      }
    }
    
    const { action, code } = await req.json()
    
    console.log(`Action: ${action}, authenticated: ${!!authenticatedUserId}`)
    
    // For all actions, require authentication
    if (!authenticatedUserId) {
      console.log('Unauthorized request - no valid auth token')
      return new Response(
        JSON.stringify({ success: false, message: 'Требуется авторизация' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    if (action === 'get_user') {
      // Get or create user credits using upsert to handle race conditions
      const { data: user, error: upsertError } = await supabaseAdmin
        .from('user_credits')
        .upsert({
          user_id: authenticatedUserId,
          plan: 'FREE',
          remaining_credits: 0,
          allowed_styles_count: 0
        }, {
          onConflict: 'user_id',
          ignoreDuplicates: true
        })
        .select()
        .single()
      
      if (upsertError) {
        // If upsert failed, try to fetch existing user
        console.log('Upsert returned error, fetching existing user:', upsertError.message)
        const { data: existingUser, error: fetchError } = await supabaseAdmin
          .from('user_credits')
          .select('*')
          .eq('user_id', authenticatedUserId)
          .single()
        
        if (fetchError || !existingUser) {
          console.error('Error fetching user after upsert:', fetchError)
          throw fetchError || new Error('User not found')
        }
        
        return new Response(
          JSON.stringify({ success: true, user: existingUser }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }
      
      console.log('User retrieved/created:', user?.user_id)
      return new Response(
        JSON.stringify({ success: true, user }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    if (action === 'activate_code') {
      if (!code) {
        return new Response(
          JSON.stringify({ success: false, message: 'Code required' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }
      
      // Find the code in database
      const { data: accessCode, error: codeError } = await supabaseAdmin
        .from('access_codes')
        .select('*')
        .eq('code', code)
        .eq('is_active', true)
        .maybeSingle()
      
      if (codeError) {
        console.error('Error finding code:', codeError)
        throw codeError
      }
      
      if (!accessCode) {
        console.log('Invalid code attempted:', code)
        return new Response(
          JSON.stringify({ success: false, message: 'Неверный код доступа' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }
      
      // Check if code was already redeemed by this user
      const { data: existingRedemption } = await supabaseAdmin
        .from('code_redemptions')
        .select('id')
        .eq('code_id', accessCode.id)
        .eq('user_id', authenticatedUserId)
        .maybeSingle()
      
      if (existingRedemption) {
        return new Response(
          JSON.stringify({ success: false, message: 'Код уже был использован' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }
      
      // Get or create user
      let { data: user } = await supabaseAdmin
        .from('user_credits')
        .select('*')
        .eq('user_id', authenticatedUserId)
        .maybeSingle()
      
      if (!user) {
        const { data: newUser, error: createErr } = await supabaseAdmin
          .from('user_credits')
          .insert({
            user_id: authenticatedUserId,
            plan: accessCode.plan_type,
            remaining_credits: accessCode.credits,
            allowed_styles_count: accessCode.styles_limit
          })
          .select()
          .single()
        
        if (createErr) throw createErr
        user = newUser
      } else {
        // Update existing user
        const { data: updatedUser, error: updateErr } = await supabaseAdmin
          .from('user_credits')
          .update({
            plan: accessCode.plan_type,
            remaining_credits: user.remaining_credits + accessCode.credits,
            allowed_styles_count: accessCode.styles_limit
          })
          .eq('user_id', authenticatedUserId)
          .select()
          .single()
        
        if (updateErr) throw updateErr
        user = updatedUser
      }
      
      // Record the redemption
      await supabaseAdmin
        .from('code_redemptions')
        .insert({
          code_id: accessCode.id,
          user_id: authenticatedUserId
        })
      
      const planNames: Record<string, string> = {
        'START': 'Стартовый',
        'PREMIUM': 'Премиум',
        'VIP': 'VIP'
      }
      
      console.log('Code activated:', { code, authenticatedUserId, plan: accessCode.plan_type })
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: `Пакет ${planNames[accessCode.plan_type] || accessCode.plan_type} активирован!`,
          user 
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    if (action === 'use_credit') {
      // Deduct a credit from user
      const { data: user, error: fetchErr } = await supabaseAdmin
        .from('user_credits')
        .select('*')
        .eq('user_id', authenticatedUserId)
        .maybeSingle()
      
      if (fetchErr) throw fetchErr
      
      if (!user || user.remaining_credits <= 0) {
        return new Response(
          JSON.stringify({ success: false, message: 'Недостаточно кредитов' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }
      
      const { data: updatedUser, error: updateErr } = await supabaseAdmin
        .from('user_credits')
        .update({ remaining_credits: user.remaining_credits - 1 })
        .eq('user_id', authenticatedUserId)
        .select()
        .single()
      
      if (updateErr) throw updateErr
      
      console.log('Credit used:', { authenticatedUserId, newBalance: updatedUser.remaining_credits })
      return new Response(
        JSON.stringify({ success: true, user: updatedUser }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    return new Response(
      JSON.stringify({ success: false, message: 'Invalid action' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Edge function error:', error)
    return new Response(
      JSON.stringify({ success: false, message: 'Internal server error' }),
      { status: 500, headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' } }
    )
  }
})
