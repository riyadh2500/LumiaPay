import AuthForm from '@/components/auth-form';

export const metadata = { title: 'Create account — LumiaPay' };

export default function SignupPage() {
  return <AuthForm mode="signup" />;
}
