'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  Plus,
  Shield,
  Users,
  X,
  ShieldAlert,
  Check,
  UserCheck,
  UserX,
} from 'lucide-react';
import { AdminShell } from '@/components/admin/AdminShell';
import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import { Field, Input, FieldError } from '@/components/ui/input';
import { Badge, Card, CenteredSpinner } from '@/components/ui/primitives';
import { api, apiErrorMessage } from '@/lib/api';
import { useAuthStore } from '@/stores/auth';
import { useAdminKitchens } from '@/hooks/useAdminKitchens';

// ── Permissions list ────────────────────────────────────────────────────────────

const PERMISSIONS = [
  { value: 'menu:manage', label: 'Menu Management', desc: 'Create, update, delete menu items and stock' },
  { value: 'order:view', label: 'Order View', desc: 'View live order feeds & details' },
  { value: 'order:update_status', label: 'Update Order Status', desc: 'Accept, prepare, and mark orders ready' },
  { value: 'order:cancel', label: 'Cancel Order', desc: 'Cancel orders and item quantities' },
  { value: 'order:refund', label: 'Process Refund', desc: 'Approve or reject refund requests' },
  { value: 'order:note', label: 'Internal Notes', desc: 'Add private logs and chef notes to orders' },
  { value: 'coupon:manage', label: 'Coupon Management', desc: 'Manage discount codes and limits' },
  { value: 'room:manage', label: 'Room & QR Manage', desc: 'Create hotel rooms and rotate scan QRs' },
  { value: 'kitchen:manage', label: 'Kitchen Settings', desc: 'Toggle operating hours and charge limits' },
  { value: 'analytics:view', label: 'Analytics View', desc: 'Access revenue reports and summaries' },
  { value: 'staff:manage', label: 'Staff Management', desc: 'Add workers and define permission roles' },
];

// ── Validation schemas ─────────────────────────────────────────────────────────

const roleSchema = z.object({
  name: z.string().trim().min(1, 'Role name required').max(60),
  description: z.string().trim().max(300).optional(),
  permissions: z.array(z.string()).min(1, 'Select at least one permission'),
});

const staffSchema = z.object({
  name: z.string().trim().min(1, 'Full name required'),
  email: z.string().trim().email('Valid email required'),
  password: z.string().min(8, 'Password must be 8+ characters'),
  roleId: z.string().optional().or(z.literal('')),
  designation: z.string().trim().max(80).optional(),
  employeeId: z.string().trim().optional(),
  kitchenId: z.string().optional().or(z.literal('')),
});

const editStaffSchema = z.object({
  roleId: z.string().optional().or(z.literal('')),
  designation: z.string().trim().max(80).optional(),
  employeeId: z.string().trim().optional(),
  status: z.enum(['ACTIVE', 'SUSPENDED', 'TERMINATED']),
});

// ── Types ──────────────────────────────────────────────────────────────────────

interface Role {
  _id: string;
  name: string;
  description?: string;
  permissions: string[];
  isSystem: boolean;
}

interface StaffMember {
  _id: string;
  user: {
    _id: string;
    name: string;
    email: string;
    phone?: string;
    isActive: boolean;
    lastLoginAt?: string;
  };
  kitchen: string;
  role?: {
    _id: string;
    name: string;
    permissions: string[];
  };
  employeeId?: string;
  designation?: string;
  status: 'ACTIVE' | 'SUSPENDED' | 'TERMINATED';
  createdAt: string;
}

type RoleForm = z.infer<typeof roleSchema>;
type StaffForm = z.infer<typeof staffSchema>;
type EditStaffForm = z.infer<typeof editStaffSchema>;

// ── Main Page Component ────────────────────────────────────────────────────────

