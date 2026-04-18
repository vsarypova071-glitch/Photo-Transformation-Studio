export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      access_codes: {
        Row: {
          code: string
          created_at: string
          credits: number
          expires_at: string | null
          id: string
          is_active: boolean
          plan_type: string
          styles_limit: number
        }
        Insert: {
          code: string
          created_at?: string
          credits: number
          expires_at?: string | null
          id?: string
          is_active?: boolean
          plan_type: string
          styles_limit: number
        }
        Update: {
          code?: string
          created_at?: string
          credits?: number
          expires_at?: string | null
          id?: string
          is_active?: boolean
          plan_type?: string
          styles_limit?: number
        }
        Relationships: []
      }
      code_redemptions: {
        Row: {
          code_id: string
          id: string
          redeemed_at: string
          user_id: string
        }
        Insert: {
          code_id: string
          id?: string
          redeemed_at?: string
          user_id: string
        }
        Update: {
          code_id?: string
          id?: string
          redeemed_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "code_redemptions_code_id_fkey"
            columns: ["code_id"]
            isOneToOne: false
            referencedRelation: "access_codes"
            referencedColumns: ["id"]
          },
        ]
      }
      credit_accounts: {
        Row: {
          balance: number
          created_at: string
          customer_key: string
          email: string | null
          id: string
          updated_at: string
        }
        Insert: {
          balance?: number
          created_at?: string
          customer_key: string
          email?: string | null
          id?: string
          updated_at?: string
        }
        Update: {
          balance?: number
          created_at?: string
          customer_key?: string
          email?: string | null
          id?: string
          updated_at?: string
        }
        Relationships: []
      }
      credit_transactions: {
        Row: {
          account_id: string
          amount: number
          created_at: string
          description: string | null
          id: string
          idempotency_key: string
          order_id: string | null
          type: string
        }
        Insert: {
          account_id: string
          amount: number
          created_at?: string
          description?: string | null
          id?: string
          idempotency_key: string
          order_id?: string | null
          type: string
        }
        Update: {
          account_id?: string
          amount?: number
          created_at?: string
          description?: string | null
          id?: string
          idempotency_key?: string
          order_id?: string | null
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "credit_transactions_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "credit_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "credit_transactions_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      orders: {
        Row: {
          created_at: string
          custom_prompt: string | null
          customer_key: string | null
          generation_status: string
          id: string
          is_full_body: boolean | null
          original_image: string | null
          payment_id: string | null
          payment_status: string
          photos_count: number
          price: number
          results: string[]
          style_ids: string[]
          tariff_id: string
          updated_at: string
          user_session_id: string
        }
        Insert: {
          created_at?: string
          custom_prompt?: string | null
          customer_key?: string | null
          generation_status?: string
          id?: string
          is_full_body?: boolean | null
          original_image?: string | null
          payment_id?: string | null
          payment_status?: string
          photos_count: number
          price: number
          results?: string[]
          style_ids?: string[]
          tariff_id: string
          updated_at?: string
          user_session_id: string
        }
        Update: {
          created_at?: string
          custom_prompt?: string | null
          customer_key?: string | null
          generation_status?: string
          id?: string
          is_full_body?: boolean | null
          original_image?: string | null
          payment_id?: string | null
          payment_status?: string
          photos_count?: number
          price?: number
          results?: string[]
          style_ids?: string[]
          tariff_id?: string
          updated_at?: string
          user_session_id?: string
        }
        Relationships: []
      }
      user_credits: {
        Row: {
          allowed_styles_count: number
          created_at: string
          id: string
          plan: string
          remaining_credits: number
          updated_at: string
          user_id: string
        }
        Insert: {
          allowed_styles_count?: number
          created_at?: string
          id?: string
          plan?: string
          remaining_credits?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          allowed_styles_count?: number
          created_at?: string
          id?: string
          plan?: string
          remaining_credits?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      debit_balance: {
        Args: { p_account_id: string; p_amount: number }
        Returns: number
      }
      refund_balance: {
        Args: { p_account_id: string; p_amount: number }
        Returns: number
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
