'use client';

import React, { useState, useEffect } from 'react';
import { useFirestore } from '@/firebase';
import { getDocs, updateDoc, doc, deleteDoc, query, collection, onSnapshot } from 'firebase/firestore';
import { safeCollection } from '@/firebase/helpers';
import { Users, Shield, Ban, Trash2, ChevronDown, AlertCircle, RefreshCw } from 'lucide-react';

interface User {
  id: string;
  fullName: string;
  email: string;
  role: string;
  universityType?: string;
  isSuspended?: boolean;
  createdAt?: any;
  rides?: number;
  bookings?: number;
}

export default function UsersSection({ universityType }: { universityType: string }) {
  const firestore = useFirestore();
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filterRole, setFilterRole] = useState<'all' | 'provider' | 'student'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  useEffect(() => {
    if (!firestore) return;

    setLoading(true);
    setError(null);

    // Fetch users from BOTH universities for complete admin view
    const universities = ['NED', 'FAST'];
    let allUsers: User[] = [];
    let completedFetches = 0;

    const fetchAllUsers = async () => {
      try {
        for (const univId of universities) {
          const usersCol = collection(firestore, `universities/${univId}/users`);
          const usersSnap = await getDocs(usersCol);
          
          console.log(`[UsersSection] Fetched ${usersSnap.size} users from ${univId}`);
          
          const univUsers: User[] = usersSnap.docs.map(doc => ({
            id: doc.id,
            fullName: doc.data().fullName || doc.data().name || 'Unknown',
            email: doc.data().email || '',
            role: doc.data().role || 'student',
            universityType: univId,
            isSuspended: doc.data().isSuspended || false,
            createdAt: doc.data().createdAt,
            rides: doc.data().ridesAsProvider?.length || doc.data().ridesOffered || 0,
            bookings: doc.data().bookings?.length || doc.data().ridesBooked || 0,
          }));
          
          allUsers = [...allUsers, ...univUsers];
        }
        
        console.log(`[UsersSection] Total users loaded: ${allUsers.length}`);
        setUsers(allUsers);
        setLoading(false);
        setError(null);
      } catch (err: any) {
        console.error('[UsersSection] Failed to fetch users:', err);
        setError(`Failed to load users: ${err.message}`);
        setLoading(false);
      }
    };

    fetchAllUsers();
  }, [firestore]);

  const handleSuspendUser = async (userId: string, isSuspended: boolean, userUniversity: string) => {
    if (!firestore) return;
    try {
      // Use correct university-scoped path
      const userRef = doc(firestore, `universities/${userUniversity}/users`, userId);
      await updateDoc(userRef, { isSuspended: !isSuspended });
      setUsers(users.map(u => u.id === userId ? { ...u, isSuspended: !u.isSuspended } : u));
    } catch (err: any) {
      console.error('[UsersSection] Failed to update user status:', err);
      alert(`Failed to update user: ${err.message}`);
    }
  };

  const handleDeleteUser = async (userId: string, userUniversity: string) => {
    if (!firestore || !confirm('Are you sure? This action cannot be undone.')) return;
    try {
      // Use correct university-scoped path
      await deleteDoc(doc(firestore, `universities/${userUniversity}/users`, userId));
      setUsers(users.filter(u => u.id !== userId));
    } catch (err: any) {
      console.error('[UsersSection] Failed to delete user:', err);
      alert(`Failed to delete user: ${err.message}`);
    }
  };

  // Error state UI
  if (error) {
    return (
      <div className="text-center py-12">
        <AlertCircle className="h-12 w-12 text-red-400 mx-auto mb-4" />
        <p className="text-red-400 mb-4">{error}</p>
        <button
          onClick={() => window.location.reload()}
          className="px-4 py-2 bg-slate-800 text-white rounded-lg hover:bg-slate-700 transition-colors flex items-center gap-2 mx-auto"
        >
          <RefreshCw className="h-4 w-4" />
          Retry
        </button>
      </div>
    );
  }

  let filteredUsers = users.filter(user => {
    let matches = true;
    
    if (filterRole !== 'all') {
      matches = matches && user.role === filterRole;
    }
    
    if (searchQuery) {
      matches = matches && (
        user.fullName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        user.email.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }
    
    return matches;
  });

  const totalPages = Math.ceil(filteredUsers.length / itemsPerPage);
  const paginatedUsers = filteredUsers.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  return (
    <div className="space-y-6">
      {/* Header with Search and Filters */}
      <div className="space-y-4">
        <div>
          <input
            type="text"
            placeholder="Search users by name or email..."
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setCurrentPage(1);
            }}
            className="w-full px-4 py-3 rounded-xl bg-slate-800/50 border border-slate-700/50 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all"
          />
        </div>

        <div className="flex gap-2">
          {(['all', 'provider', 'student'] as const).map((role) => (
            <button
              key={role}
              onClick={() => {
                setFilterRole(role);
                setCurrentPage(1);
              }}
              className={`px-4 py-2 rounded-lg font-medium transition-all capitalize ${
                filterRole === role
                  ? 'bg-primary text-white shadow-lg shadow-primary/30'
                  : 'bg-slate-800/50 text-slate-300 hover:bg-slate-700/50'
              }`}
            >
              {role}
            </button>
          ))}
        </div>
      </div>

      {/* Users Table */}
      <div className="rounded-2xl bg-gradient-to-br from-slate-800/60 to-slate-900/60 backdrop-blur-md border border-slate-700/50 overflow-hidden animate-in fade-in">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-700/50 bg-slate-900/50">
                <th className="px-6 py-4 text-left text-slate-300 font-semibold">User</th>
                <th className="px-6 py-4 text-left text-slate-300 font-semibold">Role</th>
                <th className="px-6 py-4 text-left text-slate-300 font-semibold">Activity</th>
                <th className="px-6 py-4 text-left text-slate-300 font-semibold">Status</th>
                <th className="px-6 py-4 text-left text-slate-300 font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                [...Array(5)].map((_, i) => (
                  <tr key={i} className="border-b border-slate-700/30 animate-pulse">
                    <td className="px-6 py-4"><div className="h-4 bg-slate-700 rounded w-48" /></td>
                    <td className="px-6 py-4"><div className="h-4 bg-slate-700 rounded w-24" /></td>
                    <td className="px-6 py-4"><div className="h-4 bg-slate-700 rounded w-32" /></td>
                    <td className="px-6 py-4"><div className="h-4 bg-slate-700 rounded w-20" /></td>
                    <td className="px-6 py-4"><div className="h-4 bg-slate-700 rounded w-32" /></td>
                  </tr>
                ))
              ) : paginatedUsers.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center text-slate-400">
                    <Users className="h-8 w-8 mx-auto mb-2 opacity-50" />
                    <p>No users found</p>
                  </td>
                </tr>
              ) : (
                paginatedUsers.map((user) => (
                  <React.Fragment key={user.id}>
                    <tr className="border-b border-slate-700/30 hover:bg-slate-800/30 transition-colors cursor-pointer" onClick={() => setExpandedId(expandedId === user.id ? null : user.id)}>
                      <td className="px-6 py-4">
                        <div>
                          <p className="font-medium text-white">{user.fullName}</p>
                          <p className="text-xs text-slate-400">{user.email}</p>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className="px-3 py-1 rounded-full text-xs font-medium bg-slate-700/50 text-slate-200 capitalize">
                          {user.role}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm text-slate-300">
                        {user.role === 'provider' 
                          ? `${user.rides || 0} rides`
                          : `${user.bookings || 0} bookings`
                        }
                      </td>
                      <td className="px-6 py-4">
                        <span className={`px-3 py-1 rounded text-xs font-medium ${
                          user.isSuspended
                            ? 'bg-red-900/30 text-red-300'
                            : 'bg-green-900/30 text-green-300'
                        }`}>
                          {user.isSuspended ? 'Suspended' : 'Active'}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex gap-2">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleSuspendUser(user.id, user.isSuspended || false, user.universityType || 'NED');
                            }}
                            className={`p-2 rounded transition-colors ${
                              user.isSuspended
                                ? 'hover:bg-green-900/30 text-slate-400 hover:text-green-400'
                                : 'hover:bg-orange-900/30 text-slate-400 hover:text-orange-400'
                            }`}
                          >
                            <Ban className="h-4 w-4" />
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeleteUser(user.id, user.universityType || 'NED');
                            }}
                            className="p-2 hover:bg-red-900/30 rounded transition-colors text-slate-400 hover:text-red-400"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                    {expandedId === user.id && (
                      <tr className="bg-slate-800/20 border-b border-slate-700/30">
                        <td colSpan={5} className="px-6 py-4">
                          <div className="space-y-2 text-sm">
                            <p><span className="text-slate-400">User ID:</span> <span className="text-slate-300 font-mono text-xs">{user.id}</span></p>
                            <p><span className="text-slate-400">Joined:</span> <span className="text-slate-300">{user.createdAt?.toDate?.()?.toLocaleDateString?.() || 'N/A'}</span></p>
                            <p><span className="text-slate-400">University:</span> <span className="text-slate-300 capitalize">{user.universityType || 'N/A'}</span></p>
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <button
            onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
            disabled={currentPage === 1}
            className="px-3 py-2 rounded-lg bg-slate-800/50 text-slate-300 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-slate-700/50 transition-colors"
          >
            Prev
          </button>
          {[...Array(totalPages)].map((_, i) => (
            <button
              key={i + 1}
              onClick={() => setCurrentPage(i + 1)}
              className={`px-3 py-2 rounded-lg transition-all ${
                currentPage === i + 1
                  ? 'bg-primary text-white shadow-lg shadow-primary/30'
                  : 'bg-slate-800/50 text-slate-300 hover:bg-slate-700/50'
              }`}
            >
              {i + 1}
            </button>
          ))}
          <button
            onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
            disabled={currentPage === totalPages}
            className="px-3 py-2 rounded-lg bg-slate-800/50 text-slate-300 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-slate-700/50 transition-colors"
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
}