export default function StaffManagementPage() {
  const qc = useQueryClient();
  const user = useAuthStore(s => s.user);
  const status = useAuthStore(s => s.status);

  const [activeTab, setActiveTab] = useState<'staff' | 'roles'>('staff');
  const [showCreateRole, setShowCreateRole] = useState(false);
  const [showCreateStaff, setShowCreateStaff] = useState(false);
  const [editStaffTarget, setEditStaffTarget] = useState<StaffMember | null>(null);
  const [kitchenIdFilter, setKitchenIdFilter] = useState('');
  const [error, setError] = useState('');

  // Fetch kitchens (for selection when creating staff/roles)
  const { data: kitchens } = useAdminKitchens();

  // Fetch Roles
  const { data: rolesData, isLoading: loadingRoles } = useQuery<{ data: { roles: Role[] } }>({
    queryKey: ['staff-roles', kitchenIdFilter],
    queryFn: () => {
      const q = kitchenIdFilter ? `?kitchenId=${kitchenIdFilter}` : '';
      return api.get(`/staff/roles${q}`).then(r => r.data);
    },
    enabled: status === 'authenticated',
  });
  const roles = rolesData?.data?.roles ?? [];

  // Fetch Staff
  const { data: staffData, isLoading: loadingStaff } = useQuery<{ data: { staff: StaffMember[] } }>({
    queryKey: ['staff-members', kitchenIdFilter],
    queryFn: () => {
      const q = kitchenIdFilter ? `?kitchenId=${kitchenIdFilter}` : '';
      return api.get(`/staff${q}`).then(r => r.data);
    },
    enabled: status === 'authenticated',
  });
  const staff = staffData?.data?.staff ?? [];

  // Mutations
  const createRoleMutation = useMutation({
    mutationFn: (d: any) => api.post('/staff/roles', { ...d, kitchenId: kitchenIdFilter || undefined }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['staff-roles'] }); setShowCreateRole(false); },
    onError: e => setError(apiErrorMessage(e)),
  });

  const deleteRoleMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/staff/roles/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['staff-roles'] }),
    onError: e => setError(apiErrorMessage(e)),
  });

  const createStaffMutation = useMutation({
    mutationFn: (d: any) => api.post('/staff', { ...d, kitchenId: d.kitchenId || kitchenIdFilter || undefined }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['staff-members'] }); setShowCreateStaff(false); },
    onError: e => setError(apiErrorMessage(e)),
  });

  const editStaffMutation = useMutation({
    mutationFn: ({ id, d }: { id: string; d: any }) => api.patch(`/staff/${id}`, d),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['staff-members'] }); setEditStaffTarget(null); },
    onError: e => setError(apiErrorMessage(e)),
  });

  // Forms
  const { register: regRole, handleSubmit: handleRole, setValue: setRoleVal, watch: watchRole, formState: { errors: roleErrors }, reset: resetRole } = useForm<RoleForm>({
    resolver: zodResolver(roleSchema),
    defaultValues: { permissions: [] },
  });

  const { register: regStaff, handleSubmit: handleStaff, formState: { errors: staffErrors }, reset: resetStaff } = useForm<StaffForm>({
    resolver: zodResolver(staffSchema),
  });

  const { register: regEditStaff, handleSubmit: handleEditStaff, formState: { errors: editStaffErrors }, reset: resetEditStaff } = useForm<EditStaffForm>({
    resolver: zodResolver(editStaffSchema),
  });

  const selectedPermissions = watchRole('permissions') || [];
  const togglePermission = (val: string) => {
    const next = selectedPermissions.includes(val)
      ? selectedPermissions.filter((p: string) => p !== val)
      : [...selectedPermissions, val];
    setRoleVal('permissions', next, { shouldValidate: true });
  };

  return (
    <AdminShell>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <h1 className="text-2xl font-bold text-zinc-900 font-sans">Staff & Permissions</h1>
            <p className="text-sm text-zinc-500 mt-0.5 font-sans">Manage custom RBAC roles and provision worker logins</p>
          </div>
          <div className="flex items-center gap-3">
            {user?.role === 'SUPER_ADMIN' && (
              <select
                className="h-10 rounded-lg border border-zinc-200 bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-brand font-sans"
                value={kitchenIdFilter}
                onChange={e => setKitchenIdFilter(e.target.value)}
              >
                <option value="">All Kitchens</option>
                {kitchens?.map(k => (
                  <option key={k._id} value={k._id}>{k.name}</option>
                ))}
              </select>
            )}
            {activeTab === 'staff' ? (
              <Button size="sm" onClick={() => { resetStaff(); setShowCreateStaff(true); }}>
                <Plus className="h-4 w-4 mr-1.5" /> Add Staff
              </Button>
            ) : (
              <Button size="sm" onClick={() => { resetRole(); setShowCreateRole(true); }}>
                <Plus className="h-4 w-4 mr-1.5" /> Create Role
              </Button>
            )}
          </div>
        </div>

        {error && (
          <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700 flex items-center justify-between font-sans">
            {error}
            <button onClick={() => setError('')}><X className="h-4 w-4" /></button>
          </div>
        )}

        {/* Tabs */}
        <div className="border-b flex gap-4">
          <button
            onClick={() => setActiveTab('staff')}
            className={`pb-2.5 text-sm font-semibold border-b-2 transition-all ${
              activeTab === 'staff' ? 'border-brand text-brand' : 'border-transparent text-zinc-500 hover:text-zinc-800'
            }`}
          >
            Staff Members
          </button>
          <button
            onClick={() => setActiveTab('roles')}
            className={`pb-2.5 text-sm font-semibold border-b-2 transition-all ${
              activeTab === 'roles' ? 'border-brand text-brand' : 'border-transparent text-zinc-500 hover:text-zinc-800'
            }`}
          >
            Custom Roles
          </button>
        </div>

        {/* Tab content */}
        {activeTab === 'staff' ? (
          loadingStaff ? (
            <CenteredSpinner />
          ) : staff.length === 0 ? (
            <Card className="py-16 text-center">
              <Users className="mx-auto h-10 w-10 text-zinc-300 mb-3" />
              <p className="text-zinc-500 font-medium font-sans">No staff members found</p>
              <Button className="mt-4" size="sm" onClick={() => { resetStaff(); setShowCreateStaff(true); }}>
                Add Staff Member
              </Button>
            </Card>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {staff.map(member => (
                <Card key={member._id} className="p-4 flex flex-col justify-between hover:shadow-md transition-all">
                  <div>
                    <div className="flex items-start justify-between">
                      <div>
                        <h3 className="font-bold text-zinc-955 text-base font-sans">{member.user.name}</h3>
                        <p className="text-xs text-zinc-400 font-sans">{member.designation || 'Staff'} · {member.employeeId || 'No Emp ID'}</p>
                      </div>
                      <Badge className={
                        member.status === 'ACTIVE'
                          ? 'bg-green-50 text-green-700 border-green-200'
                          : 'bg-red-50 text-red-700 border-red-200'
                      }>
                        {member.status}
                      </Badge>
                    </div>

                    <div className="mt-3 text-xs text-zinc-500 space-y-1 font-sans">
                      <p>Email: <strong>{member.user.email}</strong></p>
                      <p>Role: <strong>{member.role?.name ?? 'Custom Permissions'}</strong></p>
                      {member.user.lastLoginAt && (
                        <p>Last login: {new Date(member.user.lastLoginAt).toLocaleString()}</p>
                      )}
                    </div>
                  </div>

                  <div className="mt-4 pt-3 border-t flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      className="w-full font-sans"
                      onClick={() => {
                        resetEditStaff({
                          roleId: member.role?._id ?? '',
                          designation: member.designation ?? '',
                          employeeId: member.employeeId ?? '',
                          status: member.status,
                        });
                        setEditStaffTarget(member);
                      }}
                    >
                      Edit details
                    </Button>
                  </div>
                </Card>
              ))}
            </div>
          )
        ) : (
          loadingRoles ? (
            <CenteredSpinner />
          ) : roles.length === 0 ? (
            <Card className="py-16 text-center">
              <Shield className="mx-auto h-10 w-10 text-zinc-300 mb-3" />
              <p className="text-zinc-500 font-medium font-sans">No custom roles defined</p>
            </Card>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {roles.map(role => (
                <Card key={role._id} className="p-4 flex flex-col justify-between hover:shadow-md transition-all">
                  <div>
                    <div className="flex items-start justify-between">
                      <h3 className="font-bold text-zinc-950 text-base font-sans">{role.name}</h3>
                      {role.isSystem && (
                        <Badge className="bg-zinc-100 text-zinc-600">System</Badge>
                      )}
                    </div>
                    {role.description && (
                      <p className="text-xs text-zinc-400 mt-1 font-sans">{role.description}</p>
                    )}

                    <div className="mt-4 flex flex-wrap gap-1">
                      {role.permissions.map(p => (
                        <Badge key={p} className="bg-brand/5 text-brand text-[10px] font-mono border-brand/10">
                          {p}
                        </Badge>
                      ))}
                    </div>
                  </div>

                  {!role.isSystem && (
                    <div className="mt-4 pt-3 border-t">
                      <Button
                        variant="outline"
                        size="sm"
                        className="w-full text-red-600 hover:bg-red-50 border-red-200 font-sans"
                        onClick={() => {
                          if (confirm(`Delete custom role "${role.name}"?`)) {
                            deleteRoleMutation.mutate(role._id);
                          }
                        }}
                      >
                        Delete Role
                      </Button>
                    </div>
                  )}
                </Card>
              ))}
            </div>
          )
        )}
      </div>

      {/* Create Role Modal */}
      {showCreateRole && (
        <Dialog open onClose={() => setShowCreateRole(false)} title="Create Custom Role" widthClass="max-w-lg">
          <form onSubmit={handleRole(d => createRoleMutation.mutate(d))} className="space-y-4">
            <Field label="Role Name *">
              <Input {...regRole('name')} placeholder="Waiter, Head Chef, Cashier…" />
              <FieldError message={roleErrors.name?.message} />
            </Field>
            <Field label="Description">
              <Input {...regRole('description')} placeholder="Summarize who gets this role…" />
            </Field>

            <div>
              <p className="text-sm font-semibold text-zinc-800 mb-2 font-sans">Permissions *</p>
              <div className="space-y-2 max-h-[30vh] overflow-y-auto pr-1">
                {PERMISSIONS.map(p => {
                  const active = selectedPermissions.includes(p.value);
                  return (
                    <div
                      key={p.value}
                      onClick={() => togglePermission(p.value)}
                      className={`flex items-start gap-3 p-2.5 rounded-lg border cursor-pointer transition-all ${
                        active ? 'border-brand/40 bg-brand/5' : 'border-zinc-200 hover:bg-zinc-50'
                      }`}
                    >
                      <div className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded border ${
                        active ? 'bg-brand border-brand text-white' : 'border-zinc-300'
                      }`}>
                        {active && <Check className="h-3 w-3" />}
                      </div>
                      <div>
                        <p className="text-xs font-bold text-zinc-800 font-sans">{p.label}</p>
                        <p className="text-[10px] text-zinc-500 font-sans">{p.desc}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
              <FieldError message={roleErrors.permissions?.message} />
            </div>

            <Button type="submit" className="w-full" disabled={createRoleMutation.isPending}>
              {createRoleMutation.isPending ? 'Creating…' : 'Create Role'}
            </Button>
          </form>
        </Dialog>
      )}

      {/* Create Staff Modal */}
      {showCreateStaff && (
        <Dialog open onClose={() => setShowCreateStaff(false)} title="Add Staff Member" widthClass="max-w-md">
          <form onSubmit={handleStaff(d => createStaffMutation.mutate(d))} className="space-y-4">
            <Field label="Full Name *">
              <Input {...regStaff('name')} placeholder="Gordon Ramsay" />
              <FieldError message={staffErrors.name?.message} />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Email *">
                <Input {...regStaff('email')} placeholder="gordon@hotel.com" />
                <FieldError message={staffErrors.email?.message} />
              </Field>
              <Field label="Password *">
                <Input type="password" {...regStaff('password')} placeholder="••••••••" />
                <FieldError message={staffErrors.password?.message} />
              </Field>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Designation">
                <Input {...regStaff('designation')} placeholder="Head Chef" />
              </Field>
              <Field label="Employee ID">
                <Input {...regStaff('employeeId')} placeholder="EMP-1002" />
              </Field>
            </div>

            <Field label="Permission Role *">
              <select
                {...regStaff('roleId')}
                className="h-10 w-full rounded-lg border border-zinc-200 bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-brand font-sans"
              >
                <option value="">Select custom role…</option>
                {roles.map(r => (
                  <option key={r._id} value={r._id}>{r.name}</option>
                ))}
              </select>
              <FieldError message={staffErrors.roleId?.message} />
            </Field>

            {user?.role === 'SUPER_ADMIN' && (
              <Field label="Assign Kitchen *">
                <select
                  {...regStaff('kitchenId')}
                  className="h-10 w-full rounded-lg border border-zinc-200 bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-brand font-sans"
                >
                  <option value="">Select kitchen…</option>
                  {kitchens?.map(k => (
                    <option key={k._id} value={k._id}>{k.name}</option>
                  ))}
                </select>
                <FieldError message={staffErrors.kitchenId?.message} />
              </Field>
            )}

            <Button type="submit" className="w-full font-sans" disabled={createStaffMutation.isPending}>
              {createStaffMutation.isPending ? 'Provisioning…' : 'Add Staff Member'}
            </Button>
          </form>
        </Dialog>
      )}

      {/* Edit Staff Details Modal */}
      {editStaffTarget && (
        <Dialog open onClose={() => setEditStaffTarget(null)} title={`Edit Details: ${editStaffTarget.user.name}`} widthClass="max-w-md">
          <form onSubmit={handleEditStaff(d => editStaffMutation.mutate({ id: editStaffTarget._id, d }))} className="space-y-4">
            <Field label="Designation">
              <Input {...regEditStaff('designation')} />
            </Field>
            <Field label="Employee ID">
              <Input {...regEditStaff('employeeId')} />
            </Field>

            <Field label="Permission Role">
              <select
                {...regEditStaff('roleId')}
                className="h-10 w-full rounded-lg border border-zinc-200 bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-brand font-sans"
              >
                <option value="">No role assigned</option>
                {roles.map(r => (
                  <option key={r._id} value={r._id}>{r.name}</option>
                ))}
              </select>
            </Field>

            <Field label="Account Status">
              <select
                {...regEditStaff('status')}
                className="h-10 w-full rounded-lg border border-zinc-200 bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-brand font-sans"
              >
                <option value="ACTIVE">ACTIVE</option>
                <option value="SUSPENDED">SUSPENDED</option>
                <option value="TERMINATED">TERMINATED</option>
              </select>
            </Field>

            <Button type="submit" className="w-full font-sans" disabled={editStaffMutation.isPending}>
              {editStaffMutation.isPending ? 'Updating…' : 'Save Changes'}
            </Button>
          </form>
        </Dialog>
      )}
    </AdminShell>
  );
}
