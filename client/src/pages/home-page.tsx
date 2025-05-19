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
import { Loader2, AlertCircle } from "lucide-react";
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from "@/components/ui/alert";

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
  
  // Add Lighthouse scan mutation
  const lighthouseScanMutation = useMutation({
    mutationFn: async (data: { url: string }) => {
      const res = await apiRequest("POST", "/api/lighthouse-scans", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/scans"] });
      toast({
        title: "Lighthouse scan started",
        description: "Google Lighthouse is analyzing your website for accessibility issues.",
      });
      form.reset();
    },
    onError: (error: Error) => {
      toast({
        title: "Lighthouse scan failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const onSubmit = form.handleSubmit((data) => {
    scanMutation.mutate(data);
  });

  const onLighthouseScan = form.handleSubmit((data) => {
    lighthouseScanMutation.mutate(data);
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

          <div className="max-w-md mx-auto">
            <div className="p-6 border rounded-lg bg-card shadow-sm">
              <form className="space-y-4">
                <div>
                  <Input
                    placeholder="example.com"
                    className="w-full"
                    {...form.register("url")}
                  />
                  {form.formState.errors.url && (
                    <p className="text-destructive text-sm mt-1">
                      {form.formState.errors.url.message}
                    </p>
                  )}
                </div>
                
                <div className="flex flex-col gap-3 pt-2">
                  <Button
                    type="button"
                    onClick={onSubmit}
                    disabled={scanMutation.isPending || lighthouseScanMutation.isPending}
                    className="w-full"
                  >
                    {scanMutation.isPending ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Scanning...
                      </>
                    ) : (
                      "Standard Scan"
                    )}
                  </Button>
                  
                  <div className="relative">
                    <div className="absolute inset-0 flex items-center">
                      <span className="w-full border-t" />
                    </div>
                    <div className="relative flex justify-center text-xs uppercase">
                      <span className="bg-background px-2 text-muted-foreground">
                        Or
                      </span>
                    </div>
                  </div>
                  
                  <Button
                    type="button"
                    onClick={onLighthouseScan}
                    disabled={lighthouseScanMutation.isPending || scanMutation.isPending}
                    variant="outline"
                    className="w-full"
                  >
                    {lighthouseScanMutation.isPending ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Running Lighthouse...
                      </>
                    ) : (
                      "Google Lighthouse Scan"
                    )}
                  </Button>
                </div>
                
                <p className="text-xs text-muted-foreground text-center mt-2">
                  Lighthouse may work better for scanning external websites.
                </p>
              </form>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}