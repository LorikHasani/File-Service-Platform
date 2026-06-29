import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, CreditCard, Calendar } from 'lucide-react';
import { Layout } from '@/components/Layout';
import { Card, Button, Input, Badge, Spinner, Avatar, Pagination, usePagination } from '@/components/ui';
import { useAllUsers } from '@/hooks/useSupabase';
import toast from 'react-hot-toast';
import { formatDistanceToNow } from 'date-fns';

export const AdminUsersPage: React.FC = () => {
  const navigate = useNavigate();
  const { users, loading, addCredits } = useAllUsers();
  const [search, setSearch] = useState('');
  const [toolFilter, setToolFilter] = useState<'all' | 'master' | 'slave'>('all');
  const [creditModal, setCreditModal] = useState<{ userId: string; name: string } | null>(null);
  const [creditAmount, setCreditAmount] = useState('');
  const [creditDescription, setCreditDescription] = useState('');
  const [processing, setProcessing] = useState(false);

  const filteredUsers = users.filter((user) => {
    const matchesSearch = search === '' ||
      user.email.toLowerCase().includes(search.toLowerCase()) ||
      user.contact_name.toLowerCase().includes(search.toLowerCase()) ||
      user.company_name?.toLowerCase().includes(search.toLowerCase());
    const matchesTool = toolFilter === 'all' || user.tool_type === toolFilter;
    return matchesSearch && matchesTool;
  });

  const {
    page,
    setPage,
    totalPages,
    totalItems,
    rangeStart,
    rangeEnd,
    pagedItems: pageUsers,
  } = usePagination(filteredUsers, 25);

  const handleAddCredits = async () => {
    if (!creditModal || !creditAmount || !creditDescription) return;
    
    setProcessing(true);
    const amount = parseFloat(creditAmount);
    
    if (isNaN(amount)) {
      toast.error('Invalid amount');
      setProcessing(false);
      return;
    }
    
    const { error } = await addCredits(creditModal.userId, amount, creditDescription);
    
    if (error) {
      toast.error('Failed to adjust balance');
    } else {
      toast.success(`${amount > 0 ? 'Added' : 'Removed'} €${Math.abs(amount)}`);
      setCreditModal(null);
      setCreditAmount('');
      setCreditDescription('');
    }
    setProcessing(false);
  };

  if (loading) {
    return (
      <Layout title="Users">
        <div className="flex items-center justify-center h-64">
          <Spinner size="lg" />
        </div>
      </Layout>
    );
  }

  const totalCredits = users.reduce((sum, u) => sum + (u.credit_balance || 0), 0);
  const clientCount = users.filter(u => u.role === 'client').length;
  const adminCount = users.filter(u => u.role !== 'client').length;

  return (
    <Layout title="Users">
      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
        <Card className="text-center">
          <p className="text-2xl font-bold">{users.length}</p>
          <p className="text-sm text-zinc-500">Total Users</p>
        </Card>
        <Card className="text-center">
          <p className="text-2xl font-bold text-blue-600">{clientCount}</p>
          <p className="text-sm text-zinc-500">Clients</p>
        </Card>
        <Card className="text-center">
          <p className="text-2xl font-bold text-purple-600">{adminCount}</p>
          <p className="text-sm text-zinc-500">Admins</p>
        </Card>
        <Card className="text-center">
          <p className="text-2xl font-bold text-green-600">€{totalCredits.toFixed(0)}</p>
          <p className="text-sm text-zinc-500">Total Balance</p>
        </Card>
      </div>

      {/* Search + filters */}
      <div className="mb-6 space-y-3">
        <Input
          placeholder="Search by name, email, company..."
          leftIcon={<Search size={18} />}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <div className="flex gap-2">
          {(['all', 'master', 'slave'] as const).map((t) => (
            <button
              key={t}
              onClick={() => { setToolFilter(t); setPage(1); }}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium capitalize transition-colors ${
                toolFilter === t
                  ? 'bg-red-600 text-white'
                  : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-700'
              }`}
            >
              {t === 'all' ? 'All Types' : t}
            </button>
          ))}
        </div>
      </div>

      {/* Users Table */}
      <Card padding="none">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-zinc-50 dark:bg-zinc-800/50">
              <tr>
                <th className="text-left px-4 py-3 text-sm font-semibold">User</th>
                <th className="text-left px-4 py-3 text-sm font-semibold">Company</th>
                <th className="text-left px-4 py-3 text-sm font-semibold">Role</th>
                <th className="text-left px-4 py-3 text-sm font-semibold">Balance</th>
                <th className="text-left px-4 py-3 text-sm font-semibold">Joined</th>
                <th className="text-left px-4 py-3 text-sm font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
              {pageUsers.map((user) => (
                <tr key={user.id} className="hover:bg-zinc-50 dark:hover:bg-zinc-800/50 cursor-pointer" onClick={() => navigate(`/admin/users/${user.id}`)}>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <Avatar name={user.contact_name} size="sm" />
                      <div>
                        <p className="font-medium">{user.contact_name}</p>
                        <p className="text-xs text-zinc-500">{user.email}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <p className="text-sm">{user.company_name || '-'}</p>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1.5">
                      <Badge variant={user.role === 'client' ? 'pending' : 'completed'}>
                        {user.role}
                      </Badge>
                      {user.role === 'client' && (
                        <span
                          className={`text-xs font-medium px-2 py-0.5 rounded-full capitalize ${
                            user.tool_type === 'slave'
                              ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'
                              : 'bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300'
                          }`}
                        >
                          {user.tool_type}
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span className="font-semibold">€{user.credit_balance?.toFixed(2)}</span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1 text-sm text-zinc-500">
                      <Calendar size={14} />
                      {formatDistanceToNow(new Date(user.created_at), { addSuffix: true })}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={(e) => { e.stopPropagation(); setCreditModal({ userId: user.id, name: user.contact_name }); }}
                    >
                      <CreditCard size={14} />
                      Adjust
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {filteredUsers.length === 0 && (
          <div className="text-center py-12 text-zinc-500">
            No users found
          </div>
        )}
        {totalPages > 1 && (
          <Pagination
            page={page}
            totalPages={totalPages}
            totalItems={totalItems}
            rangeStart={rangeStart}
            rangeEnd={rangeEnd}
            onPageChange={setPage}
          />
        )}
      </Card>

      {/* Credit Modal */}
      {creditModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <Card className="w-full max-w-md">
            <h2 className="text-xl font-semibold mb-4">Adjust Balance</h2>
            <p className="text-zinc-500 mb-4">User: <span className="font-medium text-zinc-900 dark:text-white">{creditModal.name}</span></p>
            
            <div className="space-y-4">
              <Input
                label="Amount"
                type="number"
                placeholder="Enter amount (negative to remove)"
                value={creditAmount}
                onChange={(e) => setCreditAmount(e.target.value)}
              />
              <Input
                label="Description"
                placeholder="Reason for adjustment"
                value={creditDescription}
                onChange={(e) => setCreditDescription(e.target.value)}
              />
              
              <div className="flex gap-2">
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={() => setCreditAmount('100')}
                >
                  +100
                </Button>
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={() => setCreditAmount('250')}
                >
                  +250
                </Button>
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={() => setCreditAmount('500')}
                >
                  +500
                </Button>
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={() => setCreditAmount('1000')}
                >
                  +1000
                </Button>
              </div>
            </div>

            <div className="flex gap-2 mt-6">
              <Button 
                variant="ghost" 
                className="flex-1"
                onClick={() => {
                  setCreditModal(null);
                  setCreditAmount('');
                  setCreditDescription('');
                }}
              >
                Cancel
              </Button>
              <Button 
                className="flex-1"
                onClick={handleAddCredits}
                disabled={!creditAmount || !creditDescription || processing}
                isLoading={processing}
              >
                {parseFloat(creditAmount || '0') >= 0 ? 'Add' : 'Remove'} €
              </Button>
            </div>
          </Card>
        </div>
      )}
    </Layout>
  );
};
