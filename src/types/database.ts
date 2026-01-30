export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type UserRole = 'client' | 'admin' | 'superadmin';
export type JobStatus = 'pending' | 'in_progress' | 'waiting_for_info' | 'completed' | 'revision_requested' | 'rejected';
export type FileType = 'original' | 'modified';
export type TransactionType = 'credit_purchase' | 'job_payment' | 'refund' | 'admin_adjustment';

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          email: string;
          role: UserRole;
          company_name: string | null;
          contact_name: string;
          phone: string | null;
          country: string | null;
          credit_balance: number;
          email_notifications: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          email: string;
          role?: UserRole;
          company_name?: string | null;
          contact_name: string;
          phone?: string | null;
          country?: string | null;
          credit_balance?: number;
          email_notifications?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          email?: string;
          role?: UserRole;
          company_name?: string | null;
          contact_name?: string;
          phone?: string | null;
          country?: string | null;
          credit_balance?: number;
          email_notifications?: boolean;
          updated_at?: string;
        };
      };
      jobs: {
        Row: {
          id: string;
          reference_number: string;
          client_id: string;
          assigned_admin_id: string | null;
          vehicle_brand: string;
          vehicle_model: string;
          vehicle_year: number;
          engine_type: string;
          engine_power_hp: number | null;
          ecu_type: string | null;
          gearbox_type: string | null;
          vin: string | null;
          mileage: number | null;
          fuel_type: string | null;
          status: JobStatus;
          priority: number;
          total_price: number;
          credits_used: number;
          client_notes: string | null;
          admin_notes: string | null;
          created_at: string;
          updated_at: string;
          started_at: string | null;
          completed_at: string | null;
          revision_count: number;
        };
        Insert: {
          id?: string;
          reference_number?: string;
          client_id: string;
          assigned_admin_id?: string | null;
          vehicle_brand: string;
          vehicle_model: string;
          vehicle_year: number;
          engine_type: string;
          engine_power_hp?: number | null;
          ecu_type?: string | null;
          gearbox_type?: string | null;
          vin?: string | null;
          mileage?: number | null;
          fuel_type?: string | null;
          status?: JobStatus;
          priority?: number;
          total_price?: number;
          credits_used?: number;
          client_notes?: string | null;
          admin_notes?: string | null;
          created_at?: string;
          updated_at?: string;
          started_at?: string | null;
          completed_at?: string | null;
          revision_count?: number;
        };
        Update: {
          id?: string;
          reference_number?: string;
          client_id?: string;
          assigned_admin_id?: string | null;
          vehicle_brand?: string;
          vehicle_model?: string;
          vehicle_year?: number;
          engine_type?: string;
          engine_power_hp?: number | null;
          ecu_type?: string | null;
          gearbox_type?: string | null;
          vin?: string | null;
          mileage?: number | null;
          fuel_type?: string | null;
          status?: JobStatus;
          priority?: number;
          total_price?: number;
          credits_used?: number;
          client_notes?: string | null;
          admin_notes?: string | null;
          updated_at?: string;
          started_at?: string | null;
          completed_at?: string | null;
          revision_count?: number;
        };
      };
      job_services: {
        Row: {
          id: string;
          job_id: string;
          service_id: string;
          service_name: string;
          price: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          job_id: string;
          service_id: string;
          service_name: string;
          price: number;
          created_at?: string;
        };
        Update: {
          id?: string;
          job_id?: string;
          service_id?: string;
          service_name?: string;
          price?: number;
        };
      };
      services: {
        Row: {
          id: string;
          category_id: string | null;
          code: string;
          name: string;
          description: string | null;
          base_price: number;
          estimated_hours: number;
          sort_order: number;
          is_active: boolean;
          icon: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          category_id?: string | null;
          code: string;
          name: string;
          description?: string | null;
          base_price: number;
          estimated_hours?: number;
          sort_order?: number;
          is_active?: boolean;
          icon?: string | null;
        };
        Update: {
          id?: string;
          category_id?: string | null;
          code?: string;
          name?: string;
          description?: string | null;
          base_price?: number;
          estimated_hours?: number;
          sort_order?: number;
          is_active?: boolean;
          icon?: string | null;
        };
      };
      service_categories: {
        Row: {
          id: string;
          name: string;
          description: string | null;
          sort_order: number;
          is_active: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          description?: string | null;
          sort_order?: number;
          is_active?: boolean;
        };
        Update: {
          id?: string;
          name?: string;
          description?: string | null;
          sort_order?: number;
          is_active?: boolean;
        };
      };
      files: {
        Row: {
          id: string;
          job_id: string;
          file_type: FileType;
          original_name: string;
          storage_path: string;
          file_size: number;
          uploaded_by: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          job_id: string;
          file_type: FileType;
          original_name: string;
          storage_path: string;
          file_size: number;
          uploaded_by: string;
        };
        Update: {
          id?: string;
          job_id?: string;
          file_type?: FileType;
          original_name?: string;
          storage_path?: string;
          file_size?: number;
          uploaded_by?: string;
        };
      };
      job_messages: {
        Row: {
          id: string;
          job_id: string;
          sender_id: string;
          message: string;
          is_internal: boolean;
          is_read: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          job_id: string;
          sender_id: string;
          message: string;
          is_internal?: boolean;
          is_read?: boolean;
        };
        Update: {
          id?: string;
          job_id?: string;
          sender_id?: string;
          message?: string;
          is_internal?: boolean;
          is_read?: boolean;
        };
      };
      transactions: {
        Row: {
          id: string;
          user_id: string;
          type: TransactionType;
          amount: number;
          balance_before: number;
          balance_after: number;
          job_id: string | null;
          description: string | null;
          processed_by: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          type: TransactionType;
          amount: number;
          balance_before: number;
          balance_after: number;
          job_id?: string | null;
          description?: string | null;
          processed_by?: string | null;
        };
        Update: {
          id?: string;
          user_id?: string;
          type?: TransactionType;
          amount?: number;
          balance_before?: number;
          balance_after?: number;
          job_id?: string | null;
          description?: string | null;
          processed_by?: string | null;
        };
      };
      credit_packages: {
        Row: {
          id: string;
          name: string;
          credits: number;
          price: number;
          bonus_credits: number;
          is_active: boolean;
          sort_order: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          credits: number;
          price: number;
          bonus_credits?: number;
          is_active?: boolean;
          sort_order?: number;
        };
        Update: {
          id?: string;
          name?: string;
          credits?: number;
          price?: number;
          bonus_credits?: number;
          is_active?: boolean;
          sort_order?: number;
        };
      };
      notifications: {
        Row: {
          id: string;
          user_id: string;
          title: string;
          message: string;
          link_type: string | null;
          link_id: string | null;
          is_read: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          title: string;
          message: string;
          link_type?: string | null;
          link_id?: string | null;
          is_read?: boolean;
        };
        Update: {
          id?: string;
          user_id?: string;
          title?: string;
          message?: string;
          link_type?: string | null;
          link_id?: string | null;
          is_read?: boolean;
        };
      };
    };
    Functions: {
      create_job_with_services: {
        Args: {
          p_vehicle_brand: string;
          p_vehicle_model: string;
          p_vehicle_year: number;
          p_engine_type: string;
          p_engine_power_hp?: number;
          p_ecu_type?: string;
          p_gearbox_type?: string;
          p_vin?: string;
          p_mileage?: number;
          p_fuel_type?: string;
          p_client_notes?: string;
          p_service_codes: string[];
        };
        Returns: string;
      };
      update_job_status: {
        Args: {
          p_job_id: string;
          p_status: JobStatus;
          p_admin_notes?: string;
        };
        Returns: boolean;
      };
      admin_add_credits: {
        Args: {
          p_user_id: string;
          p_amount: number;
          p_description: string;
        };
        Returns: boolean;
      };
      request_job_revision: {
        Args: {
          p_job_id: string;
          p_reason: string;
        };
        Returns: boolean;
      };
      is_admin: {
        Args: Record<string, never>;
        Returns: boolean;
      };
    };
  };
}

// Convenience types
export type Profile = Database['public']['Tables']['profiles']['Row'];
export type Job = Database['public']['Tables']['jobs']['Row'];
export type JobService = Database['public']['Tables']['job_services']['Row'];
export type Service = Database['public']['Tables']['services']['Row'];
export type ServiceCategory = Database['public']['Tables']['service_categories']['Row'];
export type FileRecord = Database['public']['Tables']['files']['Row'];
export type JobMessage = Database['public']['Tables']['job_messages']['Row'];
export type Transaction = Database['public']['Tables']['transactions']['Row'];
export type CreditPackage = Database['public']['Tables']['credit_packages']['Row'];
export type Notification = Database['public']['Tables']['notifications']['Row'];

// Extended types with relations
export interface JobWithDetails extends Job {
  services?: JobService[];
  files?: FileRecord[];
  client?: Profile;
}
