import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useForm } from "react-hook-form";
import { insertScanSchema } from "@shared/schema";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Link } from "wouter";
import { Loader2 } from "lucide-react";

export default function HomePage() {
  const { user, logoutMutation } = useAuth();
  const { toast } = useToast();

  const form = useForm({
    resolver: zodResolver(insertScanSchema),
    defaultValues: {
      url: "",
    },
  });

  const scanMutation = useMutation({
    mutationFn: async (data: { url: string }) => {
      const res = await apiRequest("POST", "/api/scans", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/scans"] });
      toast({
        title: "Scan started",
        description: "Your website is being scanned for accessibility issues.",
      });
      form.reset();
    },
    onError: (error: Error) => {
      toast({
        title: "Scan failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const onSubmit = form.handleSubmit((data) => {
    scanMutation.mutate(data);
  });

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <h1 className="text-2xl font-bold">AccessScan</h1>
          <div className="flex items-center gap-4">
            <span>Welcome, {user?.username}</span>
            <Link href="/dashboard">
              <Button variant="outline">Dashboard</Button>
            </Link>
            <Button
              variant="ghost"
              onClick={() => logoutMutation.mutate()}
              disabled={logoutMutation.isPending}
            >
              {logoutMutation.isPending && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              Logout
            </Button>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <div className="max-w-2xl mx-auto text-center">
          <h2 className="text-3xl font-bold mb-4">
            Start Your Accessibility Scan
          </h2>
          <p className="text-muted-foreground mb-8">
            Enter your website URL below to check for WCAG 2.1 compliance
          </p>

          <form onSubmit={onSubmit} className="flex gap-4">
            <Input
              placeholder="https://your-website.com"
              className="flex-1"
              {...form.register("url")}
            />
            <Button type="submit" disabled={scanMutation.isPending}>
              {scanMutation.isPending && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              Start Scan
            </Button>
          </form>
        </div>
      </main>
    </div>
  );
}
