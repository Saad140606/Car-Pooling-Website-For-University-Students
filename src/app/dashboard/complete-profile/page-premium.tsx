'use client';

import React, { useState } from 'react';
import { useUser, useFirestore, useAuth } from '@/firebase';
import { doc, updateDoc } from 'firebase/firestore';
import { updateProfile } from 'firebase/auth';
import { useRouter } from 'next/navigation';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/premium-select';
import { ProgressBar } from '@/components/Progress';
import { CheckCircle2, User, Mail, Phone, BookOpen, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Step {
  id: string;
  title: string;
  description: string;
  icon: React.ReactNode;
  completed: boolean;
}

export default function CompleteProfilePage() {
  const { user, data: userData, loading: userLoading } = useUser();
  const firestore = useFirestore();
  const auth = useAuth();
  const router = useRouter();
  const { toast } = useToast();

  const [currentStep, setCurrentStep] = useState(0);
  const [saving, setSaving] = useState(false);

  const [fullName, setFullName] = useState(userData?.fullName || '');
  const [gender, setGender] = useState<'male' | 'female' | undefined>(userData?.gender);
  const [contactNumber, setContactNumber] = useState(userData?.contactNumber || '');
  const [university, setUniversity] = useState(userData?.university || '');
  const [bio, setBio] = useState(userData?.bio || '');
  const [transport, setTransport] = useState(userData?.transport || '');

  const steps: Step[] = [
    {
      id: 'basic',
      title: 'Basic Info',
      description: 'Your name and contact details',
      icon: <User className="h-5 w-5" />,
      completed: !!fullName && !!contactNumber,
    },
    {
      id: 'profile',
      title: 'Profile Details',
      description: 'Gender and bio information',
      icon: <Mail className="h-5 w-5" />,
      completed: !!gender && !!bio,
    },
    {
      id: 'university',
      title: 'University',
      description: 'Your educational institution',
      icon: <BookOpen className="h-5 w-5" />,
      completed: !!university,
    },
    {
      id: 'transport',
      title: 'Transport',
      description: 'Your vehicle information',
      icon: <Phone className="h-5 w-5" />,
      completed: !!transport,
    },
  ];

  const profileCompletion = (steps.filter((s) => s.completed).length / steps.length) * 100;

  const handleSaveStep = async () => {
    if (!user || !firestore || !auth) return;

    setSaving(true);
    try {
      // Update Auth profile
      if (fullName !== user.displayName) {
        await updateProfile(user, { displayName: fullName });
      }

      // Update Firestore
      const userRef = doc(firestore, 'users', user.uid);
      await updateDoc(userRef, {
        fullName: fullName || undefined,
        gender: gender || undefined,
        contactNumber: contactNumber || undefined,
        university: university || undefined,
        bio: bio || undefined,
        transport: transport || undefined,
        profileCompleted: profileCompletion === 100,
        updatedAt: new Date(),
      });

      toast({
        title: 'Profile updated!',
        description: 'Your information has been saved.',
      });

      if (profileCompletion === 100) {
        setTimeout(() => {
          router.push('/dashboard');
          toast({
            title: 'Profile complete!',
            description: 'Welcome to Campus Ride! Ready to find your next ride?',
          });
        }, 1000);
      } else {
        setCurrentStep((prev) => Math.min(prev + 1, steps.length - 1));
      }
    } catch (err: any) {
      console.error('Profile update failed:', err);
      toast({
        variant: 'destructive',
        title: 'Update failed',
        description: err?.message || 'Could not save your profile. Please try again.',
      });
    } finally {
      setSaving(false);
    }
  };

  const isCurrentStepComplete = steps[currentStep]?.completed || false;

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-950 to-slate-900 pb-20">
      {/* Header with Progress */}
      <div className="bg-slate-950/80 backdrop-blur-xl border-b border-slate-800 py-8 px-4 sm:px-6 sticky top-0 z-40">
        <div className="max-w-2xl mx-auto">
          <h1 className="text-3xl font-bold text-white mb-2">Complete Your Profile</h1>
          <p className="text-slate-400 mb-6">
            You're{' '}
            <span className="text-primary font-semibold">{Math.round(profileCompletion)}%</span> done!
          </p>
          <ProgressBar value={profileCompletion} className="h-2" />
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 sm:px-6 py-8">
        <div className="grid md:grid-cols-4 gap-4 mb-8">
          {steps.map((step, idx) => (
            <button
              key={step.id}
              onClick={() => setCurrentStep(idx)}
              className={cn(
                'p-4 rounded-lg border-2 transition-all duration-200 text-left',
                currentStep === idx
                  ? 'border-primary bg-primary/5'
                  : step.completed
                  ? 'border-green-500 bg-green-500/5'
                  : 'border-slate-700 bg-slate-900/50 hover:border-slate-600'
              )}
            >
              <div className="flex items-start gap-3">
                <div
                  className={cn(
                    'mt-1 p-2 rounded-lg',
                    currentStep === idx
                      ? 'bg-primary text-white'
                      : step.completed
                      ? 'bg-green-500 text-white'
                      : 'bg-slate-800 text-slate-400'
                  )}
                >
                  {step.completed ? <CheckCircle2 className="h-4 w-4" /> : step.icon}
                </div>
                <div>
                  <div className="font-semibold text-white text-sm">{step.title}</div>
                  <div className="text-xs text-slate-400">{step.description}</div>
                </div>
              </div>
            </button>
          ))}
        </div>

        {/* Step Content */}
        <Card className="border border-slate-700 bg-gradient-to-br from-slate-900 to-slate-950">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              {steps[currentStep]?.icon}
              {steps[currentStep]?.title}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {currentStep === 0 && (
              <>
                <div>
                  <label className="block text-sm font-semibold text-white mb-2">
                    Full Name *
                  </label>
                  <Input
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="John Doe"
                    className="border-slate-700 bg-slate-900 text-white"
                  />
                  <p className="text-xs text-slate-400 mt-1">
                    This will be displayed to other riders and drivers.
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-white mb-2">
                    Contact Number *
                  </label>
                  <Input
                    value={contactNumber}
                    onChange={(e) => setContactNumber(e.target.value)}
                    placeholder="+92 300 1234567"
                    className="border-slate-700 bg-slate-900 text-white"
                  />
                  <p className="text-xs text-slate-400 mt-1">
                    Used for ride coordination and emergencies.
                  </p>
                </div>
              </>
            )}

            {currentStep === 1 && (
              <>
                <div>
                  <label className="block text-sm font-semibold text-white mb-2">
                    Gender *
                  </label>
                  <Select value={gender} onValueChange={(value: any) => setGender(value)}>
                    <SelectTrigger className="border-slate-700 bg-slate-900 text-white">
                      <SelectValue placeholder="Select gender" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="male">Male</SelectItem>
                      <SelectItem value="female">Female</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-white mb-2">
                    Bio (Optional)
                  </label>
                  <textarea
                    value={bio}
                    onChange={(e) => setBio(e.target.value)}
                    placeholder="Tell other riders about yourself..."
                    className={cn(
                      'w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-white placeholder:text-slate-400',
                      'transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-primary'
                    )}
                    rows={4}
                  />
                  <p className="text-xs text-slate-400 mt-1">
                    Maximum 200 characters. This helps build trust with other users.
                  </p>
                </div>
              </>
            )}

            {currentStep === 2 && (
              <div>
                <label className="block text-sm font-semibold text-white mb-2">
                  University *
                </label>
                <Select value={university} onValueChange={setUniversity}>
                  <SelectTrigger className="border-slate-700 bg-slate-900 text-white">
                    <SelectValue placeholder="Select your university" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="fast">FAST (Karachi)</SelectItem>
                    <SelectItem value="ned">NED (Karachi)</SelectItem>
                    <SelectItem value="iqra">Iqra University</SelectItem>
                    <SelectItem value="aga-khan">Aga Khan University</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-slate-400 mt-2">
                  Your university helps us match you with students in your area.
                </p>
              </div>
            )}

            {currentStep === 3 && (
              <div>
                <label className="block text-sm font-semibold text-white mb-2">
                  Transport (Optional)
                </label>
                <Select value={transport} onValueChange={setTransport}>
                  <SelectTrigger className="border-slate-700 bg-slate-900 text-white">
                    <SelectValue placeholder="What vehicle do you use?" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="car">Car</SelectItem>
                    <SelectItem value="bike">Motorcycle/Bike</SelectItem>
                    <SelectItem value="none">None (I'm a passenger)</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-slate-400 mt-2">
                  Helps other riders understand your preferences.
                </p>
              </div>
            )}

            {/* Summary if all complete */}
            {profileCompletion === 100 && currentStep === 3 && (
              <div className="p-4 bg-green-500/10 border border-green-500/30 rounded-lg">
                <div className="flex items-center gap-2 text-green-400 font-semibold mb-2">
                  <CheckCircle2 className="h-5 w-5" />
                  Profile Complete!
                </div>
                <p className="text-sm text-green-300">
                  You're all set! Click "Continue" to start exploring Campus Ride.
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Navigation Buttons */}
        <div className="flex gap-3 mt-8">
          <Button
            onClick={() => setCurrentStep(Math.max(0, currentStep - 1))}
            disabled={currentStep === 0}
            variant="outline"
            className="flex-1"
          >
            Previous
          </Button>
          <Button
            onClick={handleSaveStep}
            disabled={!isCurrentStepComplete || saving}
            className="flex-1"
          >
            {saving ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Saving...
              </>
            ) : profileCompletion === 100 ? (
              'Continue'
            ) : (
              'Next'
            )}
          </Button>
        </div>

        <p className="text-xs text-slate-400 text-center mt-6">
          * Required fields • Your information is secure and only shared with ride participants.
        </p>
      </div>
    </div>
  );
}
