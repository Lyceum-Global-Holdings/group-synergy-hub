import React, { useState } from 'react';
import { format } from 'date-fns';
import { Building2, Mail, Phone, Globe, MapPin, CreditCard, Star, User, Edit, Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Separator } from '@/components/ui/separator';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { useDeleteSupplierContact } from '@/hooks/useSuppliers';
import type { Supplier, SupplierContact } from '@/types/supplier';
import { SUPPLIER_TYPES, SUPPLIER_STATUSES, SUPPLIER_CATEGORIES, PAYMENT_TERMS } from '@/types/supplier';
import { SupplierItemsSection } from './SupplierItemsSection';
import { CreateSupplierDialog } from './CreateSupplierDialog';

interface SupplierDetailsDialogProps {
  supplier: Supplier;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const SupplierDetailsDialog: React.FC<SupplierDetailsDialogProps> = ({
  supplier,
  open,
  onOpenChange,
}) => {
  const [contactToDelete, setContactToDelete] = useState<SupplierContact | null>(null);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const deleteContactMutation = useDeleteSupplierContact();

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active':
        return 'bg-green-100 text-green-800 border-green-200';
      case 'inactive':
        return 'bg-gray-100 text-gray-800 border-gray-200';
      case 'suspended':
        return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'blacklisted':
        return 'bg-red-100 text-red-800 border-red-200';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const renderStars = (rating?: number) => {
    if (!rating) return <span className="text-muted-foreground">No rating</span>;
    
    return (
      <div className="flex items-center gap-1">
        {[1, 2, 3, 4, 5].map((star) => (
          <Star
            key={star}
            className={`w-4 h-4 ${
              star <= rating
                ? 'fill-yellow-400 text-yellow-400'
                : 'text-gray-300'
            }`}
          />
        ))}
        <span className="ml-1 text-sm text-muted-foreground">({rating})</span>
      </div>
    );
  };

  const handleDeleteContact = () => {
    if (contactToDelete) {
      deleteContactMutation.mutate({
        id: contactToDelete.id,
        supplierId: supplier.id,
      });
      setContactToDelete(null);
    }
  };

  const formatCurrency = (amount?: number, currency = 'LKR') => {
    if (!amount) return '-';
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency,
    }).format(amount);
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-4xl max-h-[85vh] overflow-y-auto">
          <DialogHeader className="pb-4 border-b">
            <div className="flex items-start justify-between gap-3 pr-8">
              <div className="flex items-center gap-3 min-w-0">
                <Avatar className="h-12 w-12">
                  <AvatarFallback className="text-lg">
                    {supplier.name.substring(0, 2).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0">
                  <DialogTitle className="text-2xl truncate">{supplier.name}</DialogTitle>
                  <div className="flex items-center gap-2 mt-1 flex-wrap">
                    <Badge variant="outline" className="font-mono">{supplier.supplier_code}</Badge>
                    <Badge variant="outline">
                      {SUPPLIER_TYPES.find(t => t.value === supplier.supplier_type)?.label}
                    </Badge>
                    <Badge className={getStatusColor(supplier.status)}>
                      {SUPPLIER_STATUSES.find(s => s.value === supplier.status)?.label}
                    </Badge>
                  </div>
                </div>
              </div>
              <Button variant="outline" onClick={() => setIsEditDialogOpen(true)} className="shrink-0">
                <Edit className="w-4 h-4 mr-2" />
                Edit
              </Button>
            </div>

            {/* KPI strip */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-4">
              <div className="rounded-lg border bg-card p-3">
                <p className="text-xs text-muted-foreground">Rating</p>
                <div className="mt-0.5">{renderStars(supplier.rating)}</div>
              </div>
              <div className="rounded-lg border bg-card p-3">
                <p className="text-xs text-muted-foreground">Payment terms</p>
                <p className="text-sm font-semibold mt-0.5">{PAYMENT_TERMS.find(p => p.value === supplier.payment_terms)?.label || supplier.payment_terms || '—'}</p>
              </div>
              <div className="rounded-lg border bg-card p-3">
                <p className="text-xs text-muted-foreground">Category</p>
                <p className="text-sm font-semibold mt-0.5 truncate">{SUPPLIER_CATEGORIES.find(c => c.value === (supplier as any).supplier_category)?.label || (supplier as any).supplier_category || '—'}</p>
              </div>
              <div className="rounded-lg border bg-card p-3">
                <p className="text-xs text-muted-foreground">Added</p>
                <p className="text-sm font-semibold mt-0.5">{(supplier as any).created_at ? format(new Date((supplier as any).created_at), 'dd MMM yyyy') : '—'}</p>
              </div>
            </div>
          </DialogHeader>

          <Tabs defaultValue="overview" className="w-full">
            <TabsList className="grid w-full grid-cols-5">
              <TabsTrigger value="overview">Overview</TabsTrigger>
              <TabsTrigger value="contacts">Contacts</TabsTrigger>
              <TabsTrigger value="business">Business Info</TabsTrigger>
              <TabsTrigger value="items">Items</TabsTrigger>
              <TabsTrigger value="activity">Activity</TabsTrigger>
            </TabsList>

            <TabsContent value="overview" className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {/* Basic Information */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Building2 className="w-5 h-5" />
                      Basic Information
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div>
                      <label className="text-sm font-medium text-muted-foreground">Legal Name</label>
                      <p className="text-sm">{supplier.legal_name || supplier.name}</p>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-muted-foreground">Category</label>
                      <p className="text-sm">
                        {supplier.category 
                          ? SUPPLIER_CATEGORIES.find(c => c.value === supplier.category)?.label || supplier.category
                          : 'Not specified'
                        }
                      </p>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-muted-foreground">Tax ID</label>
                      <p className="text-sm">{supplier.tax_id || 'Not provided'}</p>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-muted-foreground">Registration Number</label>
                      <p className="text-sm">{supplier.registration_number || 'Not provided'}</p>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-muted-foreground">Rating</label>
                      <div className="mt-1">{renderStars(supplier.rating)}</div>
                    </div>
                  </CardContent>
                </Card>

                {/* Contact Information */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Mail className="w-5 h-5" />
                      Contact Information
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div>
                      <label className="text-sm font-medium text-muted-foreground">Email</label>
                      <div className="flex items-center gap-2 mt-1">
                        <Mail className="w-4 h-4" />
                        <p className="text-sm">{supplier.email || 'Not provided'}</p>
                      </div>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-muted-foreground">Phone</label>
                      <div className="flex items-center gap-2 mt-1">
                        <Phone className="w-4 h-4" />
                        <p className="text-sm">{supplier.phone || 'Not provided'}</p>
                      </div>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-muted-foreground">Website</label>
                      <div className="flex items-center gap-2 mt-1">
                        <Globe className="w-4 h-4" />
                        {supplier.website ? (
                          <a
                            href={supplier.website}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-sm text-primary hover:underline"
                          >
                            {supplier.website}
                          </a>
                        ) : (
                          <p className="text-sm">Not provided</p>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Address Information */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <MapPin className="w-5 h-5" />
                      Address
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {supplier.address_line1 || supplier.city || supplier.country ? (
                      <div className="space-y-1 text-sm">
                        {supplier.address_line1 && <p>{supplier.address_line1}</p>}
                        {supplier.address_line2 && <p>{supplier.address_line2}</p>}
                        <p>
                          {[supplier.city, supplier.state].filter(Boolean).join(', ')}
                          {supplier.postal_code && ` ${supplier.postal_code}`}
                        </p>
                        {supplier.country && <p>{supplier.country}</p>}
                      </div>
                    ) : (
                      <p className="text-sm text-muted-foreground">No address provided</p>
                    )}
                  </CardContent>
                </Card>
              </div>

              {/* Notes */}
              {supplier.notes && (
                <Card>
                  <CardHeader>
                    <CardTitle>Notes</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm whitespace-pre-wrap">{supplier.notes}</p>
                  </CardContent>
                </Card>
              )}
            </TabsContent>

            <TabsContent value="contacts" className="space-y-6">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold">Contact Persons</h3>
                <Button size="sm">
                  <Plus className="w-4 h-4 mr-2" />
                  Add Contact
                </Button>
              </div>

              {supplier.contacts && supplier.contacts.length > 0 ? (
                <div className="rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Name</TableHead>
                        <TableHead>Title</TableHead>
                        <TableHead>Contact Info</TableHead>
                        <TableHead>Primary</TableHead>
                        <TableHead className="w-[50px]"></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {supplier.contacts.map((contact) => (
                        <TableRow key={contact.id}>
                          <TableCell>
                            <div className="flex items-center gap-3">
                              <Avatar className="h-8 w-8">
                                <AvatarFallback className="text-sm">
                                  {contact.name.substring(0, 2).toUpperCase()}
                                </AvatarFallback>
                              </Avatar>
                              <span className="font-medium">{contact.name}</span>
                            </div>
                          </TableCell>
                          <TableCell>
                            {contact.title || <span className="text-muted-foreground">-</span>}
                          </TableCell>
                          <TableCell>
                            <div className="space-y-1">
                              {contact.email && (
                                <div className="flex items-center gap-2 text-sm">
                                  <Mail className="w-3 h-3" />
                                  {contact.email}
                                </div>
                              )}
                              {contact.phone && (
                                <div className="flex items-center gap-2 text-sm">
                                  <Phone className="w-3 h-3" />
                                  {contact.phone}
                                </div>
                              )}
                              {contact.mobile && (
                                <div className="flex items-center gap-2 text-sm">
                                  <Phone className="w-3 h-3" />
                                  {contact.mobile} (Mobile)
                                </div>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>
                            {contact.is_primary && (
                              <Badge variant="secondary">Primary</Badge>
                            )}
                          </TableCell>
                          <TableCell>
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="sm">
                                  <Edit className="w-4 h-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem>Edit Contact</DropdownMenuItem>
                                <DropdownMenuItem
                                  onClick={() => setContactToDelete(contact)}
                                  className="text-destructive"
                                >
                                  Delete Contact
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              ) : (
                <div className="text-center py-8">
                  <User className="mx-auto h-12 w-12 text-muted-foreground" />
                  <h3 className="mt-4 text-lg font-semibold">No contacts found</h3>
                  <p className="text-muted-foreground">Add contact persons for this supplier</p>
                </div>
              )}
            </TabsContent>

            <TabsContent value="business" className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Financial Information */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <CreditCard className="w-5 h-5" />
                      Financial Information
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div>
                      <label className="text-sm font-medium text-muted-foreground">Payment Terms</label>
                      <p className="text-sm">
                        {supplier.payment_terms 
                          ? PAYMENT_TERMS.find(p => p.value === supplier.payment_terms)?.label || supplier.payment_terms
                          : 'Not specified'
                        }
                      </p>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-muted-foreground">Credit Limit</label>
                      <p className="text-sm">
                        {formatCurrency(supplier.credit_limit, supplier.currency)}
                      </p>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-muted-foreground">Currency</label>
                      <p className="text-sm">{supplier.currency}</p>
                    </div>
                  </CardContent>
                </Card>

                {/* Dates */}
                <Card>
                  <CardHeader>
                    <CardTitle>Important Dates</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div>
                      <label className="text-sm font-medium text-muted-foreground">Created</label>
                      <p className="text-sm">{format(new Date(supplier.created_at), 'PPP')}</p>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-muted-foreground">Last Updated</label>
                      <p className="text-sm">{format(new Date(supplier.updated_at), 'PPP')}</p>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            <TabsContent value="items" className="space-y-6">
              <div className="space-y-2">
                <h3 className="text-lg font-semibold">Supplier Item Catalog</h3>
                <p className="text-sm text-muted-foreground">
                  Manage the items this supplier can provide, including pricing and lead times.
                </p>
              </div>
              <SupplierItemsSection supplierId={supplier.id} />
            </TabsContent>

            <TabsContent value="activity" className="space-y-6">
              <div className="text-center py-8">
                <Building2 className="mx-auto h-12 w-12 text-muted-foreground" />
                <h3 className="mt-4 text-lg font-semibold">Activity Timeline</h3>
                <p className="text-muted-foreground">Activity tracking will be implemented in future updates</p>
              </div>
            </TabsContent>
          </Tabs>
        </DialogContent>
      </Dialog>

      {/* Delete Contact Confirmation Dialog */}
      <AlertDialog open={!!contactToDelete} onOpenChange={() => setContactToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Contact</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{contactToDelete?.name}"? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteContact}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <CreateSupplierDialog
        open={isEditDialogOpen}
        onOpenChange={(open) => {
          setIsEditDialogOpen(open);
          if (!open) {
            onOpenChange(false);
          }
        }}
        supplier={supplier}
        mode="edit"
      />
    </>
  );
};