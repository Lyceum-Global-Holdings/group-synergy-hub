import { supabase } from "@/integrations/supabase/client";
import { SupplierRegistrationRequest } from "@/types/supplierRegistration";

export class ApprovalWorkflowEngine {
  /**
   * Determine which approval stages are required for a registration
   */
  async determineRequiredStages(
    registration: SupplierRegistrationRequest,
    companyId: string
  ): Promise<number[]> {
    // Get all stages for the company
    const { data: stages } = await supabase
      .from('approval_stages')
      .select('stage_order, required')
      .eq('company_id', companyId)
      .eq('required', true)
      .order('stage_order', { ascending: true });

    if (!stages) return [1, 2];

    // Check for routing rules
    const { data: rules } = await supabase
      .from('approval_routing_rules')
      .select('*')
      .eq('company_id', companyId);

    // Apply routing rules based on registration data
    if (rules && rules.length > 0) {
      for (const rule of rules) {
        if (this.evaluateCondition(registration, rule)) {
          return rule.required_stages || stages.map(s => s.stage_order);
        }
      }
    }

    // Default: return all required stages
    return stages.map(s => s.stage_order);
  }

  /**
   * Evaluate a routing rule condition
   */
  private evaluateCondition(
    registration: SupplierRegistrationRequest,
    rule: any
  ): boolean {
    const { condition_field, condition_operator, condition_value } = rule;
    
    if (!condition_field || !condition_operator) return false;

    const fieldValue = this.getFieldValue(registration, condition_field);
    
    switch (condition_operator) {
      case 'equals':
        return fieldValue === condition_value;
      case 'greater_than':
        return Number(fieldValue) > Number(condition_value);
      case 'less_than':
        return Number(fieldValue) < Number(condition_value);
      case 'contains':
        return String(fieldValue).toLowerCase().includes(String(condition_value).toLowerCase());
      default:
        return false;
    }
  }

  /**
   * Get field value from registration data
   */
  private getFieldValue(registration: SupplierRegistrationRequest, field: string): any {
    if (field === 'request_type') return registration.request_type;
    if (field.startsWith('supplier_data.')) {
      const path = field.replace('supplier_data.', '');
      return this.getNestedValue(registration.supplier_data, path);
    }
    return null;
  }

  /**
   * Get nested value from object
   */
  private getNestedValue(obj: any, path: string): any {
    return path.split('.').reduce((curr, key) => curr?.[key], obj);
  }

  /**
   * Assign approvers to a stage
   */
  async assignApprovers(
    registrationId: string,
    stageOrder: number,
    companyId: string
  ): Promise<string[]> {
    // Get approver assignments for this stage
    const { data: assignments } = await supabase
      .from('approver_assignments')
      .select('user_id, is_backup')
      .eq('company_id', companyId)
      .eq('stage_order', stageOrder)
      .eq('is_backup', false)
      .order('created_at', { ascending: true });

    if (!assignments || assignments.length === 0) {
      // No specific assignments, try to find users with required role
      const { data: stage } = await supabase
        .from('approval_stages')
        .select('required_role')
        .eq('company_id', companyId)
        .eq('stage_order', stageOrder)
        .single();

      if (stage?.required_role) {
        const { data: users } = await supabase
          .from('user_roles')
          .select('user_id, roles!inner(name)')
          .eq('roles.name', stage.required_role);

        return users?.map(u => u.user_id) || [];
      }

      return [];
    }

    return assignments.map(a => a.user_id);
  }

  /**
   * Create workflow entry and assign to first stage
   */
  async initializeWorkflow(
    registrationId: string,
    companyId: string
  ): Promise<void> {
    const { data: registration } = await supabase
      .from('supplier_registration_requests')
      .select('*')
      .eq('id', registrationId)
      .single();

    if (!registration) throw new Error('Registration not found');

    const requiredStages = await this.determineRequiredStages(registration, companyId);
    const firstStage = requiredStages[0] || 1;

    // Get stage info
    const { data: stageInfo } = await supabase
      .from('approval_stages')
      .select('stage_name')
      .eq('company_id', companyId)
      .eq('stage_order', firstStage)
      .single();

    // Assign approvers
    const approvers = await this.assignApprovers(registrationId, firstStage, companyId);
    const assignedTo = approvers[0] || null;

    // Create workflow entry
    await supabase
      .from('supplier_approval_workflow')
      .insert({
        registration_request_id: registrationId,
        stage: stageInfo?.stage_name || `stage_${firstStage}`,
        stage_order: firstStage,
        status: 'pending',
        assigned_to: assignedTo,
        notified_at: new Date().toISOString(),
      });

    // Send notification if approver assigned
    if (assignedTo) {
      await this.sendNotification(registrationId, assignedTo, firstStage, companyId);
    }
  }

