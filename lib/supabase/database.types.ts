export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      admin_users: {
        Row: { user_id: string; created_at: string }
        Insert: { user_id: string; created_at?: string }
        Update: { user_id?: string; created_at?: string }
        Relationships: []
      }
      categories: {
        Row: {
          id: string
          name: string
          slug: string
          description: string | null
          image_url: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id: string
          name: string
          slug: string
          description?: string | null
          image_url?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          name?: string
          slug?: string
          description?: string | null
          image_url?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      products: {
        Row: {
          id: string
          name: string
          slug: string
          description: string
          dimensions: string | null
          material: string | null
          price: number | null
          minimum_order_quantity: number | null
          featured: boolean
          in_stock: boolean
          is_published: boolean
          category_id: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id: string
          name: string
          slug: string
          description: string
          dimensions?: string | null
          material?: string | null
          price?: number | null
          minimum_order_quantity?: number | null
          featured?: boolean
          in_stock?: boolean
          is_published?: boolean
          category_id: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          name?: string
          slug?: string
          description?: string
          dimensions?: string | null
          material?: string | null
          price?: number | null
          minimum_order_quantity?: number | null
          featured?: boolean
          in_stock?: boolean
          is_published?: boolean
          category_id?: string
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      product_images: {
        Row: {
          id: string
          product_id: string
          url: string
          alt_text: string | null
          is_primary: boolean
          display_order: number
          storage_path: string | null
          created_at: string
        }
        Insert: {
          id: string
          product_id: string
          url: string
          alt_text?: string | null
          is_primary?: boolean
          display_order?: number
          storage_path?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          product_id?: string
          url?: string
          alt_text?: string | null
          is_primary?: boolean
          display_order?: number
          storage_path?: string | null
          created_at?: string
        }
        Relationships: []
      }
    }
    Views: Record<string, never>
    Functions: {
      admin_save_product: {
        Args: { p_product: Json; p_images: Json }
        Returns: undefined
      }
    }
    Enums: Record<string, never>
    CompositeTypes: Record<string, never>
  }
}
