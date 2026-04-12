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
export type TicketStatus = 'open' | 'in_progress' | 'closed';
export type AnnouncementType = 'info' | 'warning' | 'success';

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
          stripe_customer_id: string | null;
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
          stripe_customer_id?: string | null;
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
          stripe_customer_id?: string | null;
          email_notifications?: boolean;
          updated_at?: string;
        };
        Relationships: [];
      };
      jobs: {
        Row: {
          id: string;
          reference_number: string;
          client_id: string;
          assigned_admin_id: string | null;
          vehicle_brand: string;
          vehicle_model: string;
          vehicle_year: string;
          engine_type: string;
          engine_power_hp: number | null;
          ecu_type: string | null;
          gearbox_type: string | null;
          job_type: string;
          tcu_type: string | null;
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
          file_type: string | null;
          is_original: boolean;
          reading_tool: string | null;
          tool_type: string | null;
          model_year: string | null;
          car_notes: string | null;
        };
        Insert: {
          id?: string;
          reference_number?: string;
          client_id: string;
          assigned_admin_id?: string | null;
          vehicle_brand: string;
          vehicle_model: string;
          vehicle_year: string;
          engine_type: string;
          engine_power_hp?: number | null;
          ecu_type?: string | null;
          gearbox_type?: string | null;
          job_type?: string;
          tcu_type?: string | null;
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
          file_type?: string | null;
          is_original?: boolean;
          reading_tool?: string | null;
          tool_type?: string | null;
          model_year?: string | null;
          car_notes?: string | null;
        };
        Update: {
          id?: string;
          reference_number?: string;
          client_id?: string;
          assigned_admin_id?: string | null;
          vehicle_brand?: string;
          vehicle_model?: string;
          vehicle_year?: string;
          engine_type?: string;
          engine_power_hp?: number | null;
          ecu_type?: string | null;
          gearbox_type?: string | null;
          job_type?: string;
          tcu_type?: string | null;
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
          file_type?: string | null;
          is_original?: boolean;
          reading_tool?: string | null;
          tool_type?: string | null;
          model_year?: string | null;
          car_notes?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "jobs_client_id_fkey";
            columns: ["client_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "jobs_assigned_admin_id_fkey";
            columns: ["assigned_admin_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
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
        Relationships: [
          {
            foreignKeyName: "job_services_job_id_fkey";
            columns: ["job_id"];
            isOneToOne: false;
            referencedRelation: "jobs";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "job_services_service_id_fkey";
            columns: ["service_id"];
            isOneToOne: false;
            referencedRelation: "services";
            referencedColumns: ["id"];
          },
        ];
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
        Relationships: [
          {
            foreignKeyName: "services_category_id_fkey";
            columns: ["category_id"];
            isOneToOne: false;
            referencedRelation: "service_categories";
            referencedColumns: ["id"];
          },
        ];
      };
      service_categories: {
        Row: {
          id: string;
          name: string;
          description: string | null;
          sort_order: number;
          is_active: boolean;
          selection_type: string;
          job_type: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          description?: string | null;
          sort_order?: number;
          is_active?: boolean;
          selection_type?: string;
          job_type?: string;
        };
        Update: {
          id?: string;
          name?: string;
          description?: string | null;
          sort_order?: number;
          is_active?: boolean;
          selection_type?: string;
          job_type?: string;
        };
        Relationships: [];
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
          version: number;
          revision_note: string | null;
        };
        Insert: {
          id?: string;
          job_id: string;
          file_type: FileType;
          original_name: string;
          storage_path: string;
          file_size: number;
          uploaded_by: string;
          version?: number;
          revision_note?: string | null;
        };
        Update: {
          id?: string;
          job_id?: string;
          file_type?: FileType;
          original_name?: string;
          storage_path?: string;
          file_size?: number;
          uploaded_by?: string;
          version?: number;
          revision_note?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "files_job_id_fkey";
            columns: ["job_id"];
            isOneToOne: false;
            referencedRelation: "jobs";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "files_uploaded_by_fkey";
            columns: ["uploaded_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
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
        Relationships: [
          {
            foreignKeyName: "job_messages_job_id_fkey";
            columns: ["job_id"];
            isOneToOne: false;
            referencedRelation: "jobs";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "job_messages_sender_id_fkey";
            columns: ["sender_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
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
        Relationships: [
          {
            foreignKeyName: "transactions_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "transactions_job_id_fkey";
            columns: ["job_id"];
            isOneToOne: false;
            referencedRelation: "jobs";
            referencedColumns: ["id"];
          },
        ];
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
        Relationships: [];
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
        Relationships: [
          {
            foreignKeyName: "notifications_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      tickets: {
        Row: {
          id: string;
          client_id: string;
          subject: string;
          status: TicketStatus;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          client_id: string;
          subject: string;
          status?: TicketStatus;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          client_id?: string;
          subject?: string;
          status?: TicketStatus;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "tickets_client_id_fkey";
            columns: ["client_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      ticket_messages: {
        Row: {
          id: string;
          ticket_id: string;
          sender_id: string;
          message: string;
          is_read: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          ticket_id: string;
          sender_id: string;
          message: string;
          is_read?: boolean;
          created_at?: string;
        };
        Update: {
          id?: string;
          ticket_id?: string;
          sender_id?: string;
          message?: string;
          is_read?: boolean;
        };
        Relationships: [
          {
            foreignKeyName: "ticket_messages_ticket_id_fkey";
            columns: ["ticket_id"];
            isOneToOne: false;
            referencedRelation: "tickets";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "ticket_messages_sender_id_fkey";
            columns: ["sender_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      job_ratings: {
        Row: {
          id: string;
          job_id: string;
          user_id: string;
          rating: number;
          comment: string | null;
          is_public: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          job_id: string;
          user_id: string;
          rating: number;
          comment?: string | null;
          is_public?: boolean;
          created_at?: string;
        };
        Update: {
          id?: string;
          rating?: number;
          comment?: string | null;
          is_public?: boolean;
        };
        Relationships: [
          {
            foreignKeyName: "job_ratings_job_id_fkey";
            columns: ["job_id"];
            isOneToOne: true;
            referencedRelation: "jobs";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "job_ratings_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      admin_audit_log: {
        Row: {
          id: string;
          admin_id: string | null;
          action: string;
          target_type: string | null;
          target_id: string | null;
          metadata: Json;
          created_at: string;
        };
        Insert: {
          id?: string;
          admin_id?: string | null;
          action: string;
          target_type?: string | null;
          target_id?: string | null;
          metadata?: Json;
          created_at?: string;
        };
        Update: {
          id?: string;
          action?: string;
          target_type?: string | null;
          target_id?: string | null;
          metadata?: Json;
        };
        Relationships: [
          {
            foreignKeyName: "admin_audit_log_admin_id_fkey";
            columns: ["admin_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      saved_vehicles: {
        Row: {
          id: string;
          user_id: string;
          nickname: string | null;
          vehicle_brand: string;
          vehicle_model: string;
          vehicle_generation: string | null;
          vehicle_year: string | null;
          engine_type: string;
          ecu_type: string | null;
          gearbox_type: string | null;
          vin: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          nickname?: string | null;
          vehicle_brand: string;
          vehicle_model: string;
          vehicle_generation?: string | null;
          vehicle_year?: string | null;
          engine_type: string;
          ecu_type?: string | null;
          gearbox_type?: string | null;
          vin?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          nickname?: string | null;
          vehicle_brand?: string;
          vehicle_model?: string;
          vehicle_generation?: string | null;
          vehicle_year?: string | null;
          engine_type?: string;
          ecu_type?: string | null;
          gearbox_type?: string | null;
          vin?: string | null;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "saved_vehicles_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      announcements: {
        Row: {
          id: string;
          title: string;
          message: string;
          type: AnnouncementType;
          is_active: boolean;
          image_url: string | null;
          created_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          title: string;
          message: string;
          type?: AnnouncementType;
          is_active?: boolean;
          image_url?: string | null;
          created_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          title?: string;
          message?: string;
          type?: AnnouncementType;
          is_active?: boolean;
          image_url?: string | null;
          created_by?: string | null;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "announcements_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      create_job_with_services: {
        Args: {
          p_vehicle_brand: string;
          p_vehicle_model: string;
          p_vehicle_year: string;
          p_engine_type: string;
          p_engine_power_hp: number | null;
          p_ecu_type: string | null;
          p_gearbox_type: string | null;
          p_vin: string | null;
          p_mileage: number | null;
          p_fuel_type: string | null;
          p_client_notes: string | null;
          p_service_codes: string[];
        };
        Returns: string;
      };
      update_job_status: {
        Args: {
          p_job_id: string;
          p_status: string;
          p_admin_notes: string | null;
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
      admin_refund_credits: {
        Args: {
          p_user_id: string;
          p_amount: number;
          p_reason: string;
          p_job_id: string | null;
          p_original_transaction_id: string | null;
        };
        Returns: string;
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
      log_admin_action: {
        Args: {
          p_action: string;
          p_target_type?: string | null;
          p_target_id?: string | null;
          p_metadata?: Json;
        };
        Returns: string;
      };
      next_file_version: {
        Args: {
          p_job_id: string;
          p_file_type: FileType;
        };
        Returns: number;
      };
    };
    Enums: {
      [_ in never]: never;
    };
    CompositeTypes: {
      [_ in never]: never;
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
export type Ticket = Database['public']['Tables']['tickets']['Row'];
export type TicketMessage = Database['public']['Tables']['ticket_messages']['Row'];
export type Announcement = Database['public']['Tables']['announcements']['Row'];
export type JobRating = Database['public']['Tables']['job_ratings']['Row'];
export type AdminAuditEntry = Database['public']['Tables']['admin_audit_log']['Row'];
export type SavedVehicle = Database['public']['Tables']['saved_vehicles']['Row'];

// Admin audit entry joined with the admin's profile
export interface AdminAuditEntryWithAdmin extends AdminAuditEntry {
  admin: Pick<Profile, 'id' | 'contact_name' | 'email'> | null;
}

// Rating joined with the rater's profile (for public landing-page carousel)
export interface JobRatingWithUser extends JobRating {
  user: Pick<Profile, 'id' | 'contact_name' | 'company_name' | 'country'> | null;
  job?: Pick<Job, 'vehicle_brand' | 'vehicle_model' | 'engine_type'> | null;
}

// Extended types with relations
export interface JobWithDetails extends Job {
  services?: JobService[];
  files?: FileRecord[];
  client?: Profile;
}

// Type for admin job list (joined with client profile)
export interface JobWithClient extends Job {
  client: Profile | null;
}

// Type for admin job list with services (for stats)
export interface JobWithClientAndServices extends Job {
  client: Profile | null;
  services?: JobService[];
}

// Ticket with client info (for admin list)
export interface TicketWithClient extends Ticket {
  client: Profile | null;
}

// Ticket message with sender profile
export interface TicketMessageWithSender extends TicketMessage {
  sender?: Profile;
}
