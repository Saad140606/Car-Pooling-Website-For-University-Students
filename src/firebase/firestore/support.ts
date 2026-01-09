import { collection, addDoc, serverTimestamp, doc, updateDoc } from 'firebase/firestore';
import type { Firestore } from 'firebase/firestore';

export type ContactMessage = {
  category: string;
  subject: string;
  message: string;
  uid?: string | null;
  name?: string | null;
  email?: string | null;
  status?: 'new' | 'seen' | 'responded';
};

export type ReportRecord = {
  reportType: string;
  submittedBy: { uid: string; name?: string | null; email?: string | null };
  reportedUser?: { uid: string; name?: string | null } | null;
  rideId?: string | null;
  subject?: string | null;
  description: string;
  evidenceUrl?: string | null;
  status?: 'pending' | 'in_review' | 'resolved' | 'rejected';
  adminNotes?: string | null;
};

export async function submitContactMessage(db: Firestore, data: ContactMessage) {
  const col = collection(db, 'contact_messages');
  const payload = {
    category: data.category,
    subject: data.subject,
    message: data.message,
    uid: data.uid || null,
    name: data.name || null,
    email: data.email || null,
    status: data.status || 'new',
    createdAt: serverTimestamp(),
  } as any;
  return await addDoc(col, payload);
}

export async function submitReport(db: Firestore, data: ReportRecord) {
  const col = collection(db, 'reports');
  const payload = {
    reportType: data.reportType,
    submittedBy: data.submittedBy,
    reportedUser: data.reportedUser || null,
    rideId: data.rideId || null,
    subject: data.subject || null,
    description: data.description,
    evidenceUrl: data.evidenceUrl || null,
    status: data.status || 'pending',
    adminNotes: data.adminNotes || null,
    createdAt: serverTimestamp(),
  } as any;
  return await addDoc(col, payload);
}

export async function updateReportStatus(db: Firestore, reportId: string, updates: Partial<ReportRecord>) {
  const ref = doc(db, 'reports', reportId);
  await updateDoc(ref, { ...updates, updatedAt: serverTimestamp() } as any);
}

export async function updateContactStatus(db: Firestore, messageId: string, updates: Partial<ContactMessage>) {
  const ref = doc(db, 'contact_messages', messageId);
  await updateDoc(ref, { ...updates, updatedAt: serverTimestamp() } as any);
}

export default {
  submitContactMessage,
  submitReport,
  updateReportStatus,
  updateContactStatus,
};
