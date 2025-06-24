import React from "react";
import { useAuth } from "@/hooks/use-auth";
import { useQuery, useMutation } from "@tanstack/react-query";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  CardFooter,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Link } from "wouter";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatDistanceToNow } from "date-fns";
import { Loader2, Save, Globe, Search } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { 
  Form, 
  FormControl, 
  FormDescription, 
  FormField, 
  FormItem, 
  FormLabel, 
  FormMessage 
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";

// Define validation schema for report settings
const reportSettingsSchema = z.object({
  companyName: z.string().min(1, 'Company name is required'),
  companyLogo: z.string().optional(),
  contactEmail: z.string().email('Invalid email').optional().or(z.literal('')),
  contactPhone: z.string().optional(),
  websiteUrl: z.string().url('Invalid URL').optional().or(z.literal('')),
  colors: z.object({
    primary: z.string().optional().or(z.literal('')),
    secondary: z.string().optional().or(z.literal('')),
    accent: z.string().optional().or(z.literal('')),
    textPrimary: z.string().optional().or(z.literal('')),
    textSecondary: z.string().optional().or(z.literal('')),
    background: z.string().optional().or(z.literal(''))
  }).optional()
});

type ReportSettingsFormValues = z.infer<typeof reportSettingsSchema>;

// Scan form schema
const scanSchema = z.object({
  url: z.string().min(1, 'URL is required').refine((url) => {
    // Allow test URLs or proper URLs
    if (['test', 'test-sample', 'test-accessible'].includes(url)) return true;
    try {
      new URL(url.startsWith('http') ? url : 'https://' + url);
      return true;
    } catch {
      return false;
    }
  }, 'Please enter a valid URL or use "test" for demo')
});

type ScanFormValues = z.infer<typeof scanSchema>;

function NewScanForm() {
  const { toast } = useToast();
  
  const form = useForm<ScanFormValues>({
    resolver: zodResolver(scanSchema),
    defaultValues: {
      url: ''
    }
  });
  
  const scanMutation = useMutation({
    mutationFn: async (data: ScanFormValues) => {
      const response = await apiRequest('POST', '/api/scans', data);
      return await response.json();
    },
    onSuccess: () => {
      toast({
        title: "Scan started",
        description: "Your accessibility scan is now in progress. Refresh to see updates.",
      });
      form.reset();
      queryClient.invalidateQueries({ queryKey: ['/api/scans'] });
    },
    onError: (error: Error) => {
      toast({
        title: "Scan failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });
  
  const onSubmit = (data: ScanFormValues) => {
    scanMutation.mutate(data);
  };
  
  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <FormField
          control={form.control}
          name="url"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Website URL</FormLabel>
              <FormControl>
                <div className="flex gap-2">
                  <Input 
                    placeholder="Enter website URL or type 'test' for demo"
                    {...field}
                    disabled={scanMutation.isPending}
                  />
                  <Button 
                    type="submit" 
                    disabled={scanMutation.isPending}
                    className="whitespace-nowrap"
                  >
                    {scanMutation.isPending && (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    )}
                    <Search className="w-4 h-4 mr-2" />
                    Start Scan
                  </Button>
                </div>
              </FormControl>
              <FormDescription>
                Enter any website URL to scan for accessibility issues. Use "test" to try a demo scan.
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />
      </form>
    </Form>
  );
}

function ReportSettingsForm() {
  const { toast } = useToast();
  
  // Fetch existing settings
  const { data: settings, isLoading: isLoadingSettings } = useQuery({
    queryKey: ['/api/report-settings'],
  });
  
  // Form definition
  const form = useForm<ReportSettingsFormValues>({
    resolver: zodResolver(reportSettingsSchema),
    defaultValues: settings || {
      companyName: '',
      companyLogo: '',
      contactEmail: '',
      contactPhone: '',
      websiteUrl: '',
      colors: {
        primary: '#2563eb',
        secondary: '#6b7280',
        accent: '#0ea5e9',
        textPrimary: '#111827',
        textSecondary: '#4b5563',
        background: '#ffffff'
      }
    }
  });
  
  // Update form when settings are loaded
  React.useEffect(() => {
    if (settings) {
      form.reset(settings);
    }
  }, [settings, form]);
  
  // Mutation for saving settings
  const saveSettingsMutation = useMutation({
    mutationFn: async (data: ReportSettingsFormValues) => {
      const response = await apiRequest('POST', '/api/report-settings', data);
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: 'Settings saved',
        description: 'Your report settings have been updated successfully',
      });
      queryClient.invalidateQueries({ queryKey: ['/api/report-settings'] });
    },
    onError: (error) => {
      toast({
        title: 'Failed to save settings',
        description: error instanceof Error ? error.message : 'Unknown error',
        variant: 'destructive',
      });
    }
  });
  
  function onSubmit(values: ReportSettingsFormValues) {
    saveSettingsMutation.mutate(values);
  }
  
  if (isLoadingSettings) {
    return (
      <div className="flex justify-center p-8">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }
  
  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        <FormField
          control={form.control}
          name="companyName"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Company Name</FormLabel>
              <FormControl>
                <Input placeholder="Acme Corporation" {...field} />
              </FormControl>
              <FormDescription>
                This will appear on the reports you generate
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />
        
        <FormField
          control={form.control}
          name="contactEmail"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Contact Email</FormLabel>
              <FormControl>
                <Input placeholder="contact@example.com" {...field} />
              </FormControl>
              <FormDescription>
                Contact email for report recipients
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />
        
        <FormField
          control={form.control}
          name="contactPhone"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Contact Phone</FormLabel>
              <FormControl>
                <Input placeholder="+1 (555) 123-4567" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        
        <FormField
          control={form.control}
          name="websiteUrl"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Website URL</FormLabel>
              <FormControl>
                <Input placeholder="https://example.com" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        
        <div className="flex justify-end">
          <Button 
            type="submit" 
            disabled={saveSettingsMutation.isPending}
          >
            {saveSettingsMutation.isPending && (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            )}
            <Save className="w-4 h-4 mr-2" />
            Save Settings
          </Button>
        </div>
      </form>
    </Form>
  );
}

export default function DashboardPage() {
  const { user, logoutMutation } = useAuth();

  const { data: scans, isLoading } = useQuery({
    queryKey: ["/api/scans"],
  });

  const getStatusColor = (status: string) => {
    switch (status) {
      case "completed":
        return "default"; // success equivalent
      case "pending":
        return "secondary"; // warning equivalent
      case "failed":
        return "destructive";
      default:
        return "outline";
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <h1 className="text-2xl font-bold">AccessScan</h1>
          <div className="flex items-center gap-4">
            <span>Welcome, {user?.username}</span>
            <Link href="/">
              <Button variant="outline">Home</Button>
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

      <main className="container mx-auto px-4 py-8 grid gap-8">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Globe className="h-5 w-5" />
              New Accessibility Scan
            </CardTitle>
            <CardDescription>
              Scan any website for WCAG 2.1 compliance and accessibility issues
            </CardDescription>
          </CardHeader>
          <CardContent>
            <NewScanForm />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Scan History</CardTitle>
            <CardDescription>
              View all your previous accessibility scans
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex justify-center p-8">
                <Loader2 className="h-8 w-8 animate-spin" />
              </div>
            ) : !scans || scans.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                No scans found. Start your first scan from the home page.
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>URL</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Report</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {Array.isArray(scans) && scans.map((scan: any) => (
                    <TableRow key={scan.id}>
                      <TableCell className="font-medium">{scan.url}</TableCell>
                      <TableCell>
                        <Badge variant={getStatusColor(scan.status)}>
                          {scan.status}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {formatDistanceToNow(new Date(scan.createdAt), {
                          addSuffix: true,
                        })}
                      </TableCell>
                      <TableCell>
                        {scan.reportUrl && (
                          <Button
                            variant="outline"
                            size="sm"
                            asChild
                          >
                            <a
                              href={scan.reportUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                            >
                              View Report
                            </a>
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader>
            <CardTitle>Report Settings</CardTitle>
            <CardDescription>
              Customize the appearance and branding of your accessibility reports
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ReportSettingsForm />
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
