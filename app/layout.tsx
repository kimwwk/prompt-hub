import {
  ClerkProvider,
  SignInButton,
  SignedIn,
  SignedOut,
  UserButton,
} from "@clerk/nextjs";
import Link from "next/link";
import "./globals.css";

export const metadata = {
  title: 'Prompt Hub - GitHub for Prompts',
  description: 'Share, fork, and remix AI/LLM prompts in a community-first platform',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ClerkProvider>
      <html lang="en">
        <body className="min-h-screen flex flex-col bg-gray-50">
          <header className="bg-white shadow-sm">
            <div className="container mx-auto px-4 py-4 flex justify-between items-center">
              <div className="flex items-center space-x-2">
                <Link href="/" className="flex items-center">
                  <img 
                    src="/light-logo.png" 
                    alt="Prompt Hub Logo" 
                    className="h-8 w-auto"
                  />
                  <span className="ml-2 text-xl font-semibold text-gray-800">Prompt Hub</span>
                </Link>
              </div>
              
              <nav className="flex items-center space-x-6">
                <Link href="/" className="text-gray-600 hover:text-gray-900 text-sm font-medium">
                  Browse
                </Link>
                <SignedIn>
                  <Link href="/repo/create" className="text-gray-600 hover:text-gray-900 text-sm font-medium">
                    Create Prompt
                  </Link>
                </SignedIn>
                <div className="flex items-center">
                  <SignedOut>
                    <Link href="/sign-in" className="text-sm font-medium text-gray-600 hover:text-gray-900 mr-4">
                      Sign In
                    </Link>
                    <Link href="/sign-up" className="px-4 py-2 text-sm font-medium text-white bg-purple-600 rounded-md hover:bg-purple-700 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2 transition-colors">
                      Sign Up
                    </Link>
                  </SignedOut>
                  <SignedIn>
                    <UserButton 
                      afterSignOutUrl="/"
                      appearance={{
                        elements: {
                          avatarBox: "h-8 w-8"
                        }
                      }}
                    />
                  </SignedIn>
                </div>
              </nav>
            </div>
          </header>
          <main className="flex-grow">{children}</main>
          <footer className="bg-white border-t border-gray-200 py-6">
            <div className="container mx-auto px-4">
              <div className="flex flex-col md:flex-row justify-between items-center">
                <div className="mb-4 md:mb-0">
                  <p className="text-gray-500 text-sm">
                    &copy; {new Date().getFullYear()} Prompt Hub. All rights reserved.
                  </p>
                </div>
                <div className="flex space-x-6">
                  <a href="#" className="text-gray-500 hover:text-gray-700 text-sm">Terms</a>
                  <a href="#" className="text-gray-500 hover:text-gray-700 text-sm">Privacy</a>
                  <a href="#" className="text-gray-500 hover:text-gray-700 text-sm">About</a>
                </div>
              </div>
            </div>
          </footer>
        </body>
      </html>
    </ClerkProvider>
  );
}
