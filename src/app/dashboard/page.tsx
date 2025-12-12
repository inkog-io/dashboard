import { currentUser } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import { Key, ArrowRight } from "lucide-react";

export default async function DashboardPage() {
  const user = await currentUser();

  if (!user) {
    redirect("/sign-in");
  }

  return (
    <div className="space-y-8">
      {/* Welcome Section */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
        <p className="text-gray-600 mt-1">
          Welcome back, {user.firstName || "there"}!
        </p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white rounded-lg shadow-sm border p-6">
          <h3 className="text-sm font-medium text-gray-500 uppercase tracking-wide">
            API Keys
          </h3>
          <p className="mt-2 text-3xl font-semibold text-gray-900">0</p>
          <p className="mt-1 text-sm text-gray-600">Active keys</p>
        </div>

        <div className="bg-white rounded-lg shadow-sm border p-6">
          <h3 className="text-sm font-medium text-gray-500 uppercase tracking-wide">
            Scans Today
          </h3>
          <p className="mt-2 text-3xl font-semibold text-gray-900">0</p>
          <p className="mt-1 text-sm text-gray-600">Files scanned</p>
        </div>

        <div className="bg-white rounded-lg shadow-sm border p-6">
          <h3 className="text-sm font-medium text-gray-500 uppercase tracking-wide">
            Findings
          </h3>
          <p className="mt-2 text-3xl font-semibold text-gray-900">0</p>
          <p className="mt-1 text-sm text-gray-600">Security issues found</p>
        </div>
      </div>

      {/* Quick Start */}
      <div className="bg-white rounded-lg shadow-sm border p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">
          Quick Start
        </h2>
        <div className="space-y-4">
          <div className="flex items-start gap-3">
            <div className="w-6 h-6 rounded-full bg-gray-100 flex items-center justify-center text-sm font-medium">
              1
            </div>
            <div className="flex-1">
              <p className="font-medium text-gray-900">Generate an API key</p>
              <p className="text-sm text-gray-600">
                Create your first API key to authenticate CLI requests.
              </p>
              <Link
                href="/dashboard/api-keys"
                className="inline-flex items-center gap-1 mt-2 text-sm font-medium text-blue-600 hover:text-blue-700"
              >
                <Key className="h-4 w-4" />
                Manage API Keys
                <ArrowRight className="h-3 w-3" />
              </Link>
            </div>
          </div>

          <div className="flex items-start gap-3">
            <div className="w-6 h-6 rounded-full bg-gray-100 flex items-center justify-center text-sm font-medium">
              2
            </div>
            <div>
              <p className="font-medium text-gray-900">Install the CLI</p>
              <p className="text-sm text-gray-600">
                Run{" "}
                <code className="bg-gray-100 px-1.5 py-0.5 rounded text-sm">
                  curl -sSL https://inkog.io/install.sh | sh
                </code>
              </p>
            </div>
          </div>

          <div className="flex items-start gap-3">
            <div className="w-6 h-6 rounded-full bg-gray-100 flex items-center justify-center text-sm font-medium">
              3
            </div>
            <div>
              <p className="font-medium text-gray-900">Scan your agents</p>
              <p className="text-sm text-gray-600">
                Run{" "}
                <code className="bg-gray-100 px-1.5 py-0.5 rounded text-sm">
                  inkog scan -path ./your-agent -api-key YOUR_KEY
                </code>
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
