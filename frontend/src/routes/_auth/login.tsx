import { useMutation } from '@tanstack/react-query'
import { Link, createFileRoute, useNavigate } from '@tanstack/react-router'
import { Eye, EyeOff, Lock } from 'lucide-react'
import { useState, type FormEvent } from 'react'

import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

import { login as loginRequest } from '@/features/auth/api'

function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)

  const navigate = useNavigate()
  const login = useMutation({
    mutationFn: loginRequest,
    onSuccess: () => navigate({ to: '/upload' }),
  })

  function handleLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    login.mutate({ email, password })
  }

  return (
    <div className="flex flex-1 items-center justify-center px-4 py-20">
      <Card className="w-full max-w-sm">
        <CardHeader className="items-center text-center">
          <div className="mb-2 flex size-11 items-center justify-center rounded-xl bg-primary/10 text-primary ring-1 ring-primary/20">
            <Lock className="size-5" />
          </div>
          <CardTitle className="text-xl">Log in to ApproX</CardTitle>
          <CardDescription>
            Enter your credentials to generate data.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleLogin} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                autoComplete="email"
                placeholder="you@example.com"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="password">Password</Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  placeholder="••••••••"
                  className="pr-9"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  required
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  aria-label={
                    showPassword ? 'Hide password' : 'Show password'
                  }
                  className="absolute inset-y-0 right-0 size-8"
                  onClick={() => setShowPassword((value) => !value)}
                >
                  {showPassword ? (
                    <EyeOff className="size-4" />
                  ) : (
                    <Eye className="size-4" />
                  )}
                </Button>
              </div>
            </div>
            {login.isError && (
              <p className="text-sm text-destructive">
                {login.error instanceof Error
                  ? login.error.message
                  : 'Login failed. Please try again.'}
              </p>
            )}
            <Button
              type="submit"
              size="lg"
              className="w-full"
              disabled={login.isPending}
            >
              {login.isPending ? 'Logging in…' : 'Log in'}
            </Button>
          </form>
        </CardContent>
        <CardContent className="flex justify-center pb-4 pt-0">
          <Button asChild variant="ghost" size="sm">
            <Link to="/">Back to home</Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}

export const Route = createFileRoute('/_auth/login')({
  component: LoginPage,
})