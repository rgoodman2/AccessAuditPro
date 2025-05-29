import { Link, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Globe, Shield, FileText, Zap, CheckCircle, Users, Clock, Star } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { useEffect } from "react";

export default function HomePage() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();

  // Redirect authenticated users to dashboard
  useEffect(() => {
    if (user) {
      setLocation("/dashboard");
    }
  }, [user, setLocation]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      {/* Navigation */}
      <nav className="bg-white shadow-sm border-b">
        <div className="container mx-auto px-4 py-4">
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-2">
              <Shield className="h-8 w-8 text-blue-600" />
              <span className="text-2xl font-bold text-gray-900">AccessScan</span>
            </div>
            <div className="flex items-center gap-4">
              <Link href="/auth">
                <Button variant="outline">Sign In</Button>
              </Link>
              <Link href="/auth">
                <Button>Get Started</Button>
              </Link>
            </div>
          </div>
        </div>
      </nav>

      <div className="container mx-auto px-4 py-16">
        {/* Hero Section */}
        <div className="text-center mb-16">
          <h1 className="text-5xl font-bold text-gray-900 mb-6">
            Professional Web Accessibility Scanner
          </h1>
          <p className="text-xl text-gray-600 mb-8 max-w-3xl mx-auto">
            Ensure your website meets WCAG 2.1 compliance standards with our comprehensive 
            accessibility scanning and reporting platform. Get detailed insights and actionable 
            recommendations to make your website accessible to all users.
          </p>
          <div className="flex justify-center gap-4">
            <Link href="/auth">
              <Button size="lg" className="px-8 py-4 text-lg">
                Start Free Scan
              </Button>
            </Link>
            <Button variant="outline" size="lg" className="px-8 py-4 text-lg">
              View Demo
            </Button>
          </div>
        </div>

        {/* Features Grid */}
        <div className="grid md:grid-cols-3 gap-8 mb-16">
          <Card className="text-center hover:shadow-lg transition-shadow">
            <CardHeader>
              <Globe className="h-12 w-12 text-blue-600 mx-auto mb-4" />
              <CardTitle>Comprehensive Scanning</CardTitle>
              <CardDescription>
                Analyze any website for WCAG 2.1 AA compliance with detailed violation reports
              </CardDescription>
            </CardHeader>
          </Card>

          <Card className="text-center hover:shadow-lg transition-shadow">
            <CardHeader>
              <FileText className="h-12 w-12 text-green-600 mx-auto mb-4" />
              <CardTitle>Professional Reports</CardTitle>
              <CardDescription>
                Get detailed PDF reports with actionable recommendations and priority fixes
              </CardDescription>
            </CardHeader>
          </Card>

          <Card className="text-center hover:shadow-lg transition-shadow">
            <CardHeader>
              <Zap className="h-12 w-12 text-purple-600 mx-auto mb-4" />
              <CardTitle>Fast & Reliable</CardTitle>
              <CardDescription>
                Lightning-fast scans with accurate results using industry-standard tools
              </CardDescription>
            </CardHeader>
          </Card>
        </div>

        {/* Benefits Section */}
        <div className="bg-white rounded-lg shadow-lg p-8 mb-16">
          <h2 className="text-3xl font-bold text-gray-900 text-center mb-8">
            Why Choose AccessScan?
          </h2>
          <div className="grid md:grid-cols-2 gap-8">
            <div className="space-y-6">
              <div className="flex items-start gap-3">
                <CheckCircle className="h-6 w-6 text-green-500 mt-1 flex-shrink-0" />
                <div>
                  <h3 className="font-semibold text-gray-900">WCAG 2.1 Compliance</h3>
                  <p className="text-gray-600">
                    Comprehensive testing against Web Content Accessibility Guidelines 2.1 Level AA standards
                  </p>
                </div>
              </div>
              
              <div className="flex items-start gap-3">
                <CheckCircle className="h-6 w-6 text-green-500 mt-1 flex-shrink-0" />
                <div>
                  <h3 className="font-semibold text-gray-900">Detailed Analytics</h3>
                  <p className="text-gray-600">
                    Get in-depth analysis of accessibility issues with clear explanations and fix recommendations
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <CheckCircle className="h-6 w-6 text-green-500 mt-1 flex-shrink-0" />
                <div>
                  <h3 className="font-semibold text-gray-900">Priority Scoring</h3>
                  <p className="text-gray-600">
                    Issues are categorized by severity to help you focus on the most critical fixes first
                  </p>
                </div>
              </div>
            </div>

            <div className="space-y-6">
              <div className="flex items-start gap-3">
                <CheckCircle className="h-6 w-6 text-green-500 mt-1 flex-shrink-0" />
                <div>
                  <h3 className="font-semibold text-gray-900">Professional Reports</h3>
                  <p className="text-gray-600">
                    Export comprehensive PDF reports perfect for sharing with stakeholders and developers
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <CheckCircle className="h-6 w-6 text-green-500 mt-1 flex-shrink-0" />
                <div>
                  <h3 className="font-semibold text-gray-900">Scan History</h3>
                  <p className="text-gray-600">
                    Track progress over time and maintain records of all your accessibility improvements
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <CheckCircle className="h-6 w-6 text-green-500 mt-1 flex-shrink-0" />
                <div>
                  <h3 className="font-semibold text-gray-900">Easy Integration</h3>
                  <p className="text-gray-600">
                    Simple to use interface that works with any website - no technical setup required
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Stats Section */}
        <div className="grid md:grid-cols-4 gap-6 mb-16">
          <div className="text-center bg-white rounded-lg p-6 shadow-sm">
            <div className="text-3xl font-bold text-blue-600 mb-2">1,200+</div>
            <div className="text-gray-600 flex items-center justify-center gap-1">
              <Globe className="h-4 w-4" />
              Websites Scanned
            </div>
          </div>
          <div className="text-center bg-white rounded-lg p-6 shadow-sm">
            <div className="text-3xl font-bold text-green-600 mb-2">8,500+</div>
            <div className="text-gray-600 flex items-center justify-center gap-1">
              <FileText className="h-4 w-4" />
              Issues Found
            </div>
          </div>
          <div className="text-center bg-white rounded-lg p-6 shadow-sm">
            <div className="text-3xl font-bold text-purple-600 mb-2">98%</div>
            <div className="text-gray-600 flex items-center justify-center gap-1">
              <Star className="h-4 w-4" />
              Accuracy Rate
            </div>
          </div>
          <div className="text-center bg-white rounded-lg p-6 shadow-sm">
            <div className="text-3xl font-bold text-orange-600 mb-2">24/7</div>
            <div className="text-gray-600 flex items-center justify-center gap-1">
              <Clock className="h-4 w-4" />
              Available
            </div>
          </div>
        </div>

        {/* Testimonials */}
        <div className="mb-16">
          <h2 className="text-3xl font-bold text-gray-900 text-center mb-8">
            Trusted by Businesses Worldwide
          </h2>
          <div className="grid md:grid-cols-3 gap-8">
            <Card>
              <CardContent className="p-6">
                <div className="flex items-center gap-1 mb-4">
                  {[...Array(5)].map((_, i) => (
                    <Star key={i} className="h-4 w-4 fill-yellow-400 text-yellow-400" />
                  ))}
                </div>
                <p className="text-gray-600 mb-4">
                  "AccessScan helped us identify and fix critical accessibility issues before launch. 
                  The reports are incredibly detailed and actionable."
                </p>
                <div className="text-sm text-gray-500">- Sarah M., Product Manager</div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-6">
                <div className="flex items-center gap-1 mb-4">
                  {[...Array(5)].map((_, i) => (
                    <Star key={i} className="h-4 w-4 fill-yellow-400 text-yellow-400" />
                  ))}
                </div>
                <p className="text-gray-600 mb-4">
                  "The automated scanning saved us weeks of manual testing. We now catch 
                  accessibility issues early in our development process."
                </p>
                <div className="text-sm text-gray-500">- David K., Developer</div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-6">
                <div className="flex items-center gap-1 mb-4">
                  {[...Array(5)].map((_, i) => (
                    <Star key={i} className="h-4 w-4 fill-yellow-400 text-yellow-400" />
                  ))}
                </div>
                <p className="text-gray-600 mb-4">
                  "Professional reports that we can share with clients and stakeholders. 
                  AccessScan is an essential tool for our agency."
                </p>
                <div className="text-sm text-gray-500">- Michelle L., Agency Owner</div>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* CTA Section */}
        <div className="bg-gradient-to-r from-blue-600 to-purple-600 rounded-lg text-white p-8 text-center">
          <h2 className="text-3xl font-bold mb-4">
            Ready to Make Your Website Accessible?
          </h2>
          <p className="text-xl mb-6 opacity-90">
            Join hundreds of businesses ensuring their websites are accessible to everyone
          </p>
          <Link href="/auth">
            <Button size="lg" variant="secondary" className="px-8 py-4 text-lg">
              Start Your Free Scan Today
            </Button>
          </Link>
        </div>
      </div>

      {/* Footer */}
      <footer className="bg-gray-900 text-white py-8 mt-16">
        <div className="container mx-auto px-4">
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-2">
              <Shield className="h-6 w-6" />
              <span className="font-semibold">AccessScan</span>
            </div>
            <div className="text-sm text-gray-400">
              © 2024 AccessScan. Making the web accessible for everyone.
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}