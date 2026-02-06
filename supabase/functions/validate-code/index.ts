import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.4'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey)
    
    const { action, userId, code } = await req.json()
    
    console.log(`Action: ${action}, userId: ${userId}`)
    
    if (!userId) {
      return new Response(
        JSON.stringify({ success: false, message: 'User ID required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    if (action === 'get_user') {
      // Get or create user credits
      const { data: existingUser, error: fetchError } = await supabase
        .from('user_credits')
        .select('*')
        .eq('user_id', userId)
        .maybeSingle()
      
      if (fetchError) {
        console.error('Error fetching user:', fetchError)
        throw fetchError
      }
      
      if (existingUser) {
        return new Response(
          JSON.stringify({ success: true, user: existingUser }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }
      
      // Create new user
      const { data: newUser, error: createError } = await supabase
        .from('user_credits')
        .insert({
          user_id: userId,
          plan: 'FREE',
          remaining_credits: 0,
          allowed_styles_count: 0
        })
        .select()
        .single()
      
      if (createError) {
        console.error('Error creating user:', createError)
        throw createError
      }
      
      console.log('Created new user:', newUser)
      return new Response(
        JSON.stringify({ success: true, user: newUser }),
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
      const { data: accessCode, error: codeError } = await supabase
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
      const { data: existingRedemption } = await supabase
        .from('code_redemptions')
        .select('id')
        .eq('code_id', accessCode.id)
        .eq('user_id', userId)
        .maybeSingle()
      
      if (existingRedemption) {
        return new Response(
          JSON.stringify({ success: false, message: 'Код уже был использован' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }
      
      // Get or create user
      let { data: user } = await supabase
        .from('user_credits')
        .select('*')
        .eq('user_id', userId)
        .maybeSingle()
      
      if (!user) {
        const { data: newUser, error: createErr } = await supabase
          .from('user_credits')
          .insert({
            user_id: userId,
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
        const { data: updatedUser, error: updateErr } = await supabase
          .from('user_credits')
          .update({
            plan: accessCode.plan_type,
            remaining_credits: user.remaining_credits + accessCode.credits,
            allowed_styles_count: accessCode.styles_limit
          })
          .eq('user_id', userId)
          .select()
          .single()
        
        if (updateErr) throw updateErr
        user = updatedUser
      }
      
      // Record the redemption
      await supabase
        .from('code_redemptions')
        .insert({
          code_id: accessCode.id,
          user_id: userId
        })
      
      const planNames: Record<string, string> = {
        'START': 'Стартовый',
        'PREMIUM': 'Премиум',
        'VIP': 'VIP'
      }
      
      console.log('Code activated:', { code, userId, plan: accessCode.plan_type })
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
      const { data: user, error: fetchErr } = await supabase
        .from('user_credits')
        .select('*')
        .eq('user_id', userId)
        .maybeSingle()
      
      if (fetchErr) throw fetchErr
      
      if (!user || user.remaining_credits <= 0) {
        return new Response(
          JSON.stringify({ success: false, message: 'Недостаточно кредитов' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }
      
      const { data: updatedUser, error: updateErr } = await supabase
        .from('user_credits')
        .update({ remaining_credits: user.remaining_credits - 1 })
        .eq('user_id', userId)
        .select()
        .single()
      
      if (updateErr) throw updateErr
      
      console.log('Credit used:', { userId, newBalance: updatedUser.remaining_credits })
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
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})