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
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      application_documents: {
        Row: {
          application_id: string
          created_at: string
          deleted_at: string | null
          doc_type: Database["public"]["Enums"]["document_type"]
          id: string
          storage_path: string
          updated_at: string
          uploaded_by: string | null
          verification_notes: string | null
          verified_at: string | null
          verified_by: string | null
        }
        Insert: {
          application_id: string
          created_at?: string
          deleted_at?: string | null
          doc_type: Database["public"]["Enums"]["document_type"]
          id?: string
          storage_path: string
          updated_at?: string
          uploaded_by?: string | null
          verification_notes?: string | null
          verified_at?: string | null
          verified_by?: string | null
        }
        Update: {
          application_id?: string
          created_at?: string
          deleted_at?: string | null
          doc_type?: Database["public"]["Enums"]["document_type"]
          id?: string
          storage_path?: string
          updated_at?: string
          uploaded_by?: string | null
          verification_notes?: string | null
          verified_at?: string | null
          verified_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "application_documents_application_id_fkey"
            columns: ["application_id"]
            isOneToOne: false
            referencedRelation: "loan_applications"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "application_documents_uploaded_by_fkey"
            columns: ["uploaded_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "application_documents_verified_by_fkey"
            columns: ["verified_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      approvals: {
        Row: {
          application_id: string
          approver_id: string
          created_at: string
          decided_at: string
          decision: Database["public"]["Enums"]["approval_decision"]
          deleted_at: string | null
          id: string
          notes: string | null
          tier: Database["public"]["Enums"]["approval_tier"]
          updated_at: string
        }
        Insert: {
          application_id: string
          approver_id: string
          created_at?: string
          decided_at?: string
          decision: Database["public"]["Enums"]["approval_decision"]
          deleted_at?: string | null
          id?: string
          notes?: string | null
          tier: Database["public"]["Enums"]["approval_tier"]
          updated_at?: string
        }
        Update: {
          application_id?: string
          approver_id?: string
          created_at?: string
          decided_at?: string
          decision?: Database["public"]["Enums"]["approval_decision"]
          deleted_at?: string | null
          id?: string
          notes?: string | null
          tier?: Database["public"]["Enums"]["approval_tier"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "approvals_application_id_fkey"
            columns: ["application_id"]
            isOneToOne: false
            referencedRelation: "loan_applications"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "approvals_approver_id_fkey"
            columns: ["approver_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_log: {
        Row: {
          action: string
          actor_id: string | null
          after: Json | null
          before: Json | null
          entity_id: string | null
          entity_type: string
          id: string
          ip: unknown
          occurred_at: string
          user_agent: string | null
        }
        Insert: {
          action: string
          actor_id?: string | null
          after?: Json | null
          before?: Json | null
          entity_id?: string | null
          entity_type: string
          id?: string
          ip?: unknown
          occurred_at?: string
          user_agent?: string | null
        }
        Update: {
          action?: string
          actor_id?: string | null
          after?: Json | null
          before?: Json | null
          entity_id?: string | null
          entity_type?: string
          id?: string
          ip?: unknown
          occurred_at?: string
          user_agent?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "audit_log_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      branches: {
        Row: {
          branch_code: string
          created_at: string
          created_by: string | null
          deleted_at: string | null
          id: string
          legacy_code: string | null
          manager_id: string | null
          name: string
          notes: string | null
          province: string
          status: Database["public"]["Enums"]["entity_status"]
          town: string
          updated_at: string
        }
        Insert: {
          branch_code: string
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          id?: string
          legacy_code?: string | null
          manager_id?: string | null
          name: string
          notes?: string | null
          province: string
          status?: Database["public"]["Enums"]["entity_status"]
          town: string
          updated_at?: string
        }
        Update: {
          branch_code?: string
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          id?: string
          legacy_code?: string | null
          manager_id?: string | null
          name?: string
          notes?: string | null
          province?: string
          status?: Database["public"]["Enums"]["entity_status"]
          town?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "branches_manager_id_fk"
            columns: ["manager_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      contract_audit_events: {
        Row: {
          actor_profile_id: string | null
          contract_id: string
          created_at: string
          event_type: Database["public"]["Enums"]["contract_audit_event_type"]
          id: string
          ip: unknown
          occurred_at: string
          payload: Json
          user_agent: string | null
        }
        Insert: {
          actor_profile_id?: string | null
          contract_id: string
          created_at?: string
          event_type: Database["public"]["Enums"]["contract_audit_event_type"]
          id?: string
          ip?: unknown
          occurred_at?: string
          payload?: Json
          user_agent?: string | null
        }
        Update: {
          actor_profile_id?: string | null
          contract_id?: string
          created_at?: string
          event_type?: Database["public"]["Enums"]["contract_audit_event_type"]
          id?: string
          ip?: unknown
          occurred_at?: string
          payload?: Json
          user_agent?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "contract_audit_events_actor_profile_id_fkey"
            columns: ["actor_profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contract_audit_events_contract_id_fkey"
            columns: ["contract_id"]
            isOneToOne: false
            referencedRelation: "contracts"
            referencedColumns: ["id"]
          },
        ]
      }
      contract_signatures: {
        Row: {
          authentication_evidence: Json
          authentication_method: string
          consent_given_at: string
          consent_text_snapshot: string
          consent_to_transact_electronically: boolean
          contract_id: string
          created_at: string
          device_fingerprint: string | null
          document_sha256_at_signing: string
          envelope_sha256: string
          geolocation: Json | null
          id: string
          ip_address: unknown
          nrc_knowledge_check_passed: boolean
          signatory_email_snapshot: string | null
          signatory_name_snapshot: string
          signatory_nrc_snapshot: string | null
          signatory_phone_snapshot: string | null
          signatory_profile_id: string
          signatory_role: Database["public"]["Enums"]["contract_signatory_role"]
          signature_drawn_points: Json | null
          signature_image_path: string | null
          signature_typed_name: string
          signed_at: string
          user_agent: string | null
        }
        Insert: {
          authentication_evidence?: Json
          authentication_method: string
          consent_given_at: string
          consent_text_snapshot: string
          consent_to_transact_electronically: boolean
          contract_id: string
          created_at?: string
          device_fingerprint?: string | null
          document_sha256_at_signing: string
          envelope_sha256: string
          geolocation?: Json | null
          id?: string
          ip_address?: unknown
          nrc_knowledge_check_passed: boolean
          signatory_email_snapshot?: string | null
          signatory_name_snapshot: string
          signatory_nrc_snapshot?: string | null
          signatory_phone_snapshot?: string | null
          signatory_profile_id: string
          signatory_role: Database["public"]["Enums"]["contract_signatory_role"]
          signature_drawn_points?: Json | null
          signature_image_path?: string | null
          signature_typed_name: string
          signed_at?: string
          user_agent?: string | null
        }
        Update: {
          authentication_evidence?: Json
          authentication_method?: string
          consent_given_at?: string
          consent_text_snapshot?: string
          consent_to_transact_electronically?: boolean
          contract_id?: string
          created_at?: string
          device_fingerprint?: string | null
          document_sha256_at_signing?: string
          envelope_sha256?: string
          geolocation?: Json | null
          id?: string
          ip_address?: unknown
          nrc_knowledge_check_passed?: boolean
          signatory_email_snapshot?: string | null
          signatory_name_snapshot?: string
          signatory_nrc_snapshot?: string | null
          signatory_phone_snapshot?: string | null
          signatory_profile_id?: string
          signatory_role?: Database["public"]["Enums"]["contract_signatory_role"]
          signature_drawn_points?: Json | null
          signature_image_path?: string | null
          signature_typed_name?: string
          signed_at?: string
          user_agent?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "contract_signatures_contract_id_fkey"
            columns: ["contract_id"]
            isOneToOne: false
            referencedRelation: "contracts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contract_signatures_signatory_profile_id_fkey"
            columns: ["signatory_profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      contract_templates: {
        Row: {
          body_html: string
          created_at: string
          created_by: string | null
          deleted_at: string | null
          effective_from: string | null
          effective_to: string | null
          id: string
          name: string
          published_at: string | null
          required_signatories: Database["public"]["Enums"]["contract_signatory_role"][]
          storage_path_snapshot: string | null
          template_key: string
          updated_at: string
          variables: Json
          version: number
        }
        Insert: {
          body_html: string
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          effective_from?: string | null
          effective_to?: string | null
          id?: string
          name: string
          published_at?: string | null
          required_signatories: Database["public"]["Enums"]["contract_signatory_role"][]
          storage_path_snapshot?: string | null
          template_key: string
          updated_at?: string
          variables?: Json
          version: number
        }
        Update: {
          body_html?: string
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          effective_from?: string | null
          effective_to?: string | null
          id?: string
          name?: string
          published_at?: string | null
          required_signatories?: Database["public"]["Enums"]["contract_signatory_role"][]
          storage_path_snapshot?: string | null
          template_key?: string
          updated_at?: string
          variables?: Json
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "contract_templates_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      contracts: {
        Row: {
          application_id: string | null
          certificate_of_completion_path: string | null
          contract_type: Database["public"]["Enums"]["contract_type"]
          created_at: string
          created_by: string | null
          document_sha256: string | null
          document_storage_path: string | null
          expires_at: string | null
          fully_signed_at: string | null
          fully_signed_pdf_path: string | null
          fully_signed_pdf_sha256: string | null
          id: string
          loan_id: string | null
          required_signatories: Database["public"]["Enums"]["contract_signatory_role"][]
          status: Database["public"]["Enums"]["contract_status"]
          template_id: string
          template_storage_path: string | null
          template_version: number
          updated_at: string
          voided_at: string | null
          voided_by: string | null
          voided_reason: string | null
        }
        Insert: {
          application_id?: string | null
          certificate_of_completion_path?: string | null
          contract_type: Database["public"]["Enums"]["contract_type"]
          created_at?: string
          created_by?: string | null
          document_sha256?: string | null
          document_storage_path?: string | null
          expires_at?: string | null
          fully_signed_at?: string | null
          fully_signed_pdf_path?: string | null
          fully_signed_pdf_sha256?: string | null
          id?: string
          loan_id?: string | null
          required_signatories: Database["public"]["Enums"]["contract_signatory_role"][]
          status?: Database["public"]["Enums"]["contract_status"]
          template_id: string
          template_storage_path?: string | null
          template_version: number
          updated_at?: string
          voided_at?: string | null
          voided_by?: string | null
          voided_reason?: string | null
        }
        Update: {
          application_id?: string | null
          certificate_of_completion_path?: string | null
          contract_type?: Database["public"]["Enums"]["contract_type"]
          created_at?: string
          created_by?: string | null
          document_sha256?: string | null
          document_storage_path?: string | null
          expires_at?: string | null
          fully_signed_at?: string | null
          fully_signed_pdf_path?: string | null
          fully_signed_pdf_sha256?: string | null
          id?: string
          loan_id?: string | null
          required_signatories?: Database["public"]["Enums"]["contract_signatory_role"][]
          status?: Database["public"]["Enums"]["contract_status"]
          template_id?: string
          template_storage_path?: string | null
          template_version?: number
          updated_at?: string
          voided_at?: string | null
          voided_by?: string | null
          voided_reason?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "contracts_application_id_fkey"
            columns: ["application_id"]
            isOneToOne: false
            referencedRelation: "loan_applications"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contracts_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contracts_loan_id_fkey"
            columns: ["loan_id"]
            isOneToOne: false
            referencedRelation: "loans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contracts_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "contract_templates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contracts_voided_by_fkey"
            columns: ["voided_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      due_diligence_checks: {
        Row: {
          application_id: string
          checked_at: string | null
          checked_by: string | null
          created_at: string
          deleted_at: string | null
          id: string
          item_key: string
          item_no: number
          note: string | null
          phase: number
          severity: string
          state: string
          updated_at: string
        }
        Insert: {
          application_id: string
          checked_at?: string | null
          checked_by?: string | null
          created_at?: string
          deleted_at?: string | null
          id?: string
          item_key: string
          item_no: number
          note?: string | null
          phase: number
          severity?: string
          state?: string
          updated_at?: string
        }
        Update: {
          application_id?: string
          checked_at?: string | null
          checked_by?: string | null
          created_at?: string
          deleted_at?: string | null
          id?: string
          item_key?: string
          item_no?: number
          note?: string | null
          phase?: number
          severity?: string
          state?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "due_diligence_checks_application_id_fkey"
            columns: ["application_id"]
            isOneToOne: false
            referencedRelation: "loan_applications"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "due_diligence_checks_checked_by_fkey"
            columns: ["checked_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      due_diligence_signoffs: {
        Row: {
          application_id: string
          created_at: string
          deleted_at: string | null
          id: string
          role_key: string
          signed_at: string
          signer_id: string
          updated_at: string
        }
        Insert: {
          application_id: string
          created_at?: string
          deleted_at?: string | null
          id?: string
          role_key: string
          signed_at?: string
          signer_id: string
          updated_at?: string
        }
        Update: {
          application_id?: string
          created_at?: string
          deleted_at?: string | null
          id?: string
          role_key?: string
          signed_at?: string
          signer_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "due_diligence_signoffs_application_id_fkey"
            columns: ["application_id"]
            isOneToOne: false
            referencedRelation: "loan_applications"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "due_diligence_signoffs_signer_id_fkey"
            columns: ["signer_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      employees: {
        Row: {
          bank_account_no: string | null
          bank_account_type: string | null
          bank_branch: string | null
          bank_name: string | null
          created_at: string
          created_by: string | null
          date_of_birth: string | null
          deleted_at: string | null
          department: string | null
          employee_no: string
          employer_id: string
          employment_end_date: string | null
          employment_start_date: string | null
          employment_status: Database["public"]["Enums"]["employment_status"]
          gender: string | null
          id: string
          marital_status: string | null
          mobile_money_number: string | null
          mobile_money_provider: string | null
          nationality: string
          occupation: string | null
          postal_address: string | null
          profile_id: string
          residential_address: string | null
          residential_city: string | null
          residential_province: string | null
          salary_allowances_ngwee: number
          salary_basic_ngwee: number
          status: Database["public"]["Enums"]["entity_status"]
          updated_at: string
        }
        Insert: {
          bank_account_no?: string | null
          bank_account_type?: string | null
          bank_branch?: string | null
          bank_name?: string | null
          created_at?: string
          created_by?: string | null
          date_of_birth?: string | null
          deleted_at?: string | null
          department?: string | null
          employee_no: string
          employer_id: string
          employment_end_date?: string | null
          employment_start_date?: string | null
          employment_status?: Database["public"]["Enums"]["employment_status"]
          gender?: string | null
          id?: string
          marital_status?: string | null
          mobile_money_number?: string | null
          mobile_money_provider?: string | null
          nationality?: string
          occupation?: string | null
          postal_address?: string | null
          profile_id: string
          residential_address?: string | null
          residential_city?: string | null
          residential_province?: string | null
          salary_allowances_ngwee?: number
          salary_basic_ngwee?: number
          status?: Database["public"]["Enums"]["entity_status"]
          updated_at?: string
        }
        Update: {
          bank_account_no?: string | null
          bank_account_type?: string | null
          bank_branch?: string | null
          bank_name?: string | null
          created_at?: string
          created_by?: string | null
          date_of_birth?: string | null
          deleted_at?: string | null
          department?: string | null
          employee_no?: string
          employer_id?: string
          employment_end_date?: string | null
          employment_start_date?: string | null
          employment_status?: Database["public"]["Enums"]["employment_status"]
          gender?: string | null
          id?: string
          marital_status?: string | null
          mobile_money_number?: string | null
          mobile_money_provider?: string | null
          nationality?: string
          occupation?: string | null
          postal_address?: string | null
          profile_id?: string
          residential_address?: string | null
          residential_city?: string | null
          residential_province?: string | null
          salary_allowances_ngwee?: number
          salary_basic_ngwee?: number
          status?: Database["public"]["Enums"]["entity_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "employees_employer_id_fkey"
            columns: ["employer_id"]
            isOneToOne: false
            referencedRelation: "employers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employees_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      employer_benefits: {
        Row: {
          created_at: string
          created_by: string | null
          deleted_at: string | null
          disability_cover: boolean
          employer_id: string
          funeral_plan: boolean
          id: string
          life_cover: boolean
          other_text: string | null
          retrenchment_benefits: boolean
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          disability_cover?: boolean
          employer_id: string
          funeral_plan?: boolean
          id?: string
          life_cover?: boolean
          other_text?: string | null
          retrenchment_benefits?: boolean
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          disability_cover?: boolean
          employer_id?: string
          funeral_plan?: boolean
          id?: string
          life_cover?: boolean
          other_text?: string | null
          retrenchment_benefits?: boolean
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "employer_benefits_employer_id_fkey"
            columns: ["employer_id"]
            isOneToOne: true
            referencedRelation: "employers"
            referencedColumns: ["id"]
          },
        ]
      }
      employer_documents: {
        Row: {
          created_at: string
          deleted_at: string | null
          doc_type: Database["public"]["Enums"]["document_type"]
          employer_id: string
          id: string
          notes: string | null
          storage_path: string
          updated_at: string
          uploaded_by: string | null
        }
        Insert: {
          created_at?: string
          deleted_at?: string | null
          doc_type: Database["public"]["Enums"]["document_type"]
          employer_id: string
          id?: string
          notes?: string | null
          storage_path: string
          updated_at?: string
          uploaded_by?: string | null
        }
        Update: {
          created_at?: string
          deleted_at?: string | null
          doc_type?: Database["public"]["Enums"]["document_type"]
          employer_id?: string
          id?: string
          notes?: string | null
          storage_path?: string
          updated_at?: string
          uploaded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "employer_documents_employer_id_fkey"
            columns: ["employer_id"]
            isOneToOne: false
            referencedRelation: "employers"
            referencedColumns: ["id"]
          },
        ]
      }
      employer_payroll_config: {
        Row: {
          created_at: string
          created_by: string | null
          deleted_at: string | null
          employer_id: string
          id: string
          notes: string | null
          payment_schedule_date: string | null
          payout_format: string | null
          payroll_run_day: number | null
          submission_format: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          employer_id: string
          id?: string
          notes?: string | null
          payment_schedule_date?: string | null
          payout_format?: string | null
          payroll_run_day?: number | null
          submission_format?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          employer_id?: string
          id?: string
          notes?: string | null
          payment_schedule_date?: string | null
          payout_format?: string | null
          payroll_run_day?: number | null
          submission_format?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "employer_payroll_config_employer_id_fkey"
            columns: ["employer_id"]
            isOneToOne: true
            referencedRelation: "employers"
            referencedColumns: ["id"]
          },
        ]
      }
      employer_signatories: {
        Row: {
          created_at: string
          created_by: string | null
          deleted_at: string | null
          email: string | null
          employer_id: string
          full_name: string
          id: string
          is_active: boolean
          phone: string | null
          position: string
          specimen_signature_storage_path: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          email?: string | null
          employer_id: string
          full_name: string
          id?: string
          is_active?: boolean
          phone?: string | null
          position: string
          specimen_signature_storage_path?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          email?: string | null
          employer_id?: string
          full_name?: string
          id?: string
          is_active?: boolean
          phone?: string | null
          position?: string
          specimen_signature_storage_path?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "employer_signatories_employer_id_fkey"
            columns: ["employer_id"]
            isOneToOne: false
            referencedRelation: "employers"
            referencedColumns: ["id"]
          },
        ]
      }
      employers: {
        Row: {
          admin_fee_pct: number
          contact_address: string | null
          contact_email: string | null
          contact_phone: string | null
          created_at: string
          created_by: string | null
          deduction_cutoff_day: number
          deleted_at: string | null
          id: string
          insurance_fee_pct: number
          legal_name: string
          max_debt_ratio_pct: number
          max_tenure_months: number
          monthly_interest_rate: number
          mou_ref: string | null
          mou_signed_date: string | null
          mou_storage_path: string | null
          notes: string | null
          payroll_run_day: number
          registration_no: string | null
          repayment_remittance_day: number
          salary_advance_enabled: boolean
          salary_advance_max_months: number
          settlement_quote_validity_days: number
          slug: string
          status: Database["public"]["Enums"]["entity_status"]
          total_loan_pool_ngwee: number
          tpin: string | null
          trading_name: string | null
          updated_at: string
          used_pool_ngwee: number
        }
        Insert: {
          admin_fee_pct?: number
          contact_address?: string | null
          contact_email?: string | null
          contact_phone?: string | null
          created_at?: string
          created_by?: string | null
          deduction_cutoff_day?: number
          deleted_at?: string | null
          id?: string
          insurance_fee_pct?: number
          legal_name: string
          max_debt_ratio_pct?: number
          max_tenure_months?: number
          monthly_interest_rate?: number
          mou_ref?: string | null
          mou_signed_date?: string | null
          mou_storage_path?: string | null
          notes?: string | null
          payroll_run_day?: number
          registration_no?: string | null
          repayment_remittance_day?: number
          salary_advance_enabled?: boolean
          salary_advance_max_months?: number
          settlement_quote_validity_days?: number
          slug: string
          status?: Database["public"]["Enums"]["entity_status"]
          total_loan_pool_ngwee?: number
          tpin?: string | null
          trading_name?: string | null
          updated_at?: string
          used_pool_ngwee?: number
        }
        Update: {
          admin_fee_pct?: number
          contact_address?: string | null
          contact_email?: string | null
          contact_phone?: string | null
          created_at?: string
          created_by?: string | null
          deduction_cutoff_day?: number
          deleted_at?: string | null
          id?: string
          insurance_fee_pct?: number
          legal_name?: string
          max_debt_ratio_pct?: number
          max_tenure_months?: number
          monthly_interest_rate?: number
          mou_ref?: string | null
          mou_signed_date?: string | null
          mou_storage_path?: string | null
          notes?: string | null
          payroll_run_day?: number
          registration_no?: string | null
          repayment_remittance_day?: number
          salary_advance_enabled?: boolean
          salary_advance_max_months?: number
          settlement_quote_validity_days?: number
          slug?: string
          status?: Database["public"]["Enums"]["entity_status"]
          total_loan_pool_ngwee?: number
          tpin?: string | null
          trading_name?: string | null
          updated_at?: string
          used_pool_ngwee?: number
        }
        Relationships: []
      }
      loan_applications: {
        Row: {
          admin_fee_pct: number
          amount_in_words: string | null
          application_no: string | null
          application_type: Database["public"]["Enums"]["loan_application_type"]
          branch_id: string
          created_at: string
          created_by: string | null
          currency: string
          debt_ratio_pct: number | null
          decision_at: string | null
          decision_reason: string | null
          deleted_at: string | null
          employee_id: string
          employer_id: string
          existing_obligations_ngwee: number
          expires_at: string | null
          id: string
          insurance_fee_pct: number
          mode_of_payment: Database["public"]["Enums"]["mode_of_payment"] | null
          monthly_interest_rate: number
          net_pay_ngwee: number | null
          product: Database["public"]["Enums"]["loan_product"]
          purpose: string | null
          refinanced_from_loan_id: string | null
          refinancing_settlement_method:
            | Database["public"]["Enums"]["refinancing_settlement_method"]
            | null
          requested_amount_ngwee: number
          requested_tenure_months: number
          start_date_preferred: string | null
          started_cse_review_at: string | null
          status: Database["public"]["Enums"]["application_status"]
          submitted_at: string | null
          tier: Database["public"]["Enums"]["approval_tier"] | null
          updated_at: string
        }
        Insert: {
          admin_fee_pct: number
          amount_in_words?: string | null
          application_no?: string | null
          application_type?: Database["public"]["Enums"]["loan_application_type"]
          branch_id: string
          created_at?: string
          created_by?: string | null
          currency?: string
          debt_ratio_pct?: number | null
          decision_at?: string | null
          decision_reason?: string | null
          deleted_at?: string | null
          employee_id: string
          employer_id: string
          existing_obligations_ngwee?: number
          expires_at?: string | null
          id?: string
          insurance_fee_pct: number
          mode_of_payment?:
            | Database["public"]["Enums"]["mode_of_payment"]
            | null
          monthly_interest_rate: number
          net_pay_ngwee?: number | null
          product?: Database["public"]["Enums"]["loan_product"]
          purpose?: string | null
          refinanced_from_loan_id?: string | null
          refinancing_settlement_method?:
            | Database["public"]["Enums"]["refinancing_settlement_method"]
            | null
          requested_amount_ngwee: number
          requested_tenure_months: number
          start_date_preferred?: string | null
          started_cse_review_at?: string | null
          status?: Database["public"]["Enums"]["application_status"]
          submitted_at?: string | null
          tier?: Database["public"]["Enums"]["approval_tier"] | null
          updated_at?: string
        }
        Update: {
          admin_fee_pct?: number
          amount_in_words?: string | null
          application_no?: string | null
          application_type?: Database["public"]["Enums"]["loan_application_type"]
          branch_id?: string
          created_at?: string
          created_by?: string | null
          currency?: string
          debt_ratio_pct?: number | null
          decision_at?: string | null
          decision_reason?: string | null
          deleted_at?: string | null
          employee_id?: string
          employer_id?: string
          existing_obligations_ngwee?: number
          expires_at?: string | null
          id?: string
          insurance_fee_pct?: number
          mode_of_payment?:
            | Database["public"]["Enums"]["mode_of_payment"]
            | null
          monthly_interest_rate?: number
          net_pay_ngwee?: number | null
          product?: Database["public"]["Enums"]["loan_product"]
          purpose?: string | null
          refinanced_from_loan_id?: string | null
          refinancing_settlement_method?:
            | Database["public"]["Enums"]["refinancing_settlement_method"]
            | null
          requested_amount_ngwee?: number
          requested_tenure_months?: number
          start_date_preferred?: string | null
          started_cse_review_at?: string | null
          status?: Database["public"]["Enums"]["application_status"]
          submitted_at?: string | null
          tier?: Database["public"]["Enums"]["approval_tier"] | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "loan_applications_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "loan_applications_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "loan_applications_employer_id_fkey"
            columns: ["employer_id"]
            isOneToOne: false
            referencedRelation: "employers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "loan_applications_refinanced_from_loan_id_fkey"
            columns: ["refinanced_from_loan_id"]
            isOneToOne: false
            referencedRelation: "loans"
            referencedColumns: ["id"]
          },
        ]
      }
      loan_closures: {
        Row: {
          approved_at: string | null
          approved_by: string | null
          checked_at: string | null
          checked_by: string | null
          closure_reason: string | null
          created_at: string
          created_by: string | null
          deleted_at: string | null
          disbursed_at: string | null
          disbursed_by: string | null
          employment_status: Database["public"]["Enums"]["employment_status"]
          id: string
          interest_settled: boolean
          loan_book_updated: boolean
          loan_fully_paid: boolean
          loan_id: string
          no_outstanding_penalties: boolean
          notes: string | null
          updated_at: string
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          checked_at?: string | null
          checked_by?: string | null
          closure_reason?: string | null
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          disbursed_at?: string | null
          disbursed_by?: string | null
          employment_status: Database["public"]["Enums"]["employment_status"]
          id?: string
          interest_settled?: boolean
          loan_book_updated?: boolean
          loan_fully_paid?: boolean
          loan_id: string
          no_outstanding_penalties?: boolean
          notes?: string | null
          updated_at?: string
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          checked_at?: string | null
          checked_by?: string | null
          closure_reason?: string | null
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          disbursed_at?: string | null
          disbursed_by?: string | null
          employment_status?: Database["public"]["Enums"]["employment_status"]
          id?: string
          interest_settled?: boolean
          loan_book_updated?: boolean
          loan_fully_paid?: boolean
          loan_id?: string
          no_outstanding_penalties?: boolean
          notes?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "loan_closures_approved_by_fkey"
            columns: ["approved_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "loan_closures_checked_by_fkey"
            columns: ["checked_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "loan_closures_disbursed_by_fkey"
            columns: ["disbursed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "loan_closures_loan_id_fkey"
            columns: ["loan_id"]
            isOneToOne: true
            referencedRelation: "loans"
            referencedColumns: ["id"]
          },
        ]
      }
      loan_schedule: {
        Row: {
          created_at: string
          deleted_at: string | null
          due_date: string
          id: string
          instalment_no: number
          interest_component_ngwee: number
          loan_id: string
          principal_component_ngwee: number
          scheduled_amount_ngwee: number
          status: Database["public"]["Enums"]["schedule_status"]
          updated_at: string
        }
        Insert: {
          created_at?: string
          deleted_at?: string | null
          due_date: string
          id?: string
          instalment_no: number
          interest_component_ngwee: number
          loan_id: string
          principal_component_ngwee: number
          scheduled_amount_ngwee: number
          status?: Database["public"]["Enums"]["schedule_status"]
          updated_at?: string
        }
        Update: {
          created_at?: string
          deleted_at?: string | null
          due_date?: string
          id?: string
          instalment_no?: number
          interest_component_ngwee?: number
          loan_id?: string
          principal_component_ngwee?: number
          scheduled_amount_ngwee?: number
          status?: Database["public"]["Enums"]["schedule_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "loan_schedule_loan_id_fkey"
            columns: ["loan_id"]
            isOneToOne: false
            referencedRelation: "loans"
            referencedColumns: ["id"]
          },
        ]
      }
      loans: {
        Row: {
          admin_fee_ngwee: number
          application_id: string
          branch_id: string
          created_at: string
          created_by: string | null
          current_outstanding_ngwee: number
          deleted_at: string | null
          disbursed_amount_ngwee: number
          disbursed_at: string | null
          disbursed_by: string | null
          disbursement_authorised_by: string | null
          disbursement_method: string | null
          disbursement_ref: string | null
          employee_id: string
          employer_id: string
          end_date: string
          id: string
          insurance_fee_ngwee: number
          legacy_loan_no: string | null
          loan_no: string | null
          monthly_installment_ngwee: number
          monthly_interest_rate: number
          principal_ngwee: number
          product: Database["public"]["Enums"]["loan_product"]
          start_date: string
          status: Database["public"]["Enums"]["loan_status"]
          tenure_months: number
          total_collectable_ngwee: number
          total_interest_ngwee: number
          updated_at: string
        }
        Insert: {
          admin_fee_ngwee: number
          application_id: string
          branch_id: string
          created_at?: string
          created_by?: string | null
          current_outstanding_ngwee?: number
          deleted_at?: string | null
          disbursed_amount_ngwee: number
          disbursed_at?: string | null
          disbursed_by?: string | null
          disbursement_authorised_by?: string | null
          disbursement_method?: string | null
          disbursement_ref?: string | null
          employee_id: string
          employer_id: string
          end_date: string
          id?: string
          insurance_fee_ngwee: number
          legacy_loan_no?: string | null
          loan_no?: string | null
          monthly_installment_ngwee: number
          monthly_interest_rate: number
          principal_ngwee: number
          product: Database["public"]["Enums"]["loan_product"]
          start_date: string
          status?: Database["public"]["Enums"]["loan_status"]
          tenure_months: number
          total_collectable_ngwee: number
          total_interest_ngwee: number
          updated_at?: string
        }
        Update: {
          admin_fee_ngwee?: number
          application_id?: string
          branch_id?: string
          created_at?: string
          created_by?: string | null
          current_outstanding_ngwee?: number
          deleted_at?: string | null
          disbursed_amount_ngwee?: number
          disbursed_at?: string | null
          disbursed_by?: string | null
          disbursement_authorised_by?: string | null
          disbursement_method?: string | null
          disbursement_ref?: string | null
          employee_id?: string
          employer_id?: string
          end_date?: string
          id?: string
          insurance_fee_ngwee?: number
          legacy_loan_no?: string | null
          loan_no?: string | null
          monthly_installment_ngwee?: number
          monthly_interest_rate?: number
          principal_ngwee?: number
          product?: Database["public"]["Enums"]["loan_product"]
          start_date?: string
          status?: Database["public"]["Enums"]["loan_status"]
          tenure_months?: number
          total_collectable_ngwee?: number
          total_interest_ngwee?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "loans_application_id_fkey"
            columns: ["application_id"]
            isOneToOne: true
            referencedRelation: "loan_applications"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "loans_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "loans_disbursed_by_fkey"
            columns: ["disbursed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "loans_disbursement_authorised_by_fkey"
            columns: ["disbursement_authorised_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "loans_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "loans_employer_id_fkey"
            columns: ["employer_id"]
            isOneToOne: false
            referencedRelation: "employers"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          channel: Database["public"]["Enums"]["notification_channel"]
          created_at: string
          deleted_at: string | null
          error: string | null
          id: string
          payload: Json
          recipient_id: string | null
          sent_at: string | null
          status: Database["public"]["Enums"]["notification_status"]
          template: string
          updated_at: string
        }
        Insert: {
          channel: Database["public"]["Enums"]["notification_channel"]
          created_at?: string
          deleted_at?: string | null
          error?: string | null
          id?: string
          payload?: Json
          recipient_id?: string | null
          sent_at?: string | null
          status?: Database["public"]["Enums"]["notification_status"]
          template: string
          updated_at?: string
        }
        Update: {
          channel?: Database["public"]["Enums"]["notification_channel"]
          created_at?: string
          deleted_at?: string | null
          error?: string | null
          id?: string
          payload?: Json
          recipient_id?: string | null
          sent_at?: string | null
          status?: Database["public"]["Enums"]["notification_status"]
          template?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_recipient_id_fkey"
            columns: ["recipient_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          branch_id: string | null
          created_at: string
          created_by: string | null
          deleted_at: string | null
          email: string | null
          employer_id: string | null
          expo_push_token: string | null
          first_name: string | null
          full_name: string
          home_phone: string | null
          id: string
          is_active: boolean
          last_seen_at: string | null
          mfa_enrolled: boolean
          middle_name: string | null
          next_of_kin_name: string | null
          next_of_kin_phone: string | null
          nrc_no: string | null
          office_phone: string | null
          phone: string | null
          push_token_updated_at: string | null
          role: Database["public"]["Enums"]["user_role"]
          salutation: Database["public"]["Enums"]["salutation"] | null
          source_of_income: string | null
          surname: string | null
          updated_at: string
        }
        Insert: {
          branch_id?: string | null
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          email?: string | null
          employer_id?: string | null
          expo_push_token?: string | null
          first_name?: string | null
          full_name: string
          home_phone?: string | null
          id: string
          is_active?: boolean
          last_seen_at?: string | null
          mfa_enrolled?: boolean
          middle_name?: string | null
          next_of_kin_name?: string | null
          next_of_kin_phone?: string | null
          nrc_no?: string | null
          office_phone?: string | null
          phone?: string | null
          push_token_updated_at?: string | null
          role: Database["public"]["Enums"]["user_role"]
          salutation?: Database["public"]["Enums"]["salutation"] | null
          source_of_income?: string | null
          surname?: string | null
          updated_at?: string
        }
        Update: {
          branch_id?: string | null
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          email?: string | null
          employer_id?: string | null
          expo_push_token?: string | null
          first_name?: string | null
          full_name?: string
          home_phone?: string | null
          id?: string
          is_active?: boolean
          last_seen_at?: string | null
          mfa_enrolled?: boolean
          middle_name?: string | null
          next_of_kin_name?: string | null
          next_of_kin_phone?: string | null
          nrc_no?: string | null
          office_phone?: string | null
          phone?: string | null
          push_token_updated_at?: string | null
          role?: Database["public"]["Enums"]["user_role"]
          salutation?: Database["public"]["Enums"]["salutation"] | null
          source_of_income?: string | null
          surname?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profiles_employer_id_fkey"
            columns: ["employer_id"]
            isOneToOne: false
            referencedRelation: "employers"
            referencedColumns: ["id"]
          },
        ]
      }
      remittance_batches: {
        Row: {
          created_at: string
          created_by: string | null
          deleted_at: string | null
          employee_count: number
          employer_id: string
          id: string
          notes: string | null
          period_month: number
          period_year: number
          received_at: string | null
          reconciled_at: string | null
          reconciled_by: string | null
          remittance_pdf_path: string | null
          schedule_pdf_path: string | null
          sent_at: string | null
          status: Database["public"]["Enums"]["remittance_status"]
          total_amount_ngwee: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          employee_count?: number
          employer_id: string
          id?: string
          notes?: string | null
          period_month: number
          period_year: number
          received_at?: string | null
          reconciled_at?: string | null
          reconciled_by?: string | null
          remittance_pdf_path?: string | null
          schedule_pdf_path?: string | null
          sent_at?: string | null
          status?: Database["public"]["Enums"]["remittance_status"]
          total_amount_ngwee?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          employee_count?: number
          employer_id?: string
          id?: string
          notes?: string | null
          period_month?: number
          period_year?: number
          received_at?: string | null
          reconciled_at?: string | null
          reconciled_by?: string | null
          remittance_pdf_path?: string | null
          schedule_pdf_path?: string | null
          sent_at?: string | null
          status?: Database["public"]["Enums"]["remittance_status"]
          total_amount_ngwee?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "remittance_batches_employer_id_fkey"
            columns: ["employer_id"]
            isOneToOne: false
            referencedRelation: "employers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "remittance_batches_reconciled_by_fkey"
            columns: ["reconciled_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      repayments: {
        Row: {
          amount_ngwee: number
          bank_reference: string | null
          captured_by: string | null
          created_at: string
          created_by: string | null
          deduction_period_month: number | null
          deduction_period_year: number | null
          deleted_at: string | null
          employer_id: string
          evidence_path: string | null
          id: string
          loan_id: string
          notes: string | null
          payment_date: string
          remittance_batch_id: string | null
          schedule_id: string | null
          updated_at: string
        }
        Insert: {
          amount_ngwee: number
          bank_reference?: string | null
          captured_by?: string | null
          created_at?: string
          created_by?: string | null
          deduction_period_month?: number | null
          deduction_period_year?: number | null
          deleted_at?: string | null
          employer_id: string
          evidence_path?: string | null
          id?: string
          loan_id: string
          notes?: string | null
          payment_date: string
          remittance_batch_id?: string | null
          schedule_id?: string | null
          updated_at?: string
        }
        Update: {
          amount_ngwee?: number
          bank_reference?: string | null
          captured_by?: string | null
          created_at?: string
          created_by?: string | null
          deduction_period_month?: number | null
          deduction_period_year?: number | null
          deleted_at?: string | null
          employer_id?: string
          evidence_path?: string | null
          id?: string
          loan_id?: string
          notes?: string | null
          payment_date?: string
          remittance_batch_id?: string | null
          schedule_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "repayments_captured_by_fkey"
            columns: ["captured_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "repayments_employer_id_fkey"
            columns: ["employer_id"]
            isOneToOne: false
            referencedRelation: "employers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "repayments_loan_id_fkey"
            columns: ["loan_id"]
            isOneToOne: false
            referencedRelation: "loans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "repayments_remittance_batch_id_fkey"
            columns: ["remittance_batch_id"]
            isOneToOne: false
            referencedRelation: "remittance_batches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "repayments_schedule_id_fkey"
            columns: ["schedule_id"]
            isOneToOne: false
            referencedRelation: "loan_schedule"
            referencedColumns: ["id"]
          },
        ]
      }
      sms_log: {
        Row: {
          application_id: string | null
          body: string
          contract_id: string | null
          created_at: string
          deleted_at: string | null
          id: string
          loan_id: string | null
          sent_at: string | null
          status: string
          to_phone: string
          twilio_sid: string | null
          updated_at: string
        }
        Insert: {
          application_id?: string | null
          body: string
          contract_id?: string | null
          created_at?: string
          deleted_at?: string | null
          id?: string
          loan_id?: string | null
          sent_at?: string | null
          status?: string
          to_phone: string
          twilio_sid?: string | null
          updated_at?: string
        }
        Update: {
          application_id?: string | null
          body?: string
          contract_id?: string | null
          created_at?: string
          deleted_at?: string | null
          id?: string
          loan_id?: string | null
          sent_at?: string | null
          status?: string
          to_phone?: string
          twilio_sid?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "sms_log_application_id_fkey"
            columns: ["application_id"]
            isOneToOne: false
            referencedRelation: "loan_applications"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sms_log_contract_id_fkey"
            columns: ["contract_id"]
            isOneToOne: false
            referencedRelation: "contracts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sms_log_loan_id_fkey"
            columns: ["loan_id"]
            isOneToOne: false
            referencedRelation: "loans"
            referencedColumns: ["id"]
          },
        ]
      }
      tax_settings: {
        Row: {
          created_at: string
          created_by: string | null
          deleted_at: string | null
          effective_from: string
          effective_to: string | null
          id: string
          napsa_ceiling_ngwee: number
          napsa_rate: number
          nhima_basis: string
          nhima_rate: number
          notes: string | null
          paye_bands: Json
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          effective_from: string
          effective_to?: string | null
          id?: string
          napsa_ceiling_ngwee?: number
          napsa_rate?: number
          nhima_basis?: string
          nhima_rate?: number
          notes?: string | null
          paye_bands: Json
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          effective_from?: string
          effective_to?: string | null
          id?: string
          napsa_ceiling_ngwee?: number
          napsa_rate?: number
          nhima_basis?: string
          nhima_rate?: number
          notes?: string | null
          paye_bands?: Json
          updated_at?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      advance_to_cse_review: {
        Args: { p_application_id: string }
        Returns: undefined
      }
      branch_loan_seq_name: { Args: { branch_code: string }; Returns: string }
      close_loan: {
        Args: {
          p_closure_reason: string
          p_force_write_off?: boolean
          p_loan_id: string
        }
        Returns: string
      }
      create_loan_from_application: {
        Args: { p_application_id: string }
        Returns: string
      }
      current_user_branch: { Args: never; Returns: string }
      current_user_employer: { Args: never; Returns: string }
      current_user_role: {
        Args: never
        Returns: Database["public"]["Enums"]["user_role"]
      }
      ensure_branch_loan_seq: {
        Args: { branch_code: string }
        Returns: undefined
      }
      generate_loan_schedule: {
        Args: { p_loan_id: string }
        Returns: undefined
      }
      generate_remittance_batch: {
        Args: { p_employer_id: string; p_month: number; p_year: number }
        Returns: string
      }
      has_role: {
        Args: { roles: Database["public"]["Enums"]["user_role"][] }
        Returns: boolean
      }
      is_auditor: { Args: never; Returns: boolean }
      is_master_admin: { Args: never; Returns: boolean }
      is_richmond_staff: { Args: never; Returns: boolean }
      mark_remittance_received: {
        Args: {
          p_bank_ref: string
          p_batch_id: string
          p_received_amount_ngwee: number
        }
        Returns: undefined
      }
      mark_remittance_sent: { Args: { p_batch_id: string }; Returns: undefined }
      next_application_no: { Args: { branch_code: string }; Returns: string }
      next_loan_no:
        | { Args: never; Returns: string }
        | { Args: { branch_code: string }; Returns: string }
      next_pre_approval_serial: { Args: never; Returns: string }
      notify: {
        Args: {
          p_channels?: Database["public"]["Enums"]["notification_channel"][]
          p_payload: Json
          p_recipient: string
          p_template: string
        }
        Returns: undefined
      }
      recompute_arrears: { Args: never; Returns: number }
      record_approval: {
        Args: {
          p_application_id: string
          p_decision: Database["public"]["Enums"]["approval_decision"]
          p_notes?: string
          p_tier: Database["public"]["Enums"]["approval_tier"]
        }
        Returns: string
      }
      record_disbursement: {
        Args: {
          p_authorised_by: string
          p_loan_id: string
          p_method: string
          p_reference: string
        }
        Returns: undefined
      }
      record_due_diligence_signoff: {
        Args: { p_application_id: string; p_role_key: string }
        Returns: undefined
      }
      record_repayment: {
        Args: {
          p_amount_ngwee: number
          p_bank_reference: string
          p_loan_id: string
          p_payment_date: string
          p_remittance_batch_id?: string
          p_schedule_id: string
        }
        Returns: string
      }
      register_push_token: { Args: { p_token: string }; Returns: undefined }
      seed_due_diligence: {
        Args: { p_application_id: string }
        Returns: undefined
      }
      settle_refinanced_source: {
        Args: {
          p_application_id: string
          p_bank_ref: string
          p_buyout_ngwee: number
        }
        Returns: string
      }
      sign_contract: {
        Args: {
          p_authentication_evidence: Json
          p_authentication_method: string
          p_consent_text: string
          p_contract_id: string
          p_device_fingerprint: string
          p_geolocation: Json
          p_ip: unknown
          p_nrc_knowledge_check_passed: boolean
          p_signatory_role: Database["public"]["Enums"]["contract_signatory_role"]
          p_signature_drawn_points: Json
          p_signature_image_path: string
          p_signature_typed_name: string
          p_user_agent: string
        }
        Returns: string
      }
      verify_contract: {
        Args: { p_contract_id: string }
        Returns: Json
      }
      write_audit: {
        Args: {
          p_action: string
          p_after: Json
          p_before: Json
          p_entity_id: string
          p_entity_type: string
        }
        Returns: undefined
      }
    }
    Enums: {
      application_status:
        | "draft"
        | "submitted"
        | "employer_review"
        | "employer_confirmed"
        | "cse_review"
        | "l1_pending"
        | "l2_pending"
        | "l3_pending"
        | "approved"
        | "rejected"
        | "expired"
        | "withdrawn"
      approval_decision: "approve" | "reject" | "request_info"
      approval_tier: "l1" | "l2" | "l3"
      contract_audit_event_type:
        | "created"
        | "sent"
        | "viewed"
        | "downloaded"
        | "consent_given"
        | "otp_requested"
        | "otp_verified"
        | "otp_failed"
        | "nrc_check_passed"
        | "nrc_check_failed"
        | "signed"
        | "declined"
        | "voided"
        | "completed"
        | "sealed"
        | "evidence_exported"
      contract_signatory_role:
        | "borrower"
        | "employer_signatory"
        | "richmond_witness"
        | "cfo"
      contract_status:
        | "draft"
        | "sent"
        | "partially_signed"
        | "fully_signed"
        | "sealed"
        | "voided"
        | "expired"
      contract_type:
        | "pre_approval"
        | "offer_letter"
        | "loan_agreement"
        | "employee_authorisation"
        | "settlement_acknowledgement"
        | "top_up_addendum"
      document_type:
        | "nrc_front"
        | "nrc_back"
        | "photo"
        | "employment_contract"
        | "payslip_1"
        | "payslip_2"
        | "payslip_3"
        | "bank_proof"
        | "residence_proof"
        | "mou"
        | "pop"
        | "specimen_signature"
        | "other"
      employment_status:
        | "permanent"
        | "contract"
        | "temporal"
        | "suspension"
        | "terminated"
      entity_status: "active" | "suspended" | "archived"
      loan_application_type: "new_loan" | "refinancing"
      loan_product: "payroll_loan" | "salary_advance" | "top_up"
      loan_status:
        | "pending_disbursement"
        | "active"
        | "in_arrears"
        | "settled"
        | "written_off"
        | "voided"
      mode_of_payment:
        | "bank_transfer"
        | "standing_order"
        | "mobile_money"
        | "employer_internal"
      notification_channel: "sms" | "push" | "email" | "in_app"
      notification_status: "queued" | "sent" | "delivered" | "failed"
      refinancing_settlement_method: "buyout" | "self_payment"
      remittance_status:
        | "draft"
        | "sent"
        | "partially_received"
        | "fully_received"
        | "reconciled"
      salutation: "mr" | "mrs" | "miss" | "dr" | "other"
      schedule_status:
        | "scheduled"
        | "deducted"
        | "remitted"
        | "partial"
        | "missed"
      user_role:
        | "master_admin"
        | "branch_manager"
        | "cse"
        | "approver_l1"
        | "approver_l2"
        | "accounts"
        | "cfo"
        | "auditor"
        | "employer_admin"
        | "employer_signatory"
        | "employee"
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
    Enums: {
      application_status: [
        "draft",
        "submitted",
        "employer_review",
        "employer_confirmed",
        "cse_review",
        "l1_pending",
        "l2_pending",
        "l3_pending",
        "approved",
        "rejected",
        "expired",
        "withdrawn",
      ],
      approval_decision: ["approve", "reject", "request_info"],
      approval_tier: ["l1", "l2", "l3"],
      contract_audit_event_type: [
        "created",
        "sent",
        "viewed",
        "downloaded",
        "consent_given",
        "otp_requested",
        "otp_verified",
        "otp_failed",
        "nrc_check_passed",
        "nrc_check_failed",
        "signed",
        "declined",
        "voided",
        "completed",
        "sealed",
        "evidence_exported",
      ],
      contract_signatory_role: [
        "borrower",
        "employer_signatory",
        "richmond_witness",
        "cfo",
      ],
      contract_status: [
        "draft",
        "sent",
        "partially_signed",
        "fully_signed",
        "sealed",
        "voided",
        "expired",
      ],
      contract_type: [
        "pre_approval",
        "offer_letter",
        "loan_agreement",
        "employee_authorisation",
        "settlement_acknowledgement",
        "top_up_addendum",
      ],
      document_type: [
        "nrc_front",
        "nrc_back",
        "photo",
        "employment_contract",
        "payslip_1",
        "payslip_2",
        "payslip_3",
        "bank_proof",
        "residence_proof",
        "mou",
        "pop",
        "specimen_signature",
        "other",
      ],
      employment_status: [
        "permanent",
        "contract",
        "temporal",
        "suspension",
        "terminated",
      ],
      entity_status: ["active", "suspended", "archived"],
      loan_application_type: ["new_loan", "refinancing"],
      loan_product: ["payroll_loan", "salary_advance", "top_up"],
      loan_status: [
        "pending_disbursement",
        "active",
        "in_arrears",
        "settled",
        "written_off",
        "voided",
      ],
      mode_of_payment: [
        "bank_transfer",
        "standing_order",
        "mobile_money",
        "employer_internal",
      ],
      notification_channel: ["sms", "push", "email", "in_app"],
      notification_status: ["queued", "sent", "delivered", "failed"],
      refinancing_settlement_method: ["buyout", "self_payment"],
      remittance_status: [
        "draft",
        "sent",
        "partially_received",
        "fully_received",
        "reconciled",
      ],
      salutation: ["mr", "mrs", "miss", "dr", "other"],
      schedule_status: [
        "scheduled",
        "deducted",
        "remitted",
        "partial",
        "missed",
      ],
      user_role: [
        "master_admin",
        "branch_manager",
        "cse",
        "approver_l1",
        "approver_l2",
        "accounts",
        "cfo",
        "auditor",
        "employer_admin",
        "employer_signatory",
        "employee",
      ],
    },
  },
} as const