  /**
   * Move to next stage after approval
   */
  async moveToNextStage(
    registrationId: string,
    currentStageOrder: number,
    companyId: string
  ): Promise<void> {
    const { data: registration } = await supabase
      .from('supplier_registration_requests')
      .select('*')
      .eq('id', registrationId)
      .single();

    if (!registration) throw new Error('Registration not found');

    const requiredStages = await this.determineRequiredStages(registration, companyId);
    const currentIndex = requiredStages.indexOf(currentStageOrder);
    
    if (currentIndex === -1 || currentIndex === requiredStages.length - 1) {
      // No more stages, mark as approved and create supplier
      await this.completeApproval(registrationId, companyId);
      return;
    }

    const nextStage = requiredStages[currentIndex + 1];

    // Get stage info
    const { data: stageInfo } = await supabase
      .from('approval_stages')
      .select('stage_name')
      .eq('company_id', companyId)
      .eq('stage_order', nextStage)
      .single();

    // Assign approvers
    const approvers = await this.assignApprovers(registrationId, nextStage, companyId);
    const assignedTo = approvers[0] || null;

    // Create next workflow entry
    await supabase
      .from('supplier_approval_workflow')
      .insert({
        registration_request_id: registrationId,
        stage: stageInfo?.stage_name || `stage_${nextStage}`,
        stage_order: nextStage,
        status: 'pending',
        assigned_to: assignedTo,
        notified_at: new Date().toISOString(),
      });

    // Send notification
    if (assignedTo) {
      await this.sendNotification(registrationId, assignedTo, nextStage, companyId);
    }
  }

  /**
   * Complete the approval process
   */
  private async completeApproval(registrationId: string, companyId: string): Promise<void> {
    const { data: { user } } = await supabase.auth.getUser();

    // Get registration data
    const { data: registration } = await supabase
      .from('supplier_registration_requests')
      .select('*')
      .eq('id', registrationId)
      .single();

    if (!registration) throw new Error('Registration not found');

    // Create supplier record from registration data
    const supplierData = typeof registration.supplier_data === 'object' ? registration.supplier_data as any : {};
    const newSupplier = {
      name: supplierData.name || '',
      email: supplierData.email || '',
      phone: supplierData.phone || '',
      tax_id: supplierData.tax_id || '',
      company_id: companyId,
      status: 'active',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    const { data: supplier, error: supplierError } = await supabase
      .from('suppliers')
      .insert(newSupplier)
      .select()
      .single();

    if (supplierError) throw supplierError;

    // Update registration status
    await supabase
      .from('supplier_registration_requests')
      .update({
        status: 'approved',
        reviewed_by: user?.id,
        reviewed_at: new Date().toISOString(),
      })
      .eq('id', registrationId);
  }

  /**
   * Send notification to approver
   */
  private async sendNotification(
    registrationId: string,
    approverId: string,
    stageOrder: number,
    companyId: string
  ): Promise<void> {
    // Get approver details
    const { data: profile } = await supabase
      .from('profiles')
      .select('email, full_name')
      .eq('user_id', approverId)
      .single();

    if (!profile?.email) return;

    // Get registration details
    const { data: registration } = await supabase
      .from('supplier_registration_requests')
      .select('supplier_data')
      .eq('id', registrationId)
      .single();

    // Get stage name
    const { data: stage } = await supabase
      .from('approval_stages')
      .select('stage_name')
      .eq('company_id', companyId)
      .eq('stage_order', stageOrder)
      .single();

    const supplierData = typeof registration?.supplier_data === 'object' ? registration.supplier_data as any : {};
    const supplierName = supplierData?.name || 'Unknown Supplier';
    const stageName = stage?.stage_name || `Stage ${stageOrder}`;

    // Call edge function to send email
    try {
      await supabase.functions.invoke('send-approval-notification', {
        body: {
          approver_email: profile.email,
          approver_name: profile.full_name,
          supplier_name: supplierName,
          registration_id: registrationId,
          stage_name: stageName,
          notification_type: 'assigned',
        },
      });
    } catch (error) {
      console.error('Failed to send notification:', error);
    }
  }
}
