import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Users, AlertCircle, CheckCircle, ExternalLink } from 'lucide-react';

export default function Auth() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('signin');
  const [isResettingPassword, setIsResettingPassword] = useState(false);
  
  const { signIn, signUp, user, resetPassword, updatePassword } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const { toast } = useToast();

  // Check if this is a password reset callback
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    if (params.get('reset') === 'true' && user) {
      setIsResettingPassword(true);
      setActiveTab('reset-password');
    }
  }, [location, user]);

  // Redirect if already authenticated
  useEffect(() => {
    if (user) {
      const from = location.state?.from?.pathname || '/';
      navigate(from, { replace: true });
    }
  }, [user, navigate, location]);

  const getErrorMessage = (error: any) => {
    const message = error?.message || '';
    
    if (message.includes('Invalid login credentials')) {
      return 'Invalid email or password. Please check your credentials and try again.';
    }
    if (message.includes('Email address') && message.includes('is invalid')) {
      return 'This email domain may not be allowed. Please check Supabase Auth settings or use a different email.';
    }
    if (message.includes('User already registered')) {
      return 'An account with this email already exists. Try signing in instead.';
    }
    if (message.includes('Signup is disabled')) {
      return 'Account creation is currently disabled. Please contact your administrator.';
    }
    
    return message || 'An unexpected error occurred. Please try again.';
  };

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    
    try {
      const { error } = await signIn(email, password);
      
      if (error) {
        console.error('Sign in error:', error);
        toast({
          title: "Sign in failed",
          description: getErrorMessage(error),
          variant: "destructive",
        });
      } else {
        toast({
          title: "Welcome back!",
          description: "You have successfully signed in.",
        });
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    
    try {
      const { error } = await signUp(email, password, fullName);
      
      if (error) {
        console.error('Sign up error:', error);
        toast({
          title: "Sign up failed",
          description: getErrorMessage(error),
          variant: "destructive",
        });
      } else {
        toast({
          title: "Account created successfully!",
          description: "Please check your email to confirm your account, then sign in.",
        });
        setActiveTab('signin');
        setEmail('');
        setPassword('');
        setFullName('');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    
    try {
      const { error } = await resetPassword(email);
      
      if (error) {
        console.error('Password reset error:', error);
        toast({
          title: "Password reset failed",
          description: getErrorMessage(error),
          variant: "destructive",
        });
      } else {
        toast({
          title: "Password reset email sent!",
          description: "Please check your email for the password reset link.",
        });
        setEmail('');
        setActiveTab('signin');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (newPassword !== confirmPassword) {
      toast({
        title: "Passwords don't match",
        description: "Please make sure both passwords are the same.",
        variant: "destructive",
      });
      return;
    }

    if (newPassword.length < 6) {
      toast({
        title: "Password too short",
        description: "Password must be at least 6 characters long.",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);
    
    try {
      const { error } = await updatePassword(newPassword);
      
      if (error) {
        console.error('Password update error:', error);
        toast({
          title: "Password update failed",
          description: getErrorMessage(error),
          variant: "destructive",
        });
      } else {
        toast({
          title: "Password updated successfully!",
          description: "You can now sign in with your new password.",
        });
        setNewPassword('');
        setConfirmPassword('');
        setIsResettingPassword(false);
        navigate('/', { replace: true });
      }
    } finally {
      setIsLoading(false);
    }
  };

  const createTestUsers = async () => {
    setIsLoading(true);
    const testUsers = [
      { name: "Admin User", email: "admin@example.com", password: "admin123" },
      { name: "Manager User", email: "manager@example.com", password: "manager123" },
      { name: "Regular User", email: "user@example.com", password: "user123" }
    ];

    let successCount = 0;
    let errors: string[] = [];

    try {
      for (const testUser of testUsers) {
        const { error } = await signUp(testUser.email, testUser.password, testUser.name);
        if (error) {
          if (error.message.includes('already registered')) {
            successCount++; // Count as success if already exists
          } else {
            errors.push(`${testUser.email}: ${getErrorMessage(error)}`);
          }
        } else {
          successCount++;
        }
      }
      
      if (errors.length === 0) {
        toast({
          title: "Test users ready!",
          description: `${successCount} test accounts available. Try: admin@example.com / admin123`,
        });
      } else {
        toast({
          title: `${successCount} users ready, ${errors.length} failed`,
          description: `Working accounts available. Errors: ${errors.join(', ')}`,
          variant: errors.length === testUsers.length ? "destructive" : "default",
        });
      }
    } catch (error: any) {
      console.error('Test user creation error:', error);
      toast({
        title: "Error creating test users",
        description: getErrorMessage(error),
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="w-full max-w-md space-y-6">
        <div className="flex flex-col items-center space-y-2">
          <div className="w-12 h-12 bg-gradient-to-br from-primary to-info rounded-lg flex items-center justify-center">
            <span className="text-primary-foreground font-bold text-lg">ERP</span>
          </div>
          <h1 className="text-2xl font-bold text-foreground">Enterprise Management System</h1>
          <p className="text-sm text-muted-foreground text-center">
            Sign in to access your dashboard
          </p>
        </div>

        <div className="mb-4 space-y-3">
          <div className="bg-accent/50 rounded-lg p-4 border border-primary/20">
            <p className="text-sm font-medium mb-3">No account? Submit via our public forms:</p>
            <div className="flex flex-col gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => navigate("/register-supplier")}
                className="w-full justify-start"
              >
                <ExternalLink className="w-4 h-4 mr-2" />
                Supplier Registration
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => navigate("/request-asset")}
                className="w-full justify-start"
              >
                <ExternalLink className="w-4 h-4 mr-2" />
                Asset Request
              </Button>
            </div>
          </div>

          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              <strong>First time setup:</strong> If you get login errors, check Supabase Auth settings:
              <br />• Enable Email provider & new signups
              <br />• Disable domain allowlist (or add your domain)
              <br />• Set Site URL and Redirect URLs correctly
            </AlertDescription>
          </Alert>
          
          <Button 
            onClick={createTestUsers} 
            disabled={isLoading}
            variant="outline"
            className="w-full"
          >
            <Users className="mr-2 h-4 w-4" />
            {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Create Test Users (Dev Only)
          </Button>
          <p className="text-xs text-muted-foreground text-center">
            Creates: admin@example.com, manager@example.com, user@example.com (all with password: role123)
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Authentication</CardTitle>
            <CardDescription>
              Sign in to your account or create a new one
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs value={activeTab} onValueChange={setActiveTab}>
              <TabsList className={`grid w-full ${isResettingPassword ? 'grid-cols-1' : 'grid-cols-3'}`}>
                {!isResettingPassword && <TabsTrigger value="signin">Sign In</TabsTrigger>}
                {!isResettingPassword && <TabsTrigger value="signup">Sign Up</TabsTrigger>}
                {!isResettingPassword && <TabsTrigger value="forgot">Forgot Password</TabsTrigger>}
                {isResettingPassword && <TabsTrigger value="reset-password">Reset Password</TabsTrigger>}
              </TabsList>
              
              <TabsContent value="signin" className="space-y-4">
                <form onSubmit={handleSignIn} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="signin-email">Email</Label>
                    <Input
                      id="signin-email"
                      type="email"
                      placeholder="Enter your email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="signin-password">Password</Label>
                    <Input
                      id="signin-password"
                      type="password"
                      placeholder="Enter your password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                    />
                  </div>
                  <Button type="submit" className="w-full" disabled={isLoading}>
                    {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Sign In
                  </Button>
                </form>
              </TabsContent>
              
              <TabsContent value="signup" className="space-y-4">
                <form onSubmit={handleSignUp} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="signup-name">Full Name</Label>
                    <Input
                      id="signup-name"
                      type="text"
                      placeholder="Enter your full name"
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="signup-email">Email</Label>
                    <Input
                      id="signup-email"
                      type="email"
                      placeholder="Enter your email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="signup-password">Password</Label>
                    <Input
                      id="signup-password"
                      type="password"
                      placeholder="Create a password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      minLength={6}
                    />
                  </div>
                  <Button type="submit" className="w-full" disabled={isLoading}>
                    {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Sign Up
                  </Button>
                </form>
              </TabsContent>
              
              <TabsContent value="forgot" className="space-y-4">
                <form onSubmit={handleForgotPassword} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="forgot-email">Email</Label>
                    <Input
                      id="forgot-email"
                      type="email"
                      placeholder="Enter your email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                    />
                  </div>
                  <Button type="submit" className="w-full" disabled={isLoading}>
                    {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Send Reset Link
                  </Button>
                  <p className="text-xs text-muted-foreground text-center">
                    Enter your email and we'll send you a link to reset your password.
                  </p>
                </form>
              </TabsContent>
              
              <TabsContent value="reset-password" className="space-y-4">
                <form onSubmit={handleUpdatePassword} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="new-password">New Password</Label>
                    <Input
                      id="new-password"
                      type="password"
                      placeholder="Enter new password"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      required
                      minLength={6}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="confirm-password">Confirm Password</Label>
                    <Input
                      id="confirm-password"
                      type="password"
                      placeholder="Confirm new password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      required
                      minLength={6}
                    />
                  </div>
                  <Button type="submit" className="w-full" disabled={isLoading}>
                    {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Update Password
                  </Button>
                </form>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>

        <div className="text-center">
          <Alert>
            <CheckCircle className="h-4 w-4" />
            <AlertDescription>
              <strong>After signing in:</strong> First user will get admin bootstrap option to manage the system.
            </AlertDescription>
          </Alert>
        </div>
      </div>
    </div>
  );
}