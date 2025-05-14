import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useLocation } from "wouter";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { insertUserSchema } from "@shared/schema";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2 } from "lucide-react";

export default function AuthPage() {
  const [, setLocation] = useLocation();
  const { user, loginMutation, registerMutation } = useAuth();
  const [activeTab, setActiveTab] = useState<"login" | "register">("login");

  const form = useForm({
    resolver: zodResolver(insertUserSchema),
    defaultValues: {
      username: "",
      password: "",
    },
  });

  // Use useEffect for navigation after render to avoid state updates during render
  useEffect(() => {
    if (user) {
      setLocation("/");
    }
  }, [user, setLocation]);

  const onSubmit = form.handleSubmit((data) => {
    if (activeTab === "login") {
      loginMutation.mutate(data);
    } else {
      registerMutation.mutate(data);
    }
  });

  const isLoading = loginMutation.isPending || registerMutation.isPending;

  return (
    <div className="min-h-screen grid md:grid-cols-2">
      <div className="flex items-center justify-center p-8">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle>Welcome to AccessScan</CardTitle>
            <CardDescription>
              Your web accessibility compliance partner
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)}>
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="login">Login</TabsTrigger>
                <TabsTrigger value="register">Register</TabsTrigger>
              </TabsList>
              <TabsContent value="login">
                <form onSubmit={onSubmit} className="space-y-4">
                  <Input
                    placeholder="Username"
                    {...form.register("username")}
                  />
                  <Input
                    type="password"
                    placeholder="Password"
                    {...form.register("password")}
                  />
                  <Button className="w-full" disabled={isLoading}>
                    {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Login
                  </Button>
                </form>
              </TabsContent>
              <TabsContent value="register">
                <form onSubmit={onSubmit} className="space-y-4">
                  <Input
                    placeholder="Username"
                    {...form.register("username")}
                  />
                  <Input
                    type="password"
                    placeholder="Password"
                    {...form.register("password")}
                  />
                  <Button className="w-full" disabled={isLoading}>
                    {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Register
                  </Button>
                </form>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </div>
      <div className="bg-primary hidden md:flex items-center justify-center p-8">
        <div className="max-w-lg text-primary-foreground">
          <h1 className="text-4xl font-bold mb-4">
            Web Accessibility Made Simple
          </h1>
          <p className="text-lg opacity-90">
            Scan your website for WCAG 2.1 compliance, get detailed reports,
            and track your accessibility improvements over time.
          </p>
        </div>
      </div>
    </div>
  );
}
